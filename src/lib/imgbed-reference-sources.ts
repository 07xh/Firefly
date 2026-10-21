import type { ImgBedReferenceSource } from "./imgbed-reference-guard";

export type ImageReferenceRuntime = {
	FIREFLY_CONTENTS_TOKEN?: string;
	GITHUB_CONTENTS_REPO?: string;
	GITHUB_CONTENTS_BRANCH?: string;
	FIREFLY_PRIVATE_DRAFT_BACKEND?: string;
	FIREFLY_PRIVATE_DRAFT_DB?: {
		prepare(query: string): {
			bind(...values: number[]): {
				all(): Promise<{ results: Array<{ slug: string; version: string; record: string }> }>;
			};
		};
	};
	FIREFLY_PRIVATE_DRAFTS?: {
		list(options: { prefix: string; cursor?: string; limit: number }): Promise<{
			keys: Array<{ name: string }>;
			list_complete: boolean;
			cursor?: string;
		}>;
		get(key: string, type: "text"): Promise<string | null>;
	};
	FIREFLY_PRIVATE_DRAFT_BACKUPS?: {
		list(options: { prefix: string; cursor?: string; limit: number }): Promise<{
			objects: Array<{ key: string }>;
			truncated: boolean;
			cursor?: string;
		}>;
		get(key: string): Promise<{ text(): Promise<string> } | null>;
	};
};

const ARTICLES_ROOT = "src/content/posts/";
const MAX_POSTS = 200;
const MAX_SNAPSHOTS = 500;

function safeRepo(value: string): boolean {
	return /^[\w.-]+\/[\w.-]+$/.test(value);
}

function decodeBase64(raw: string): string {
	const binary = atob(raw.replace(/\s/g, ""));
	return new TextDecoder().decode(
		Uint8Array.from(binary, (char) => char.charCodeAt(0)),
	);
}

async function publicArticles(runtime: ImageReferenceRuntime) {
	const token = runtime.FIREFLY_CONTENTS_TOKEN?.trim();
	if (!token)
		throw new Error("无法检查 GitHub 文章引用：缺少服务端 GitHub 令牌。");
	const repo = runtime.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
	const branch = runtime.GITHUB_CONTENTS_BRANCH?.trim() || "master";
	if (!safeRepo(repo) || !/^[\w./-]{1,100}$/.test(branch)) {
		throw new Error("GitHub 仓库配置格式无效，不能安全检查图片引用。");
	}
	const headers = {
		Authorization: "Bearer " + token,
		Accept: "application/vnd.github+json",
		"User-Agent": "Firefly-Admin/1.0",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const treeResponse = await fetch(
		"https://api.github.com/repos/" +
			repo +
			"/git/trees/" +
			encodeURIComponent(branch) +
			"?recursive=1",
		{ headers },
	);
	if (!treeResponse.ok)
		throw new Error("GitHub 文章目录读取失败，禁止删除图片。");
	const tree = (await treeResponse.json()) as {
		tree?: Array<{ type: string; path: string }>;
		truncated?: boolean;
	};
	if (tree.truncated || !Array.isArray(tree.tree)) {
		throw new Error("GitHub 文章目录不完整，无法安全确认图片引用。");
	}
	const paths = tree.tree
		.filter(
			(x) =>
				x.type === "blob" &&
				x.path.startsWith(ARTICLES_ROOT) &&
				/\.mdx?$/i.test(x.path),
		)
		.map((x) => x.path);
	if (paths.length > MAX_POSTS) {
		throw new Error("文章数量超过当前删除引用检查上限，已停止删除。");
	}
	const contents: Array<{ path: string; content: string }> = new Array(
		paths.length,
	);
	let next = 0;
	async function reader() {
		while (next < paths.length) {
			const i = next++;
			const path = paths[i];
			const url =
				"https://api.github.com/repos/" +
				repo +
				"/contents/" +
				path.split("/").map(encodeURIComponent).join("/") +
				"?ref=" +
				encodeURIComponent(branch);
			const result = await fetch(url, { headers });
			if (!result.ok)
				throw new Error("文章原文读取不完整，无法确认是否引用图片。");
			const data = (await result.json()) as {
				content?: string;
				encoding?: string;
			};
			if (typeof data.content !== "string" || data.encoding !== "base64") {
				throw new Error("GitHub 文章内容格式异常，禁止删除图片。");
			}
			contents[i] = { path, content: decodeBase64(data.content) };
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(5, paths.length) }, () => reader()),
	);
	return contents;
}

