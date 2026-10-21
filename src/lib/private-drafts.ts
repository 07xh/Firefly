import {
	ensurePrivateR2Backup,
	type PrivateDraftBackupBucket,
} from "./private-draft-r2-backup";

/**
 * Private, admin-only draft storage. No writes from this module go to GitHub.
 *
 * Cloudflare KV is eventually consistent and does not provide atomic compare-and-set.
 * The version check is best-effort; concurrent edits from different regions must be
 * avoided until the storage layer is upgraded to an atomic backend.
 */

export interface PrivateDraftKV {
	get(key: string, type: "text"): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { metadata?: DraftMetadata; expectedVersion?: string | null },
	): Promise<void>;
	delete(key: string, options?: { expectedVersion?: string }): Promise<void>;
	list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{
		keys: Array<{ name: string; metadata?: DraftMetadata }>;
		list_complete: boolean;
		cursor?: string;
	}>;
}

export type DraftMetadata = {
	extension: "md" | "mdx";
	version: string;
	updatedAt: string;
	title: string;
};

type DraftRecord = {
	schema: 1;
	extension: "md" | "mdx";
	slug: string;
	version: string;
	updatedAt: string;
	content: string;
};

export class PrivateDraftError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "PrivateDraftError";
	}
}

const PREFIX = "draft:v1:";
const REVISION_PREFIX = "draft-history:v1:";
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DRAFT_BYTES = 500_000;
const encoder = new TextEncoder();
const validSlug = (slug: string): boolean =>
	/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u.test(slug);

function requireSlug(value: unknown): string {
	if (typeof value !== "string" || !validSlug(value)) {
		throw new PrivateDraftError("草稿文件名格式不合法。", 400);
	}
	return value;
}

function draftKey(slug: string): string {
	return PREFIX + requireSlug(slug);
}

function revisionPrefix(slug: string): string {
	return REVISION_PREFIX + requireSlug(slug) + ":";
}

function revisionKey(slug: string, version: string): string {
	if (!UUID_RE.test(version))
		throw new PrivateDraftError("历史版本编号无效。", 400);
	return revisionPrefix(slug) + version;
}

function validateCursor(cursor?: string): void {
	if (
		cursor &&
		(cursor.length > 1024 || !/^[A-Za-z0-9_+\-/=]+$/.test(cursor))
	) {
		throw new PrivateDraftError("分页参数无效。", 400);
	}
}

function draftTitle(content: string): string {
	const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!frontmatter) return "未命名草稿";
	const match = frontmatter[1].match(/^title:\s*(.*?)\s*$/m);
	if (!match) return "未命名草稿";
	const raw = match[1].trim();
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed === "string") return parsed.slice(0, 100);
	} catch {
		// Support unquoted and simple YAML string titles.
	}
	return raw.slice(0, 100) || "未命名草稿";
}

function requireDraftContent(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new PrivateDraftError("缺少草稿正文。", 400);
	}
	if (encoder.encode(value).byteLength > MAX_DRAFT_BYTES) {
		throw new PrivateDraftError("私人草稿不能超过 500 KB。", 413);
	}
	const frontmatter = value.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!frontmatter || !/^draft:\s*true\s*(?:#.*)?$/m.test(frontmatter[1])) {
		throw new PrivateDraftError("私人草稿必须包含 draft: true 元信息。", 400);
	}
	return value;
}

async function readRecord(
	store: PrivateDraftKV,
	slug: string,
): Promise<DraftRecord | null> {
	const raw = await store.get(draftKey(slug), "text");
	if (raw === null) return null;
	let record: unknown;
	try {
		record = JSON.parse(raw);
	} catch {
		throw new PrivateDraftError(
			"草稿存储数据无法解析，已停止操作以保护原文。",
			500,
		);
	}
	if (
		!record ||
		typeof record !== "object" ||
		!("schema" in record) ||
		record.schema !== 1 ||
		!("slug" in record) ||
		record.slug !== slug ||
		!("version" in record) ||
		typeof record.version !== "string" ||
		!("content" in record) ||
		typeof record.content !== "string" ||
		!("updatedAt" in record) ||
		typeof record.updatedAt !== "string"
	) {
		throw new PrivateDraftError("草稿存储数据不完整，已停止覆盖。", 500);
	}
	const stored = record as DraftRecord;
	return {
		...stored,
		extension: stored.extension === "mdx" ? "mdx" : "md",
	};
}

/** History is stored in the SAME namespace, NOT an independent disaster backup. */
async function ensureRevision(
	store: PrivateDraftKV,
	record: DraftRecord,
): Promise<void> {
	const key = revisionKey(record.slug, record.version);
	const raw = JSON.stringify(record);
	const old = await store.get(key, "text");
	if (old !== null) {
		if (old !== raw)
			throw new PrivateDraftError("历史版本内容冲突；已阻止覆盖旧备份。", 409);
		return;
	}
	await store.put(key, raw, {
		metadata: {
			extension: record.extension,
			version: record.version,
			updatedAt: record.updatedAt,
			title: draftTitle(record.content),
		},
	});
}

export async function listPrivateDraftRevisions(
	store: PrivateDraftKV,
	slug: string,
	cursor?: string,
) {
	validateCursor(cursor);
	const result = await store.list({
		prefix: revisionPrefix(slug),
		limit: 100,
		...(cursor ? { cursor } : {}),
	});
	return {
		slug,
		items: result.keys.map((item) => ({
			version: item.name.slice(revisionPrefix(slug).length),
			updatedAt: item.metadata?.updatedAt ?? "",
			title: item.metadata?.title ?? "私人草稿",
			extension: item.metadata?.extension === "mdx" ? "mdx" : "md",
		})),
		cursor: result.list_complete ? null : result.cursor || null,
	};
}

