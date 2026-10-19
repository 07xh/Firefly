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
	"User-Agent": "Firefly-Admin/1.0 (https://github.com/07xh/Firefly)",
	Authorization: `Bearer ${token}`,
	"X-GitHub-Api-Version": "2022-11-28",
	"Content-Type": "application/json",
});

function getConfig(): { token: string; repo: string; branch: string } {
	const env = workerEnv as unknown as RuntimeEnv;
	const token = env?.FIREFLY_CONTENTS_TOKEN?.trim();
	const repo = env?.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
	const branch = env?.GITHUB_CONTENTS_BRANCH?.trim() || "master";
	if (!token) throw new Error("文章保存功能尚未完成配置，请检查后台设置。");
	if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("文章保存位置设置不正确，请检查后台配置。");
	return { token, repo, branch };
}

function githubFailure(response: Response, operation: string): string {
	const status = response.status;
	if (status === 401 || status === 403) {
		return `${operation}时遇到权限问题。请检查文章保存设置后重试。`;
	}
	if (status === 404) {
		return `${operation}时没有找到文章或保存位置。请刷新文章列表后重试。`;
	}
	if (status === 409 || status === 422) {
		return `${operation}时发现文章可能已被更新，或同名文章已经存在。请刷新列表确认后再试。`;
	}
	if (status === 429) {
		return `${operation}请求过于频繁，请稍等片刻再试。`;
	}
	return `${operation}暂时没有完成，请稍后重试。（错误代码 ${status}）`;
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
	return /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u.test(slug) ? slug : null;
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

function replaceFrontmatterField(frontmatter: string, key: string, value: string): string {
	const line = new RegExp("^" + key + ":.*$", "m");
	const replacement = key + ": " + value;
	return line.test(frontmatter) ? frontmatter.replace(line, replacement) : frontmatter + "\n" + replacement;
}

function updateFrontmatterField(content: string, key: string, value: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) throw new Error("没有找到有效的文章信息区，无法保存标题、日期等信息");
	const updated = replaceFrontmatterField(match[1], key, value);
	return content.replace(match[0], "---\n" + updated + "\n---");
}

function removeFrontmatterField(content: string, key: string): string {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) throw new Error("没有找到有效的文章信息区，无法保存标题、日期等信息");
	const field = new RegExp("^" + key + ":\\s*.*$", "m");
	const updated = match[1].split(/\r?\n/).filter((line) => !field.test(line)).join("\n");
	return content.replace(match[0], "---\n" + updated + "\n---");
}


function frontmatterText(content: string, key: string): string {
	const match = content.match(new RegExp("^" + key + ":\\s*(.*?)\\s*$", "m"));
	if (!match) return "";
	const raw = match[1].trim();
	try {
		const parsed = JSON.parse(raw) as unknown;
		return typeof parsed === "string" ? parsed : "";
	} catch {
		return raw.replace(/^['"]|['"]$/g, "");
	}
}

function frontmatterTags(content: string): string[] {
	const match = content.match(/^tags:\s*(.*?)\s*$/m);
	if (!match) return [];
	const raw = match[1].trim();
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (Array.isArray(parsed)) {
			return [...new Set(parsed.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))];
		}
	} catch {
		// Also support common YAML list forms such as [tech, notes].
	}
	return [...new Set(raw.replace(/^\[|\]$/g, "").split(",").map((tag) => tag.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean))];
}

function validDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(value + "T00:00:00Z");
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validScheduleDate(value: unknown): value is string {
	if (value === "" || value === undefined || value === null) return true;
	if (typeof value !== "string" || value.length > 40) return false;
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
	return Number.isFinite(Date.parse(value));
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
	const scheduleDate = typeof input.date === "string" ? input.date.trim() : "";
	const password = typeof input.password === "string" ? input.password : "";
	const passwordHint = typeof input.passwordHint === "string" ? input.passwordHint.slice(0, 120) : "";
	if (!validScheduleDate(scheduleDate) || password.length > 200) return null;
	const tags = Array.isArray(input.tags)
		? input.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20).map((tag) => tag.slice(0, 50))
		: [];
	const frontmatter = [
		"---",
		`title: ${scalar(title)}`,
		`published: ${published}`,
		...(scheduleDate ? [`date: ${scalar(scheduleDate)}`] : []),
		`description: ${scalar(description)}`,
		`category: ${scalar(category)}`,
		`draft: ${draft}`,
		...(password ? [`password: ${scalar(password)}`] : []),
		...(passwordHint ? [`passwordHint: ${scalar(passwordHint)}`] : []),
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

	if (!response.ok) throw new Error(githubFailure(response, "读取文章列表"));
	const data = (await response.json()) as { tree?: GitHubEntry[]; truncated?: boolean };
	if (data.truncated) throw new Error("文章列表未能完整读取。为避免漏掉文章或误操作，请稍后刷新重试。");
	return (data.tree ?? []).filter((entry) =>
		entry.type === "blob" &&
		entry.path.startsWith(ROOT) &&
		/^src\/content\/posts\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+\.mdx?$/u.test(entry.path),
	);
}

