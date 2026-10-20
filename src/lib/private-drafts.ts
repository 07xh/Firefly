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
		options?: { metadata?: DraftMetadata },
	): Promise<void>;
	delete(key: string): Promise<void>;
	list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{
		keys: Array<{ name: string; metadata?: DraftMetadata }>;
		list_complete: boolean;
		cursor?: string;
	}>;
}

export type DraftMetadata = {
	version: string;
	updatedAt: string;
	title: string;
};

type DraftRecord = {
	schema: 1;
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
	return record as DraftRecord;
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
	if (
		cursor &&
		(cursor.length > 1024 || !/^[A-Za-z0-9_+\-/=]+$/.test(cursor))
	) {
		throw new PrivateDraftError("分页参数无效。", 400);
	}
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
				version: item.metadata?.version ?? "",
				title: item.metadata?.title ?? "私人草稿",
				updatedAt: item.metadata?.updatedAt ?? "",
			})),
		cursor: result.list_complete ? null : result.cursor || null,
	};
}

export async function savePrivateDraft(
	store: PrivateDraftKV,
	input: { slug: unknown; content: unknown; expectedVersion?: unknown },
) {
	const slug = requireSlug(input.slug);
	const content = requireDraftContent(input.content);
	const prior = await readRecord(store, slug);
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
		version: crypto.randomUUID(),
		updatedAt: new Date().toISOString(),
		content,
	};
	// Existing values remain untouched until KV confirms a successful write.
	await store.put(draftKey(slug), JSON.stringify(record), {
		metadata: {
			version: record.version,
			updatedAt: record.updatedAt,
			title: draftTitle(content),
		},
	});
	return { slug, version: record.version, updatedAt: record.updatedAt };
}

export async function deletePrivateDraft(
	store: PrivateDraftKV,
	slug: string,
	expectedVersion: string,
) {
	const prior = await readRecord(store, slug);
	if (!prior) throw new PrivateDraftError("私人草稿不存在。", 404);
	if (!expectedVersion || expectedVersion !== prior.version) {
		throw new PrivateDraftError("草稿版本已变化，请刷新后确认删除。", 409);
	}
	await store.delete(draftKey(slug));
	return { slug, deleted: true };
}