export async function getPrivateDraftRevision(
	store: PrivateDraftKV,
	slug: string,
	version: string,
): Promise<DraftRecord> {
	const raw = await store.get(revisionKey(slug, version), "text");
	if (raw === null) throw new PrivateDraftError("指定历史版本不存在。", 404);
	let record: unknown;
	try {
		record = JSON.parse(raw);
	} catch {
		throw new PrivateDraftError("历史版本数据损坏；已停止恢复。", 500);
	}
	if (
		!record ||
		typeof record !== "object" ||
		!("schema" in record) ||
		record.schema !== 1 ||
		!("slug" in record) ||
		record.slug !== slug ||
		!("version" in record) ||
		record.version !== version ||
		!("updatedAt" in record) ||
		typeof record.updatedAt !== "string" ||
		!("content" in record) ||
		typeof record.content !== "string"
	) {
		throw new PrivateDraftError("历史版本校验失败；已停止恢复。", 500);
	}
	const stored = record as DraftRecord;
	return { ...stored, extension: stored.extension === "mdx" ? "mdx" : "md" };
}

export async function restorePrivateDraftRevision(
	store: PrivateDraftKV,
	input: { slug: string; revision: string; expectedVersion?: unknown },
	backup?: PrivateDraftBackupBucket,
) {
	const slug = requireSlug(input.slug);
	const source = await getPrivateDraftRevision(store, slug, input.revision);
	// This creates a fresh revision and does not modify the source snapshot.
	return savePrivateDraft(
		store,
		{
			slug,
			content: source.content,
			extension: source.extension,
			expectedVersion: input.expectedVersion,
		},
		backup,
	);
}

export async function getPrivateDraft(store: PrivateDraftKV, slug: string) {
	const record = await readRecord(store, slug);
	if (!record) throw new PrivateDraftError("私人草稿不存在。", 404);
	return record;
}

export async function listPrivateDrafts(
	store: PrivateDraftKV,
	cursor?: string,
) {
	validateCursor(cursor);
	const result = await store.list({
		prefix: PREFIX,
		limit: 100,
		...(cursor ? { cursor } : {}),
	});
	return {
		items: result.keys
			.filter((item) => item.name.startsWith(PREFIX))
			.map((item) => ({
				slug: item.name.slice(PREFIX.length),
				extension: item.metadata?.extension === "mdx" ? "mdx" : "md",
				version: item.metadata?.version ?? "",
				title: item.metadata?.title ?? "私人草稿",
				updatedAt: item.metadata?.updatedAt ?? "",
			})),
		cursor: result.list_complete ? null : result.cursor || null,
	};
}

export async function savePrivateDraft(
	store: PrivateDraftKV,
	input: {
		slug: unknown;
		content: unknown;
		expectedVersion?: unknown;
		extension?: unknown;
	},
	backup?: PrivateDraftBackupBucket,
) {
	const slug = requireSlug(input.slug);
	const content = requireDraftContent(input.content);
	const prior = await readRecord(store, slug);
	if (
		input.extension !== undefined &&
		input.extension !== "md" &&
		input.extension !== "mdx"
	) {
		throw new PrivateDraftError("草稿文件格式仅支持 md 或 mdx。", 400);
	}
	const extension = (input.extension ?? prior?.extension ?? "md") as
		| "md"
		| "mdx";
	const expected = input.expectedVersion;
	if (expected === undefined) {
		if (prior)
			throw new PrivateDraftError(
				"同名私人草稿已存在，请先读取最新版本。",
				409,
			);
	} else if (
		typeof expected !== "string" ||
		!prior ||
		expected !== prior.version
	) {
		throw new PrivateDraftError("私人草稿已被修改，请刷新后比较再保存。", 409);
	}
	const record: DraftRecord = {
		schema: 1,
		slug,
		extension,
		version: crypto.randomUUID(),
		updatedAt: new Date().toISOString(),
		content,
	};
	// Persist immutable revision copies BEFORE touching the mutable current key.
	// On failure the current article remains unchanged; an orphaned new revision
	// remains recoverable. Legacy records receive a snapshot on their first edit.
	if (backup) {
		if (prior) await ensurePrivateR2Backup(backup, prior);
		await ensurePrivateR2Backup(backup, record);
	}
	if (prior) await ensureRevision(store, prior);
	await ensureRevision(store, record);
	await store.put(draftKey(slug), JSON.stringify(record), {
		expectedVersion: prior?.version ?? null,
		metadata: {
			extension,
			version: record.version,
			updatedAt: record.updatedAt,
			title: draftTitle(content),
		},
	});
	return {
		slug,
		extension,
		version: record.version,
		updatedAt: record.updatedAt,
	};
}

export async function deletePrivateDraft(
	store: PrivateDraftKV,
	slug: string,
	expectedVersion: string,
	backup?: PrivateDraftBackupBucket,
) {
	const prior = await readRecord(store, slug);
	if (!prior) throw new PrivateDraftError("私人草稿不存在。", 404);
	if (!expectedVersion || expectedVersion !== prior.version) {
		throw new PrivateDraftError("草稿版本已变化，请刷新后确认删除。", 409);
	}
	if (backup) await ensurePrivateR2Backup(backup, prior);
	await ensureRevision(store, prior);
	await store.delete(draftKey(slug), { expectedVersion: prior.version });
	return { slug, deleted: true, recoveryVersion: prior.version };
}
