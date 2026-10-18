import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

type RuntimeEnv = {
	FIREFLY_CONTENTS_TOKEN?: string;
	GITHUB_CONTENTS_REPO?: string;
	GITHUB_CONTENTS_BRANCH?: string;
};

type GitHubEntry = {
	path: string;
	sha: string;
	type: string;
	url?: string;
};

export const prerender = false;

const ROOT = "src/content/posts/";
const headers = (token: string) => ({
	Accept: "application/vnd.github+json",
	Authorization: `Bearer ${token}`,
	"X-GitHub-Api-Version": "2022-11-28",
	"Content-Type": "application/json",
});

function getConfig(): { token: string; repo: string; branch: string } {
	const env = workerEnv as unknown as RuntimeEnv;
	const token = env?.FIREFLY_CONTENTS_TOKEN?.trim();
	const repo = env?.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
	const branch = env?.GITHUB_CONTENTS_BRANCH?.trim() || "master";
	if (!token) throw new Error("FIREFLY_CONTENTS_TOKEN is not configured");
	if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid repository configuration");
	return { token, repo, branch };
}


async function githubFailure(response: Response, operation: string): Promise<string> {
	let message = "";
	try {
		const payload = (await response.clone().json()) as { message?: unknown };
		if (typeof payload.message === "string") {
			message = payload.message.replace(/\s+/g, " ").trim().slice(0, 240);
		}
	} catch {
		// GitHub may return a non-JSON error body; keep the HTTP status either way.
	}
	return `${operation} (${response.status})${message ? `：${message}` : ""}`;
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
	});
}

function safeSlug(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const slug = value.trim();
	return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(slug) ? slug : null;
}

function encodeBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

function decodeBase64(value: string): string {
	const binary = atob(value.replace(/\n/g, ""));
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function scalar(value: string): string {
	return JSON.stringify(value);
}

function makeMarkdown(input: Record<string, unknown>): string | null {
	const title = typeof input.title === "string" ? input.title.trim() : "";
	const body = typeof input.body === "string" ? input.body : "";
	const published = typeof input.published === "string" ? input.published : "";
	if (!title || title.length > 200 || body.length > 500_000 || !/^\d{4}-\d{2}-\d{2}$/.test(published)) return null;
	const date = new Date(`${published}T00:00:00Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== published) return null;
	const description = typeof input.description === "string" ? input.description.slice(0, 500) : "";
	const category = typeof input.category === "string" ? input.category.slice(0, 100) : "";
	const draft = input.draft === true;
	const tags = Array.isArray(input.tags)
		? input.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20).map((tag) => tag.slice(0, 50))
		: [];
	const frontmatter = [
		"---",
		`title: ${scalar(title)}`,
		`published: ${published}`,
		`description: ${scalar(description)}`,
		`category: ${scalar(category)}`,
		`draft: ${draft}`,
		`tags: ${JSON.stringify(tags)}`,
		`slug: ${scalar(String(input.slug ?? ""))}`,
		"---",
		"",
	];
	return frontmatter.join("\n") + body.replace(/^\s+/, "") + (body.endsWith("\n") || body.length === 0 ? "" : "\n");
}

async function github(path: string, config: ReturnType<typeof getConfig>, init?: RequestInit): Promise<Response> {
	return fetch(`https://api.github.com/repos/${config.repo}/${path}`, {
		...init,
		headers: { ...headers(config.token), ...(init?.headers ?? {}) },
	});
}

async function findPostFiles(config: ReturnType<typeof getConfig>): Promise<GitHubEntry[]> {
	const response = await github(`git/trees/${encodeURIComponent(config.branch)}?recursive=1`, config);
	if (!response.ok) throw new Error(await githubFailure(response, "读取 GitHub 文章列表失败"));
	const data = (await response.json()) as { tree?: GitHubEntry[]; truncated?: boolean };
	if (data.truncated) throw new Error("Repository tree is truncated; refusing an incomplete article list");
	return (data.tree ?? []).filter((entry) =>
		entry.type === "blob" &&
		entry.path.startsWith(ROOT) &&
		/^src\/content\/posts\/(?:[\w-]+\/)*[\w-]+\.mdx?$/.test(entry.path),
	);
}

async function readPost(path: string, config: ReturnType<typeof getConfig>): Promise<{ path: string; sha: string; content: string }> {
	if (!path.startsWith(ROOT) || !/^src\/content\/posts\/(?:[\w-]+\/)*[\w-]+\.mdx?$/.test(path)) {
		throw new Error("Invalid article path");
	}
	const response = await github(`contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(config.branch)}`, config);
	if (!response.ok) throw new Error(await githubFailure(response, "读取 GitHub 文章失败"));
	const file = (await response.json()) as { sha: string; content: string; encoding: string; path: string };
	return { path: file.path, sha: file.sha, content: file.encoding === "base64" ? decodeBase64(file.content) : file.content };
}

