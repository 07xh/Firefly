/**
 * Additional private-draft backups in a dedicated, non-public Cloudflare R2 bucket.
 *
 * Write-once keys are derived from the already-validated slug and random
 * revision UUID. R2 is strongly consistent, but it is NOT a transaction with
 * Cloudflare KV and it is NOT an off-account backup.
 */
export interface PrivateDraftBackupBucket {
	get(key: string): Promise<{ text(): Promise<string>; size?: number } | null>;
	put(
		key: string,
		value: string,
		options?: { onlyIf: { etagDoesNotMatch: string } },
	): Promise<unknown>;
	list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{
		objects: Array<{ key: string; uploaded?: Date }>;
		truncated: boolean;
		cursor?: string;
	}>;
}

export type PrivateDraftBackupRecord = {
	schema: 1;
	slug: string;
	version: string;
	extension: "md" | "mdx";
	updatedAt: string;
	content: string;
};

const PREFIX = "private-draft-backups/v1/";
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u;
const VERSION =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
const MAX_BACKUP_OBJECT_BYTES = 1_200_000;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export class PrivateBackupError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "PrivateBackupError";
	}
}

function requireSlug(slug: string): string {
	if (!SLUG.test(slug)) throw new PrivateBackupError("备份文件名不合法。", 400);
	return slug;
}

function requireVersion(version: string): string {
	if (!VERSION.test(version))
		throw new PrivateBackupError("备份版本号不合法。", 400);
	return version;
}

function prefix(slug: string): string {
	return PREFIX + encodeURIComponent(requireSlug(slug)) + "/";
}

export function privateBackupKey(slug: string, version: string): string {
	return prefix(slug) + requireVersion(version) + ".json";
}

export function validatePrivateBackupRecord(
	input: unknown,
	slug: string,
	version: string,
): PrivateDraftBackupRecord {
	if (
		!input ||
		typeof input !== "object" ||
		!("schema" in input) ||
		input.schema !== 1 ||
		!("slug" in input) ||
		input.slug !== slug ||
		!("version" in input) ||
		input.version !== version ||
		!VERSION.test(version) ||
		!("extension" in input) ||
		(input.extension !== "md" && input.extension !== "mdx") ||
		!("updatedAt" in input) ||
		typeof input.updatedAt !== "string" ||
		!ISO_INSTANT.test(input.updatedAt) ||
		!Number.isFinite(Date.parse(input.updatedAt)) ||
		!("content" in input) ||
		typeof input.content !== "string" ||
		encoder.encode(input.content).byteLength > 500_000 ||
		!/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.test(input.content) ||
		!/^draft:\s*true\s*(?:#.*)?$/m.test(
			input.content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "",
		)
	) {
		throw new PrivateBackupError("备份内容校验失败，已阻止恢复。", 500);
	}
	return input as PrivateDraftBackupRecord;
}

async function readBoundedBackupText(object: {
	text(): Promise<string>;
	size?: number;
}): Promise<string> {
	if (
		object.size !== undefined &&
		(!Number.isSafeInteger(object.size) ||
			object.size > MAX_BACKUP_OBJECT_BYTES)
	) {
		throw new PrivateBackupError(
			"R2 备份对象过大或文件大小异常，已阻止恢复。",
			500,
		);
	}
	const raw = await object.text();
	if (encoder.encode(raw).byteLength > MAX_BACKUP_OBJECT_BYTES) {
		throw new PrivateBackupError("R2 备份对象过大，已阻止恢复。", 500);
	}
	return raw;
}

export async function getPrivateR2Backup(
	bucket: PrivateDraftBackupBucket,
	slug: string,
	version: string,
): Promise<PrivateDraftBackupRecord> {
	const key = privateBackupKey(slug, version);
	const saved = await bucket.get(key);
	if (!saved) throw new PrivateBackupError("此 R2 备份版本不存在。", 404);
	let content: unknown;
	try {
		content = JSON.parse(await readBoundedBackupText(saved));
	} catch (error) {
		if (error instanceof PrivateBackupError) throw error;
		throw new PrivateBackupError("R2 备份文件损坏，已停止恢复。", 500);
	}
	return validatePrivateBackupRecord(content, slug, version);
}

export async function ensurePrivateR2Backup(
	bucket: PrivateDraftBackupBucket,
	record: PrivateDraftBackupRecord,
): Promise<void> {
	const key = privateBackupKey(record.slug, record.version);
	validatePrivateBackupRecord(record, record.slug, record.version);
	const raw = JSON.stringify(record);
	if (encoder.encode(raw).byteLength > MAX_BACKUP_OBJECT_BYTES) {
		throw new PrivateBackupError(
			"私人 R2 备份文件超过允许大小，未执行写入。",
			413,
		);
	}
	const prior = await bucket.get(key);
	if (prior) {
		if ((await readBoundedBackupText(prior)) !== raw) {
			throw new PrivateBackupError("R2 历史备份内容冲突，已停止覆盖。", 409);
		}
		return;
	}
	// An atomic create-if-absent is required. A plain get-then-put sequence
	// would allow competing requests to overwrite the same "immutable" snapshot.
	const created = await bucket.put(key, raw, {
		onlyIf: { etagDoesNotMatch: "*" },
	});
	// Cloudflare R2 conditional put returns null when another writer won.
	// Verify the winner has exactly the expected bytes; never overwrite it.
	const confirmed = await bucket.get(key);
	const confirmedRaw = confirmed
		? await readBoundedBackupText(confirmed)
		: null;
	if (created === null && confirmedRaw !== null && confirmedRaw !== raw) {
		throw new PrivateBackupError(
			"历史备份已被并发操作写入不同内容，拒绝覆盖。",
			409,
		);
	}
	if (confirmedRaw !== raw) {
		throw new PrivateBackupError("R2 备份未能验证，已阻止修改当前草稿。", 503);
	}
}

export async function listPrivateR2Backups(
	bucket: PrivateDraftBackupBucket,
	slug: string,
	cursor?: string,
) {
	if (
		cursor &&
		(cursor.length > 1024 || !/^[A-Za-z0-9_+\-/=]+$/.test(cursor))
	) {
		throw new PrivateBackupError("备份分页参数无效。", 400);
	}
	const folder = prefix(slug);
	const result = await bucket.list({
		prefix: folder,
		limit: 100,
		...(cursor ? { cursor } : {}),
	});
	if (!Array.isArray(result.objects) || typeof result.truncated !== "boolean") {
		throw new PrivateBackupError(
			"R2 备份列表格式异常，无法确认是否完整。",
			503,
		);
	}
	if (
		result.truncated &&
		(typeof result.cursor !== "string" ||
			!result.cursor ||
			result.cursor === cursor)
	) {
		throw new PrivateBackupError(
			"R2 备份分页缺少有效游标，已拒绝遗漏历史。",
			503,
		);
	}
	const items: Array<{ version: string; uploadedAt: string }> = [];
	let invalidObjectCount = 0;
	for (const item of result.objects) {
		const key = item?.key;
		if (typeof key !== "string" || !key.startsWith(folder)) {
			invalidObjectCount++;
			continue;
		}
		const tail = key.slice(folder.length);
		if (!tail.endsWith(".json") || !VERSION.test(tail.slice(0, -5))) {
			// Never silently omit an unexpected key while claiming all
			// historical backup versions were checked.
			invalidObjectCount++;
			continue;
		}
		items.push({
			version: tail.slice(0, -5),
			uploadedAt: item.uploaded?.toISOString() ?? "",
		});
	}
	return {
		slug,
		items,
		invalidObjectCount,
		cursor: result.truncated ? result.cursor : null,
	};
}
