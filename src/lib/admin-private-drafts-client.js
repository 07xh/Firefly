// Helpers for the existing Firefly admin page. This module never writes to GitHub.
const PRIVATE_API = "/api/admin/private-drafts/";

export function privateDraftPath(slug) {
	return "private:" + slug;
}

export function draftListEntry(item) {
	return {
		isPrivate: true,
		path: privateDraftPath(item.slug),
		slug: item.slug,
		extension: item.extension === "mdx" ? "mdx" : "md",
		sha: item.version,
		title: item.title || "未命名私人草稿",
		published: "",
		category: "",
		tags: [],
		draft: true,
		content: null,
	};
}

function frontmatterField(field, value) {
	if (value === undefined || value === null || value === "") return null;
	return field + ": " + (typeof value === "boolean" ? String(value) : JSON.stringify(value));
}

export function stripArticleFrontmatter(source) {
	return String(source).replace(/^---\r?\n[\s\S]*?\r?\n---(?:[ \t]*\r?\n|$)/, "");
}

export function buildPrivateDraftContent(source, metadata) {
	if (!metadata || !metadata.title?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.published || "")) {
		throw new Error("私人草稿需要有效的标题和发布日期。");
	}
	const tags = Array.isArray(metadata.tags) ? metadata.tags.map(String).map(s => s.trim()).filter(Boolean) : [];
	const fields = {
		title: frontmatterField("title", metadata.title),
		published: "published: " + metadata.published,
		date: frontmatterField("date", metadata.date),
		description: frontmatterField("description", metadata.description),
		category: frontmatterField("category", metadata.category),
		draft: "draft: true",
		password: frontmatterField("password", metadata.password),
		passwordHint: frontmatterField("passwordHint", metadata.passwordHint),
		tags: "tags: " + JSON.stringify(tags),
	};
	const full = String(source ?? "");
	const match = full.match(/^---\r?\n([\s\S]*?)\r?\n---(?=[ \t]*(?:\r?\n|$))/);
	if (!match) {
		return "---\n" + Object.values(fields).filter(Boolean).join("\n") + "\n---\n\n" + full;
	}
	// Preserve unknown frontmatter fields and every byte of the MDX article body.
	const newline = match[0].includes("\r\n") ? "\r\n" : "\n";
	let fm = match[1];
	for (const [key, value] of Object.entries(fields)) {
		const pattern = new RegExp("^" + key + ":[^\\r\\n]*$", "m");
		if (pattern.test(fm)) {
			fm = value === null
				? fm.split(/\r?\n/).filter(line => !pattern.test(line)).join(newline)
				: fm.replace(pattern, value);
		} else if (value !== null) {
			fm += newline + value;
		}
	}
	return "---" + newline + fm + newline + "---" + full.slice(match[0].length);
}

export function assertPublishablePrivateDraft(source, metadata) {
	if (!metadata?.title?.trim() || !metadata.published || !metadata.slug) {
		throw new Error("缺少文章标题、发布日期或文件名，不能公开发布。");
	}
	if (metadata.password || metadata.passwordHint) {
		throw new Error("公开仓库会暴露文章密码与密码提示。请先清空两项，再发布为公开文章。");
	}
	const match = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) throw new Error("无法识别草稿元信息，已停止公开发布。");
	const allowed = new Set(["title", "published", "date", "description", "category", "draft", "password", "passwordHint", "tags", "slug"]);
	for (const line of match[1].split(/\r?\n/)) {
		if (!line.trim() || line.startsWith("#")) continue;
		const key = line.match(/^([\w-]+):/);
		if (!key || !allowed.has(key[1])) {
			throw new Error("草稿包含未支持的额外元信息，自动发布可能破坏内容。请先导出备份并人工确认。");
		}
	}
	if (/^password:\s*(?!["']{2}\s*$|null\s*$|\s*$).+/m.test(match[1])) {
		throw new Error("草稿原文仍含有访问密码。请清空密码后重新保存私人草稿，再发布。");
	}
	if (!stripArticleFrontmatter(source).trim()) {
		throw new Error("私人草稿正文为空，已阻止公开发布。");
	}
}

export async function privateDraftRequest(method, payload, query) {
	const url = new URL(PRIVATE_API, window.location.origin);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== null) url.searchParams.set(key, value);
		}
	}
	const response = await fetch(url, {
		method,
		credentials: "same-origin",
		cache: "no-store",
		headers: payload === undefined ? {} : { "Content-Type": "application/json" },
		...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
	});
	if (response.status === 401) {
		throw new Error("后台登录已过期，请重新登录。");
	}
	const data = await response.json().catch(() => ({ error: "私人草稿接口返回了无法解析的数据。" }));
	if (!response.ok) throw new Error(data.error || "私人草稿请求失败。");
	return data;
}

export async function loadPrivateDraftSummaries() {
	const entries = [];
	let cursor;
	const seen = new Set();
	for (let page = 0; page < 20; page++) {
		const result = await privateDraftRequest("GET", undefined, cursor ? { cursor } : undefined);
		if (!Array.isArray(result.items)) throw new Error("私人草稿目录响应格式不正确。");
		entries.push(...result.items.map(draftListEntry));
		if (!result.cursor) return entries;
		if (seen.has(result.cursor)) throw new Error("私人草稿分页游标重复，读取已停止。");
		seen.add(result.cursor);
		cursor = result.cursor;
	}
	throw new Error("私人草稿超过当前分页上限，请先备份并整理草稿。");
}

export function exportPrivateDraft(filename, content) {
	const safeName = String(filename || "private-draft").replace(/[^\p{L}\p{N}_.-]/gu, "_").slice(0, 90);
	const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	try {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = /\.mdx?$/.test(safeName) ? safeName : safeName + ".md";
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
