import {
	PrivateDraftError,
	type DraftMetadata,
	type PrivateDraftKV,
} from "./private-drafts";

export interface PrivateDraftD1Statement {
	bind(...values: Array<string | number>): {
		first(): Promise<Record<string, unknown> | null>;
		run(): Promise<{ success: boolean; meta: { changes: number } }>;
		all(): Promise<{ results: Array<Record<string, unknown>> }>;
	};
}

export interface PrivateDraftD1Database {
	prepare(sql: string): PrivateDraftD1Statement;
}

type DraftRow = {
	slug: string;
	version: string;
	record: string;
	updated_at: string;
	title: string;
	extension: string;
};

const LIVE_PREFIX = "draft:v1:";
const HISTORY_PREFIX = "draft-history:v1:";
const VERSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u;

function validateSlug(slug: string): string {
	if (!SLUG.test(slug)) throw new PrivateDraftError("D1 草稿文件名不合法。", 400);
	return slug;
}

function decodeHistoryKey(key: string) {
	if (!key.startsWith(HISTORY_PREFIX)) throw new PrivateDraftError("D1 历史版本键格式不正确。", 400);
	const tail = key.slice(HISTORY_PREFIX.length);
	const colon = tail.lastIndexOf(":");
	if (colon <= 0) throw new PrivateDraftError("D1 历史版本键格式不正确。", 400);
	const slug = validateSlug(tail.slice(0, colon));
	const version = tail.slice(colon + 1);
	if (!VERSION.test(version)) throw new PrivateDraftError("D1 历史版本编号无效。", 400);
	return { slug, version };
}

function liveSlug(key: string): string {
	if (!key.startsWith(LIVE_PREFIX)) throw new PrivateDraftError("D1 草稿存储键格式不正确。", 400);
	return validateSlug(key.slice(LIVE_PREFIX.length));
}

function requireMetadata(
	record: string,
	metadata: DraftMetadata | undefined,
	slug: string,
) {
	let parsed: unknown;
	try {
		parsed = JSON.parse(record);
	} catch {
		throw new PrivateDraftError("D1 草稿内容不是合法 JSON。", 400);
	}
	if (
		!metadata ||
		!parsed ||
		typeof parsed !== "object" ||
		!("slug" in parsed) ||
		parsed.slug !== slug ||
		!("version" in parsed) ||
		parsed.version !== metadata.version ||
		!("content" in parsed) ||
		typeof parsed.content !== "string"
	) {
		throw new PrivateDraftError("D1 草稿内容与版本信息不一致。", 400);
	}
	return metadata;
}

function metadataFromRow(row: DraftRow) {
	return {
		version: row.version,
		updatedAt: row.updated_at,
		title: row.title,
		extension: row.extension === "mdx" ? "mdx" as const : "md" as const,
	};
}

function offsetFromCursor(cursor?: string): number {
	if (!cursor) return 0;
	if (!/^(?:0|[1-9][0-9]{0,6})$/.test(cursor)) {
		throw new PrivateDraftError("D1 分页游标不合法。", 400);
	}
	return Number(cursor);
}

/**
 * Strongly-consistent D1 draft record backend. Its UPDATE/DELETE WHERE version
 * is a single SQLite operation, so two concurrent writers cannot both pass.
 * Historical snapshots remain separate rows. R2 writes happen before the call
 * that changes the authoritative live record.
 *
 * Do not activate this adapter until the D1 migration has been applied and
 * every existing KV draft has been explicitly verified and copied into D1.
 */
