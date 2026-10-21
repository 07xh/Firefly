/**
 * Additional private-draft backups in a dedicated, non-public Cloudflare R2 bucket.
 *
 * Write-once keys are derived from the already-validated slug and random
 * revision UUID. R2 is strongly consistent, but it is NOT a transaction with
 * Cloudflare KV and it is NOT an off-account backup.
 */
export interface PrivateDraftBackupBucket {
	get(key: string): Promise<{ text(): Promise<string> } | null>;
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
		!("extension" in input) ||
		(input.extension !== "md" && input.extension !== "mdx") ||
		!("updatedAt" in input) ||
		typeof input.updatedAt !== "string" ||
		!("content" in input) ||
		typeof input.content !== "string" ||
		encoder.encode(input.content).byteLength > 500_000 ||
		!/^---\r?\n[\s\S]*?\r?\n---/.test(input.content)
	) {
		throw new PrivateBackupError("备份内容校验失败，已阻止恢复。", 500);
	}
	return input as PrivateDraftBackupRecord;
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
		content = JSON.parse(await saved.text());
	} catch {
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
	const prior = await bucket.get(key);
	if (prior) {
		if ((await prior.text()) !== raw) {
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
	const confirmedRaw = confirmed ? await confirmed.text() : null;
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
	return {
		slug,
		items: result.objects
			.filter((item) => item.key.startsWith(folder))
			.map((item) => ({
				version: item.key.slice(folder.length).replace(/\.json$/, ""),
				uploadedAt: item.uploaded?.toISOString() ?? "",
			}))
			.filter((item) => VERSION.test(item.version)),
		cursor: result.truncated ? result.cursor || null : null,
	};
}
