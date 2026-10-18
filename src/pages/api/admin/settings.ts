import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

const FILE_PATH = "src/data/settings.json";
const DEFAULT_SETTINGS = {
	backgroundImage: "",
	backgroundMusic: "",
	bio: "Hello, I'm XiaYe.",
};

type SettingsRecord = Record<string, unknown> & {
	backgroundImage: string;
	backgroundMusic: string;
	bio: string;
};
type RuntimeEnv = {
	FIREFLY_CONTENTS_TOKEN?: string;
	GITHUB_CONTENTS_REPO?: string;
	GITHUB_CONTENTS_BRANCH?: string;
};
type GitHubFile = { sha?: string; content?: string; encoding?: string };
type GitHubConfig = { token: string; repo: string; branch: string };

class SettingsApiError extends Error {
	status: number;
	constructor(message: string, status = 502) {
		super(message);
		this.name = "SettingsApiError";
		this.status = status;
	}
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
		},
	});
}

function getConfig(): GitHubConfig {
	const env = workerEnv as unknown as RuntimeEnv;
	const token = env?.FIREFLY_CONTENTS_TOKEN?.trim() ?? "";
	const repo = env?.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
	const branch = env?.GITHUB_CONTENTS_BRANCH?.trim() || "master";
	if (!token) throw new SettingsApiError("Worker 未配置 FIREFLY_CONTENTS_TOKEN。", 503);
	if (repo.split("/").length !== 2 || repo.split("/").some((part) => !/^[A-Za-z0-9_.-]+$/.test(part)) || branch.split("/").some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))) {
		throw new SettingsApiError("GitHub 仓库或分支配置格式不合法。", 503);
	}
	return { token, repo, branch };
}

function requestHeaders(config: GitHubConfig): HeadersInit {
	return {
		Accept: "application/vnd.github+json",
		"User-Agent": "Firefly-Admin/1.0 (https://github.com/07xh/Firefly)",
		Authorization: "Bearer " + config.token,
		"X-GitHub-Api-Version": "2022-11-28",
		"Content-Type": "application/json",
	};
}

function fileUrl(config: GitHubConfig): string {
	const path = FILE_PATH.split("/").map(encodeURIComponent).join("/");
	return "https://api.github.com/repos/" + config.repo + "/contents/" + path +
		"?ref=" + encodeURIComponent(config.branch);
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
	const binary = atob(value.replace(/[^A-Za-z0-9+\\/=]/g, ""));
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

async function githubError(response: Response, operation: string): Promise<string> {
	let message = "";
	try {
		const payload = (await response.clone().json()) as { message?: unknown };
		if (typeof payload.message === "string") {
		message = payload.message.trim().slice(0, 180);
		}
	} catch {
		// Keep the status if GitHub returned a non-JSON body.
	}
	return operation + "（HTTP " + response.status + "）" + (message ? "：" + message : "");
}

function normalizeSettings(value: unknown): SettingsRecord {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new SettingsApiError("settings.json 必须是 JSON 对象。", 500);
	}
	const raw = value as Record<string, unknown>;
	return {
		...DEFAULT_SETTINGS,
		...raw,
		backgroundImage: typeof raw.backgroundImage === "string" ? raw.backgroundImage : "",
		backgroundMusic: typeof raw.backgroundMusic === "string" ? raw.backgroundMusic : "",
		bio: typeof raw.bio === "string" ? raw.bio : DEFAULT_SETTINGS.bio,
	};
}

async function readSettings(
	config: GitHubConfig,
): Promise<{ settings: SettingsRecord; sha: string | null }> {
	const response = await fetch(fileUrl(config), { headers: requestHeaders(config) });
	if (response.status === 404) return { settings: { ...DEFAULT_SETTINGS }, sha: null };
	if (!response.ok) {
		throw new SettingsApiError(await githubError(response, "读取 settings.json 失败"));
	}
	const file = (await response.json()) as GitHubFile;
	if (!file.sha || typeof file.content !== "string") {
		throw new SettingsApiError("GitHub 返回的 settings.json 文件数据不完整。");
	}
	const rawContent = file.encoding === "base64" ? decodeBase64(file.content) : file.content;
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawContent);
	} catch {
		throw new SettingsApiError("仓库中的 settings.json 不是有效 JSON，已停止写入以避免覆盖数据。", 500);
	}
	return { settings: normalizeSettings(parsed), sha: file.sha };
}

function validateMediaUrl(value: unknown, label: string): string {
	if (typeof value !== "string") throw new SettingsApiError(label + "必须是字符串。", 400);
	const trimmed = value.trim();
	if (trimmed.length > 2048) throw new SettingsApiError(label + "不能超过 2048 个字符。", 400);
	if (!trimmed) return "";
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new SettingsApiError(label + "必须是完整的 HTTP/HTTPS 链接。", 400);
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		throw new SettingsApiError(label + "仅支持 HTTP 或 HTTPS 链接。", 400);
	}
	return parsed.toString();
}

function validateBio(value: unknown): string {
	if (typeof value !== "string") throw new SettingsApiError("个人签名必须是字符串。", 400);
	const bio = value.trim();
	if (bio.length > 5000) throw new SettingsApiError("个人签名不能超过 5000 个字符。", 400);
	return bio;
}

export const GET: APIRoute = async () => {
	try {
		const result = await readSettings(getConfig());
		return json(result.settings);
	} catch (error) {
		const status = error instanceof SettingsApiError ? error.status : 502;
		const message = error instanceof Error ? error.message : "读取全局配置失败。";
		return json({ error: message }, status);
	}
};

export const POST: APIRoute = async ({ request }) => {
	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return json({ error: "请求正文必须是有效 JSON。" }, 400);
	}
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return json({ error: "请求正文必须是 JSON 对象。" }, 400);
	}

	let backgroundImage: string;
	let backgroundMusic: string;
	let bio: string;
	try {
		const data = input as Record<string, unknown>;
		backgroundImage = validateMediaUrl(data.backgroundImage, "背景图片链接");
		backgroundMusic = validateMediaUrl(data.backgroundMusic, "背景音乐链接");
		bio = validateBio(data.bio);
	} catch (error) {
		const status = error instanceof SettingsApiError ? error.status : 400;
		const message = error instanceof Error ? error.message : "配置字段不合法。";
		return json({ error: message }, status);
	}

	try {
		const config = getConfig();
		const current = await readSettings(config);
		const settings: SettingsRecord = {
			...current.settings,
			backgroundImage,
			backgroundMusic,
			bio,
		};
		const payload: Record<string, unknown> = {
			message: "Update global site settings from Firefly Admin",
			branch: config.branch,
			content: encodeBase64(JSON.stringify(settings, null, 2) + "\n"),
		};
		if (current.sha) payload.sha = current.sha;

		const response = await fetch(fileUrl(config).split("?")[0], {
			method: "PUT",
			headers: requestHeaders(config),
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			const status = response.status === 409 || response.status === 422 ? 409 : 502;
			throw new SettingsApiError(await githubError(response, "写入 settings.json 失败"), status);
		}
		const result = (await response.json()) as { commit?: { sha?: string } };
		return json({
			ok: true,
			settings,
			commitSha: result.commit?.sha ?? null,
		});
	} catch (error) {
		const status = error instanceof SettingsApiError ? error.status : 502;
		const message = error instanceof Error ? error.message : "保存全局配置失败。";
		return json({ error: message }, status);
	}
};