export function createD1PrivateDraftStore(db: PrivateDraftD1Database): PrivateDraftKV {
	return {
		async get(key: string, type: "text") {
			if (type !== "text") throw new PrivateDraftError("仅支持文本草稿。", 400);
			if (key.startsWith(HISTORY_PREFIX)) {
				const {slug, version} = decodeHistoryKey(key);
				const row = await db.prepare(
					"SELECT record FROM private_draft_revisions WHERE slug = ? AND version = ?",
				).bind(slug, version).first();
				return typeof row?.record === "string" ? row.record : null;
			}
			const slug = liveSlug(key);
			const row = await db.prepare(
				"SELECT record FROM private_drafts WHERE slug = ?",
			).bind(slug).first();
			return typeof row?.record === "string" ? row.record : null;
		},
		async put(key: string, value: string, options) {
			if (key.startsWith(HISTORY_PREFIX)) {
				const { slug, version } = decodeHistoryKey(key);
				const meta = requireMetadata(value, options?.metadata, slug);
				const result = await db.prepare(
					"INSERT INTO private_draft_revisions (slug,version,record,updated_at,title,extension) VALUES (?,?,?,?,?,?) ON CONFLICT(slug,version) DO NOTHING",
				).bind(slug, version, value, meta.updatedAt, meta.title, meta.extension).run();
				if (!result.success) throw new PrivateDraftError("D1 历史版本写入失败。", 503);
				// Read back even after a successful INSERT; this also detects
				// another writer winning an ON CONFLICT DO NOTHING race.
				const confirmed = await db.prepare(
					"SELECT record FROM private_draft_revisions WHERE slug = ? AND version = ?",
				).bind(slug, version).first();
				if (confirmed?.record !== value) throw new PrivateDraftError("历史版本冲突，已拒绝覆盖。", 409);
				return;
			}
			const slug = liveSlug(key);
			const meta = requireMetadata(value, options?.metadata, slug);
			const expected = options?.expectedVersion;
			if (expected === null) {
				const result = await db.prepare(
					"INSERT INTO private_drafts (slug,version,record,updated_at,title,extension) VALUES (?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING",
				).bind(slug, meta.version, value, meta.updatedAt, meta.title, meta.extension).run();
				if (!result.success || result.meta.changes !== 1) {
					throw new PrivateDraftError("草稿已经存在或 D1 创建失败，请刷新文章列表。", 409);
				}
				return;
			}
			if (typeof expected !== "string" || !VERSION.test(expected)) {
				throw new PrivateDraftError("D1 更新必须提供有效的原版本号。", 400);
			}
			const result = await db.prepare(
				"UPDATE private_drafts SET version = ?,record = ?,updated_at = ?,title = ?,extension = ? WHERE slug = ? AND version = ?",
			).bind(meta.version, value, meta.updatedAt, meta.title, meta.extension, slug, expected).run();
			if (!result.success || result.meta.changes !== 1) {
				throw new PrivateDraftError("其他编辑会话已更新草稿，D1 拒绝旧版本覆盖。", 409);
			}
		},
		async delete(key: string, options) {
			const slug = liveSlug(key);
			const expected = options?.expectedVersion;
			if (!expected || !VERSION.test(expected)) {
				throw new PrivateDraftError("D1 删除必须提供有效的原版本号。", 400);
			}
			const result = await db.prepare(
				"DELETE FROM private_drafts WHERE slug = ? AND version = ?",
			).bind(slug, expected).run();
			if (!result.success || result.meta.changes !== 1) {
				throw new PrivateDraftError("草稿版本已变化，D1 拒绝删除。", 409);
			}
		},
		async list({ prefix, cursor, limit }) {
			const offset = offsetFromCursor(cursor);
			const size = Math.max(1, Math.min(limit ?? 100, 100));
			let rows: Array<Record<string, unknown>>;
			if (prefix === LIVE_PREFIX) {
				const result = await db.prepare(
					"SELECT slug,version,updated_at,title,extension FROM private_drafts ORDER BY slug LIMIT ? OFFSET ?",
				).bind(size + 1, offset).all();
				rows = result.results;
			} else if (prefix.startsWith(HISTORY_PREFIX) && prefix.endsWith(":")) {
				const slug = validateSlug(prefix.slice(HISTORY_PREFIX.length, -1));
				const result = await db.prepare(
					"SELECT slug,version,updated_at,title,extension FROM private_draft_revisions WHERE slug = ? ORDER BY updated_at DESC,version DESC LIMIT ? OFFSET ?",
				).bind(slug, size + 1, offset).all();
				rows = result.results;
			} else {
				throw new PrivateDraftError("D1 不支持此列表前缀。", 400);
			}
			const truncated = rows.length > size;
			return {
				keys: (rows.slice(0, size) as DraftRow[]).map((row) => ({
					name: prefix === LIVE_PREFIX
						? LIVE_PREFIX + row.slug
						: HISTORY_PREFIX + row.slug + ":" + row.version,
					metadata: metadataFromRow(row),
				})),
				list_complete: !truncated,
				cursor: truncated ? String(offset + size) : undefined,
			};
		},
	};
}
