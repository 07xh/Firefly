import {
	ensurePrivateR2Backup,
	getPrivateR2Backup,
	listPrivateR2Backups,
	type PrivateDraftBackupBucket,
	type PrivateDraftBackupRecord,
} from "./private-draft-r2-backup";
import {
	getPrivateDraft,
	getPrivateDraftRevision,
	listPrivateDraftRevisions,
	PrivateDraftError,
	type PrivateDraftKV,
	savePrivateDraft,
} from "./private-drafts";

/**
 * The migration freezes writes to the legacy KV, preserves its active record,
 * and copies BOTH KV history and R2-only orphaned snapshots into D1.
 *
 * D1 current rows are only created AFTER historical copy verification.
 * History writes are idempotent, so interrupted migrations can be retried.
 */
const MAX_REVISIONS = 40;

function assertPrivateSnapshot(
	record: PrivateDraftBackupRecord,
	slug: string,
): void {
	if (record.slug !== slug || !/^[0-9a-f-]{36}$/i.test(record.version)) {
		throw new PrivateDraftError("历史草稿身份校验失败，已中止迁移。", 409);
	}
	const frontmatter = record.content.match(
		/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
	);
	if (!frontmatter || !/^draft:\s*true\s*(?:#.*)?$/m.test(frontmatter[1])) {
		throw new PrivateDraftError("历史版本不符合私人草稿格式，拒绝复制。", 409);
	}
	if (record.extension !== "md" && record.extension !== "mdx") {
		throw new PrivateDraftError("历史版本文件类型异常，拒绝复制。", 409);
	}
}

function titleFor(content: string): string {
	const match = content.match(/^title:\s*(.*?)\s*$/m);
	if (!match) return "私人草稿";
	const value = match[1].trim();
	try {
		const parsed: unknown = JSON.parse(value);
		if (typeof parsed === "string") return parsed.slice(0, 100);
	} catch {
		// Keep a plain YAML scalar title.
	}
	return value.replace(/^['"]|['"]$/g, "").slice(0, 100) || "私人草稿";
}

function matches(a: PrivateDraftBackupRecord, b: PrivateDraftBackupRecord) {
	return (
		a.slug === b.slug &&
		a.version === b.version &&
		a.content === b.content &&
		a.extension === b.extension &&
		a.updatedAt === b.updatedAt
	);
}

async function collectVersions(
	source: PrivateDraftKV,
	backup: PrivateDraftBackupBucket,
	slug: string,
): Promise<Map<string, PrivateDraftBackupRecord>> {
	const records = new Map<string, PrivateDraftBackupRecord>();
	const kvCursors = new Set<string>();
	let kvCursor: string | undefined;
	for (let page = 0; page < 5; page++) {
		const response = await listPrivateDraftRevisions(source, slug, kvCursor);
		for (const item of response.items) {
			if (records.size >= MAX_REVISIONS && !records.has(item.version)) {
				throw new PrivateDraftError(
					"单篇文章历史过多，请分批迁移，禁止跳过旧版本。",
					413,
				);
			}
			const record = await getPrivateDraftRevision(source, slug, item.version);
			assertPrivateSnapshot(record, slug);
			const old = records.get(item.version);
			if (old && !matches(old, record)) {
				throw new PrivateDraftError("旧 KV 中有冲突版本，已停止迁移。", 409);
			}
			records.set(item.version, record);
		}
		if (!response.cursor) break;
		if (kvCursors.has(response.cursor) || page === 4) {
			throw new PrivateDraftError("KV 历史分页不完整，拒绝迁移。", 503);
		}
		kvCursors.add(response.cursor);
		kvCursor = response.cursor;
	}
	const r2Cursors = new Set<string>();
	let r2Cursor: string | undefined;
	for (let page = 0; page < 5; page++) {
		const response = await listPrivateR2Backups(backup, slug, r2Cursor);
		if (response.invalidObjectCount > 0) {
			throw new PrivateDraftError("R2 目录含无法识别的历史备份对象，已停止迁移以防遗漏。", 503);
		}
		for (const item of response.items) {
			if (records.size >= MAX_REVISIONS && !records.has(item.version)) {
				throw new PrivateDraftError("R2 历史版本过多，禁止遗漏备份。", 413);
			}
			const record = await getPrivateR2Backup(backup, slug, item.version);
			assertPrivateSnapshot(record, slug);
			const old = records.get(item.version);
			if (old && !matches(old, record)) {
				throw new PrivateDraftError(
					"KV 与 R2 同名版本正文冲突，已停止迁移。",
					409,
				);
			}
			records.set(item.version, record);
		}
		if (!response.cursor) break;
		if (r2Cursors.has(response.cursor) || page === 4) {
			throw new PrivateDraftError("R2 历史分页不完整，拒绝迁移。", 503);
		}
		r2Cursors.add(response.cursor);
		r2Cursor = response.cursor;
	}
	return records;
}

export async function copyPrivateDraftWithHistory(
	source: PrivateDraftKV,
	destination: PrivateDraftKV,
	backup: PrivateDraftBackupBucket,
	slug: string,
	expectedVersion: string,
) {
	const current = await getPrivateDraft(source, slug);
	if (current.version !== expectedVersion) {
		throw new PrivateDraftError("KV 草稿已更新，版本不一致，拒绝迁移。", 409);
	}
	if (await destination.get("draft:v1:" + slug, "text")) {
		throw new PrivateDraftError("D1 已有同名稿，拒绝覆盖或重复迁移。", 409);
	}
	assertPrivateSnapshot(current, slug);
	const histories = await collectVersions(source, backup, slug);
	const prior = histories.get(current.version);
	if (prior && !matches(prior, current)) {
		throw new PrivateDraftError("当前稿与其历史快照不一致，已阻止迁移。", 409);
	}
	histories.set(current.version, current);
	if (histories.size > MAX_REVISIONS) {
		throw new PrivateDraftError("历史版本数量超过安全迁移上限。", 413);
	}
	// Verify every independently stored backup BEFORE committing anything to D1.
	for (const record of histories.values()) {
		await ensurePrivateR2Backup(backup, record);
	}
	// Create revision rows idempotently. D1 rejects same-version different bytes.
	for (const record of histories.values()) {
		const key = "draft-history:v1:" + slug + ":" + record.version;
		await destination.put(key, JSON.stringify(record), {
			metadata: {
				version: record.version,
				extension: record.extension,
				updatedAt: record.updatedAt,
				title: titleFor(record.content),
			},
		});
		const actual = await destination.get(key, "text");
		if (!actual)
			throw new PrivateDraftError("D1 历史记录回读失败，已停止迁移。", 503);
		const parsed: PrivateDraftBackupRecord = JSON.parse(actual);
		if (!matches(record, parsed)) {
			throw new PrivateDraftError("D1 历史版本核对失败，已停止迁移。", 409);
		}
	}
	// One last read makes unexpected writes to legacy KV fail closed.
	const latest = await getPrivateDraft(source, slug);
	if (!matches(current, latest)) {
		throw new PrivateDraftError(
			"迁移期间原 KV 草稿发生变化，已拒绝切换。",
			409,
		);
	}
	const copied = await savePrivateDraft(
		destination,
		{
			slug,
			content: current.content,
			extension: current.extension,
		},
		backup,
	);
	const restored = await getPrivateDraft(destination, slug);
	if (
		restored.content !== current.content ||
		restored.extension !== current.extension ||
		restored.version !== copied.version
	) {
		throw new PrivateDraftError(
			"D1 当前草稿迁移校验失败，旧 KV 原稿保持不动。",
			503,
		);
	}
	return {
		ok: true,
		slug,
		sourceVersion: current.version,
		newVersion: copied.version,
		historyVersionsCopied: histories.size,
		kvSourcePreserved: true,
	};
}
