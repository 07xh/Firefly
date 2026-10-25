import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { selectAdminMediaItems, type MediaTreeEntry } from "../../../lib/admin-media-files";

export const prerender = false;

type RuntimeEnv = {
	FIREFLY_CONTENTS_TOKEN?: string;
	GITHUB_CONTENTS_REPO?: string;
	GITHUB_CONTENTS_BRANCH?: string;
};

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

export const GET: APIRoute = async () => {
	try {
		const env = workerEnv as unknown as RuntimeEnv;
		const token = env.FIREFLY_CONTENTS_TOKEN?.trim();
		const repo = env.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
		const branch = env.GITHUB_CONTENTS_BRANCH?.trim() || "master";
		if (!token) return json({ error: "尚未配置 GitHub Contents Token。" }, 503);
		if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(branch) || branch.includes("..")) {
			return json({ error: "GitHub 仓库或分支配置不合法。" }, 503);
		}

		const url = "https://api.github.com/repos/" + repo + "/git/trees/" + encodeURIComponent(branch) + "?recursive=1";
		const response = await fetch(url, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: "Bearer " + token,
				"User-Agent": "Firefly-Admin/1.0 (https://github.com/07xh/Firefly)",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
		if (!response.ok) {
			return json({ error: "GitHub 图片索引读取失败（HTTP " + response.status + "）。" }, 502);
		}

		const data = (await response.json()) as { tree?: MediaTreeEntry[]; truncated?: boolean };
		if (data.truncated || !Array.isArray(data.tree)) {
			return json({ error: "GitHub 文件树不完整，拒绝显示可能遗漏的图片列表。" }, 503);
		}
		const items = selectAdminMediaItems(data.tree, repo, branch);
		return json({ items, count: items.length, source: "github-repository", readOnly: true });
	} catch (error) {
		console.error("[Firefly] admin media listing failed", error instanceof Error ? error.message : String(error));
		return json({ error: "媒体列表读取失败，请检查后台 GitHub 连接或文件索引。" }, 503);
	}
};