async function kvDrafts(runtime: ImageReferenceRuntime) {
	const backend = runtime.FIREFLY_PRIVATE_DRAFT_BACKEND?.trim() || "kv";
	if (backend !== "kv" && backend !== "d1") {
		throw new Error("无法确定私人草稿存储模式，禁止删除图片。");
	}
	const kv = runtime.FIREFLY_PRIVATE_DRAFTS;
	// A D1 migration may keep the old KV as a recovery source. Scan it too.
	if (!kv && backend === "kv") {
		throw new Error("私人草稿 KV 未绑定，无法证明图床文件未被使用。");
	}
	if (!kv) return [];
	const entries: Array<{ path: string; content: string }> = [];
	for (const prefix of ["draft:v1:", "draft-history:v1:"]) {
		let cursor: string | undefined;
		const seen = new Set<string>();
		for (let page = 0; page < 20; page++) {
			const listing = await kv.list({
				prefix,
				limit: 100,
				...(cursor ? { cursor } : {}),
			});
			if (entries.length + listing.keys.length > MAX_SNAPSHOTS) {
				throw new Error("私人草稿历史数量超过安全检查上限，已保护性禁止删除。");
			}
			for (const item of listing.keys) {
				const raw = await kv.get(item.name, "text");
				if (!raw)
					throw new Error("私人草稿历史数据读取不完整，已阻止图片删除。");
				let record: { content?: unknown };
				try {
					record = JSON.parse(raw);
				} catch {
					throw new Error("私人草稿历史数据损坏，禁止删除图片。");
				}
				if (typeof record.content !== "string") {
					throw new Error("私人草稿历史内容缺失，禁止删除图片。");
				}
				entries.push({ path: item.name, content: record.content });
			}
			if (listing.list_complete) break;
			if (!listing.cursor || seen.has(listing.cursor) || page === 19) {
				throw new Error("私人草稿历史分页异常，禁止删除图片。");
			}
			seen.add(listing.cursor);
			cursor = listing.cursor;
		}
	}
	return entries;
}

async function r2Archives(runtime: ImageReferenceRuntime) {
	const bucket = runtime.FIREFLY_PRIVATE_DRAFT_BACKUPS;
	if (!bucket) throw new Error("R2 私人备份未绑定，无法确认图片历史引用，已拒绝删除。");
	const entries: Array<{ path: string; content: string }> = [];
	let cursor: string | undefined;
	const seen = new Set<string>();
	for (let page = 0; page < 20; page++) {
		const pageResult = await bucket.list({
			prefix: "private-draft-backups/v1/",
			limit: 100,
			...(cursor ? { cursor } : {}),
		});
		if (entries.length + pageResult.objects.length > MAX_SNAPSHOTS) {
			throw new Error("私人 R2 备份数量超过安全检查上限，禁止删除图床图片。");
		}
		for (const object of pageResult.objects) {
			const saved = await bucket.get(object.key);
			if (!saved) throw new Error("R2 历史备份读取失败，禁止删除图床文件。");
			let record: { content?: unknown };
			try {
				record = JSON.parse(await saved.text());
			} catch {
				throw new Error("R2 备份数据异常，禁止删除图床文件。");
			}
			if (typeof record.content !== "string") {
				throw new Error("R2 备份缺少正文，禁止删除图床文件。");
			}
			entries.push({ path: object.key, content: record.content });
		}
		if (!pageResult.truncated) break;
		if (!pageResult.cursor || seen.has(pageResult.cursor) || page === 19) {
			throw new Error("R2 备份分页异常，禁止删除图床文件。");
		}
		seen.add(pageResult.cursor);
		cursor = pageResult.cursor;
	}
	return entries;
}


async function d1Drafts(runtime: ImageReferenceRuntime) {
	const backend = runtime.FIREFLY_PRIVATE_DRAFT_BACKEND?.trim() || "kv";
	if (backend === "kv") return [];
	if (backend !== "d1") throw new Error("未知私人草稿后端，禁止删除图片。");
	const db = runtime.FIREFLY_PRIVATE_DRAFT_DB;
	if (!db) throw new Error("D1 私人草稿数据库未绑定，禁止删除图片。");
	const documents: Array<{ path: string; content: string }> = [];
	for (const table of ["private_drafts", "private_draft_revisions"]) {
		let offset = 0;
		for (;;) {
			const result = await db.prepare(
				"SELECT slug,version,record FROM " + table +
					" ORDER BY slug,version LIMIT ? OFFSET ?",
			).bind(101, offset).all();
			if (!Array.isArray(result.results)) {
				throw new Error("D1 草稿查询结果不完整，已禁止图片删除。");
			}
			if (documents.length + result.results.length > MAX_SNAPSHOTS) {
				throw new Error("D1 草稿或历史版本数量超过引用检查上限。");
			}
			for (const row of result.results) {
				let value: unknown;
				try { value = JSON.parse(row.record); }
				catch { throw new Error("D1 草稿历史记录损坏，禁止删除图片。"); }
				if (
					!value || typeof value !== "object" ||
					!("content" in value) || typeof value.content !== "string" ||
					!("slug" in value) || value.slug !== row.slug ||
					!("version" in value) || value.version !== row.version
				) {
					throw new Error("D1 草稿版本校验失败，禁止删除图片。");
				}
				documents.push({
					path: "d1:" + table + ":" + row.slug + ":" + row.version,
					content: value.content,
				});
			}
			if (result.results.length < 101) break;
			offset += result.results.length;
			if (offset > MAX_SNAPSHOTS) {
				throw new Error("D1 草稿分页上限已达到，禁止删除图片。");
			}
		}
	}
	return documents;
}

export function createImgBedReferenceSources(
	runtime: ImageReferenceRuntime,
): ImgBedReferenceSource {
	return {
		listArticles: () => publicArticles(runtime),
		async listPrivateDrafts() {
			const [drafts, archives, database] = await Promise.all([
				kvDrafts(runtime),
				r2Archives(runtime),
				d1Drafts(runtime),
			]);
			return drafts.concat(archives, database);
		},
	};
}