async function readPost(path: string, config: ReturnType<typeof getConfig>): Promise<{ path: string; sha: string; content: string }> {
	if (!path.startsWith(ROOT) || !/^src\/content\/posts\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+\.mdx?$/u.test(path)) {
		throw new Error("文章地址不正确，请从左侧列表重新选择文章。");
	}
	const response = await github(`contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(config.branch)}`, config);

	if (!response.ok) throw new Error(githubFailure(response, "读取文章"));
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
				return {
					path: post.path,
					sha: post.sha,
					content: post.content,
					title: (match?.[1] ?? match?.[2] ?? match?.[3] ?? file.path.split("/").pop() ?? "").trim(),
					published: date?.[1] ?? "",
					date: frontmatterText(post.content, "date"),
					category: frontmatterText(post.content, "category"),
					tags: frontmatterTags(post.content),
					draft: /^draft:\s*true\s*$/m.test(post.content),
				};
			} catch {
				return { path: file.path, sha: file.sha, title: file.path.split("/").pop() ?? file.path, published: "", draft: false };
			}
		}));
		return json(posts.sort((a, b) => b.published.localeCompare(a.published)));
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "暂时无法完成操作，请稍后重试。" }, 503);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const config = getConfig();
		const input = (await request.json()) as Record<string, unknown>;
		const slug = safeSlug(input.slug);
		const extension = input.extension === "mdx" ? "mdx" : "md";
		if (!slug) return json({ error: "文章网址名称请以中文、字母或数字开头；之后可使用中文、字母、数字、连字符或下划线，最多 80 个字符。" }, 400);
		const path = `${ROOT}${slug}.${extension}`;
		const content = makeMarkdown({ ...input, slug });
		if (!content) return json({ error: "请检查标题、文章日期和正文是否填写正确。" }, 400);
		const response = await github(`contents/${path}`, config, {
			method: "PUT",
			body: JSON.stringify({ message: `Add article: ${slug}`, content: encodeBase64(content), branch: config.branch }),
		});

		if (response.status === 422) return json({ error: "同名文章已存在" }, 409);

		if (!response.ok) return json({ error: githubFailure(response, "保存文章") }, 502);
		const written = (await response.json()) as { commit?: { sha?: string; html_url?: string } };
		return json({ ok: true, path, commitSha: written.commit?.sha, commitUrl: written.commit?.html_url }, 201);
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "暂时无法完成操作，请稍后重试。" }, 503);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	try {
		const config = getConfig();
		const input = (await request.json()) as Record<string, unknown>;
		const path = typeof input.path === "string" ? input.path : "";
		if (!path.startsWith(ROOT) || !/^src\/content\/posts\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+\.mdx?$/u.test(path)) return json({ error: "文章地址不正确，请从左侧列表重新选择文章。" }, 400);
		const current = await readPost(path, config);
		if (typeof input.sha !== "string" || input.sha !== current.sha) return json({ error: "这篇文章刚刚被更新过。为避免覆盖新内容，请刷新列表并重新打开文章。" }, 409);
		const slug = path.split("/").pop()?.replace(/\.mdx?$/, "") ?? "";
		let content = typeof input.rawContent === "string" ? input.rawContent : makeMarkdown({ ...input, slug });
		if (!content || content.length > 500_000 || (typeof input.rawContent === "string" && !/^---\r?\n/.test(content))) {
			return json({ error: "文章内容过长或格式不正确，请检查后再保存。" }, 400);
		}
		if (typeof input.rawContent === "string") {
			const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
			if (!frontmatter) return json({ error: "没有找到有效的文章信息区，无法保存标题、日期等信息" }, 400);
			const title = typeof input.title === "string" ? input.title.trim() : "";
			if (!title || title.length > 200) return json({ error: "请填写标题，且标题不能超过 200 个字符。" }, 400);
			if (!validDate(input.published)) return json({ error: "文章日期不正确，请重新选择日期。" }, 400);
			const category = typeof input.category === "string" ? input.category.slice(0, 100) : "";
			const description = typeof input.description === "string" ? input.description.slice(0, 500) : "";
			const scheduleDate = typeof input.date === "string" ? input.date.trim() : "";
			const password = typeof input.password === "string" ? input.password : "";
			const passwordHint = typeof input.passwordHint === "string" ? input.passwordHint.slice(0, 120) : "";
			if (!validScheduleDate(scheduleDate)) return json({ error: "计划公开时间不正确，请重新选择时间后再保存" }, 400);
			if (password.length > 200) return json({ error: "访问密码不能超过 200 个字符，请缩短后再保存。" }, 400);
			const tags = Array.isArray(input.tags)
				? input.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20).map((tag) => tag.trim().slice(0, 50)).filter(Boolean)
				: [];
			content = updateFrontmatterField(content, "title", scalar(title));
			content = updateFrontmatterField(content, "published", input.published);
			content = updateFrontmatterField(content, "category", scalar(category));
			content = updateFrontmatterField(content, "description", scalar(description));
			content = updateFrontmatterField(content, "tags", JSON.stringify(tags));
			if (typeof input.draft === "boolean") {
				content = updateFrontmatterField(content, "draft", String(input.draft));
			}
			content = scheduleDate
				? updateFrontmatterField(content, "date", scalar(scheduleDate))
				: removeFrontmatterField(content, "date");
			content = password
				? updateFrontmatterField(content, "password", scalar(password))
				: removeFrontmatterField(content, "password");
			content = passwordHint
				? updateFrontmatterField(content, "passwordHint", scalar(passwordHint))
				: removeFrontmatterField(content, "passwordHint");
			if (content.length > 500_000) return json({ error: "文章内容太大，暂时无法保存；请删减一些内容后重试。" }, 400);
		}
		const response = await github(`contents/${path.split("/").map(encodeURIComponent).join("/")}`, config, {
			method: "PUT",
			body: JSON.stringify({ message: `Update article: ${slug}`, content: encodeBase64(content), sha: current.sha, branch: config.branch }),
		});

		if (!response.ok) {
			const message = githubFailure(response, "保存文章修改");
			if (response.status === 409 || response.status === 422) {
				return json({ error: "这篇文章在你编辑期间发生了变化。为避免覆盖新内容，你当前的编辑内容仍会保留；请重新打开最新版本后再保存。", detail: message }, 409);
			}
			return json({ error: message }, 502);
		}
		const written = (await response.json()) as { commit?: { sha?: string; html_url?: string } };
		return json({ ok: true, path, commitSha: written.commit?.sha, commitUrl: written.commit?.html_url });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "暂时无法完成操作，请稍后重试。" }, 503);
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	try {
		const config = getConfig();
		const input = (await request.json()) as Record<string, unknown>;
		const path = typeof input.path === "string" ? input.path : "";
		if (!path.startsWith(ROOT) || !/^src\/content\/posts\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+\.mdx?$/u.test(path)) return json({ error: "文章地址不正确，请从左侧列表重新选择文章。" }, 400);
		const current = await readPost(path, config);
		if (typeof input.sha !== "string" || input.sha !== current.sha) return json({ error: "这篇文章刚刚被更新过。为避免覆盖新内容，请刷新列表并重新打开文章。" }, 409);
		const response = await github(`contents/${path.split("/").map(encodeURIComponent).join("/")}`, config, {
			method: "DELETE",
			body: JSON.stringify({ message: `Delete article: ${path.split("/").pop()}`, sha: current.sha, branch: config.branch }),
		});

		if (!response.ok) {
			const message = githubFailure(response, "删除文章");
			if (response.status === 409 || response.status === 422) {
				return json({ error: "这篇文章可能刚刚被修改或删除。系统没有确认删除成功，请刷新列表后重新检查。", detail: message }, 409);
			}
			return json({ error: message }, 502);
		}
		const written = (await response.json()) as { commit?: { sha?: string; html_url?: string } };
		return json({ ok: true, path, commitSha: written.commit?.sha, commitUrl: written.commit?.html_url });
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "暂时无法完成操作，请稍后重试。" }, 503);
	}
};