export const GET: APIRoute = async () => {
	try {
		const config = getConfig();
		const files = await findPostFiles(config);
		const posts = await Promise.all(files.map(async (file) => {
			try {
				const post = await readPost(file.path, config);
				const match = post.content.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|(.+))\s*$/m);
				const date = post.content.match(/^published:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
				return { path: post.path, sha: post.sha, content: post.content, title: (match?.[1] ?? match?.[2] ?? match?.[3] ?? file.path.split("/").pop() ?? "").trim(), published: date?.[1] ?? "", draft: /^draft:\s*true\s*$/m.test(post.content) };
			} catch {
				return { path: file.path, sha: file.sha, title: file.path.split("/").pop() ?? file.path, published: "", draft: false };
			}
		}));
		return json(posts.sort((a, b) => b.published.localeCompare(a.published)));
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "Internal error" }, 503);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const config = getConfig();
		const input = (await request.json()) as Record<string, unknown>;
		const slug = safeSlug(input.slug);
		const extension = input.extension === "mdx" ? "mdx" : "md";
		if (!slug) return json({ error: "slug 仅允许字母、数字、连字符和下划线" }, 400);
		const path = `${ROOT}${slug}.${extension}`;
		const content = makeMarkdown({ ...input, slug });
		if (!content) return json({ error: "标题、发布日期或正文格式不合法" }, 400);
		const response = await github(`contents/${path}`, config, {
			method: "PUT",
			body: JSON.stringify({ message: `Add article: ${slug}`, content: encodeBase64(content), branch: config.branch }),
		});
		if (response.status === 422) return json({ error: "同名文章已存在" }, 409);
		if (!response.ok) return json({ error: await githubFailure(response, "GitHub 写入失败") }, 502);
		const written = (await response.json()) as { commit?: { sha?: string; html_url?: string } };
		return json({ ok: true, path, commitSha: written.commit?.sha, commitUrl: written.commit?.html_url }, 201);
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "Internal error" }, 503);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	try {
		const config = getConfig();
		const input = (await request.json()) as Record<string, unknown>;
		const path = typeof input.path === "string" ? input.path : "";
		if (!path.startsWith(ROOT) || !/^src\/content\/posts\/(?:[\w-]+\/)*[\w-]+\.mdx?$/.test(path)) return json({ error: "文章路径不合法" }, 400);
		const current = await readPost(path, config);
		if (typeof input.sha !== "string" || input.sha !== current.sha) return json({ error: "文章已被其他操作修改，请刷新后重试" }, 409);
		const slug = path.split("/").pop()?.replace(/\.mdx?$/, "") ?? "";
		let content = typeof input.rawContent === "string" ? input.rawContent : makeMarkdown({ ...input, slug });
		if (!content || content.length > 500_000 || (typeof input.rawContent === "string" && !content.startsWith("---\n"))) {
			return json({ error: "完整文章内容不合法或超过 500 KB" }, 400);
		}
		if (typeof input.draft === "boolean" && typeof input.rawContent === "string") {
			const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
			if (!frontmatter) return json({ error: "未找到有效的 frontmatter，无法切换草稿/发布状态" }, 400);
			const updatedFrontmatter = /^draft:\s*(?:true|false)\s*$/m.test(frontmatter[1])
				? frontmatter[1].replace(/^draft:\s*(?:true|false)\s*$/m, `draft: ${input.draft}`)
				: `${frontmatter[1]}\ndraft: ${input.draft}`;
			content = content.replace(frontmatter[0], `---\n${updatedFrontmatter}\n---`);
		}
		const response = await github(`contents/${path.split("/").map(encodeURIComponent).join("/")}`, config, {
			method: "PUT",
			body: JSON.stringify({ message: `Update article: ${slug}`, content: encodeBase64(content), sha: current.sha, branch: config.branch }),
		});
		if (!response.ok) return json({ error: await githubFailure(response, "GitHub 更新失败") }, 502);
		const written = (await response.json()) as { commit?: { sha?: string; html_url?: string } };
		return json({ ok: true, path, commitSha: written.commit?.sha, commitUrl: written.commit?.html_url });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "Internal error" }, 503);
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	try {
		const config = getConfig();
		const input = (await request.json()) as Record<string, unknown>;
		const path = typeof input.path === "string" ? input.path : "";
		if (!path.startsWith(ROOT) || !/^src\/content\/posts\/(?:[\w-]+\/)*[\w-]+\.mdx?$/.test(path)) return json({ error: "文章路径不合法" }, 400);
		const current = await readPost(path, config);
		if (typeof input.sha !== "string" || input.sha !== current.sha) return json({ error: "文章已被其他操作修改，请刷新后重试" }, 409);
		const response = await github(`contents/${path.split("/").map(encodeURIComponent).join("/")}`, config, {
			method: "DELETE",
			body: JSON.stringify({ message: `Delete article: ${path.split("/").pop()}`, sha: current.sha, branch: config.branch }),
		});
		if (!response.ok) return json({ error: await githubFailure(response, "GitHub 删除失败") }, 502);
		return json({ ok: true, path });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "Internal error" }, 503);
	}
};
