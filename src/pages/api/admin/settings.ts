import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

const FILE_PATH = "src/data/settings.json";

type SettingsRecord = Record<string, unknown> & {
	bannerTitle: string;
	bannerSubtitle: string;
	backgroundImage: string;
	backgroundColor: string;
	avatar: string;
	nickname: string;
	bio: string;
	announcement: string;
	githubUrl: string;
	showGithub: boolean;
	email: string;
	showEmail: boolean;
	backgroundMusic: string;
	showSupportAndShare: boolean;
	showAbout: boolean;
	showAboutDonation: boolean;
	showNavSocial: boolean;
	showNavMy: boolean;
	showNavAbout: boolean;
	aboutContent: string;
	showSourceGithub: boolean;
	sourceGithubUrl: string;
};

const DEFAULT_SETTINGS: SettingsRecord = {
	bannerTitle: "Lovely firefly!",
	bannerSubtitle: "In Reddened Chrysalis, I Once Rest",
	backgroundImage: "",
	backgroundColor: "",
	avatar: "",
	nickname: "Xiaohuang",
	bio: "Hello, I'm Xiaohuang",
	announcement: "欢迎来到我的博客！这是一则示例公告。",
	githubUrl: "",
	showGithub: false,
	email: "",
	showEmail: false,
	backgroundMusic: "",
	showSupportAndShare: true,
	showAbout: true,
	showAboutDonation: false,
	showNavSocial: true,
	showNavMy: true,
	showNavAbout: true,
	aboutContent: "# 关于我 / About Me\n\n你好！我是 **夏叶** ，一个在数字世界中默默无闻的一片叶子。\n\n## 🛠️ 关于本站\n\n这个网站使用 **Astro** 框架构建，采用了 [Firefly](https://github.com/CuteLeaf/Firefly) 模板，Firefly 是基于 [Fuwari](https://github.com/saicaca/fuwari) 的二次开发。\n\n**Firefly** 是一款基于 Astro 框架和 Fuwari 模板开发的清新美观且现代化个人博客主题模板，专为技术爱好者和内容创作者设计。该主题融合了现代 Web 技术栈，提供了丰富的功能模块和高度可定制的界面，让您能够轻松打造出专业且美观的个人博客网站。\n\n**🖥️ 在线预览： [Firefly - Demo site](https://firefly.cuteleaf.cn/)**\n\n**📝 Firefly 使用文档： [https://docs-firefly.cuteleaf.cn](https://docs-firefly.cuteleaf.cn/)**\n\n**⭐ Firefly 开源地址：[https://github.com/CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly)**\n\n**⭐ Fuwari 开源地址：[https://github.com/saicaca/fuwari](https://github.com/saicaca/fuwari)**\n\n---\n\n*感谢你的来访！希望在这里能找到对你有用的内容！*\n",
	showSourceGithub: false,
	sourceGithubUrl: "",
};

const SETTING_KEYS = [
	"bannerTitle",
	"bannerSubtitle",
	"backgroundImage",
	"backgroundColor",
	"avatar",
	"nickname",
	"bio",
	"announcement",
	"githubUrl",
	"showGithub",
	"email",
	"showEmail",
	"backgroundMusic",
	"showSupportAndShare",
	"showAbout",
	"showAboutDonation",
	"showNavSocial",
	"showNavMy",
	"showNavAbout",
	"aboutContent",
	"showSourceGithub",
	"sourceGithubUrl",
] as const;

type SettingKey = (typeof SETTING_KEYS)[number];

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
	if (!token) {
		throw new SettingsApiError("Worker 未配置 FIREFLY_CONTENTS_TOKEN。", 503);
	}
	if (
		repo.split("/").length !== 2 ||
		repo.split("/").some((part) => !/^[A-Za-z0-9_.-]+$/.test(part)) ||
		branch.split("/").some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))
	) {
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
	const binary = atob(value.replace(/[^A-Za-z0-9+/=]/g, ""));
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

async function githubError(
	response: Response,
	operation: string,
): Promise<string> {
	let message = "";
	try {
		const payload = (await response.clone().json()) as { message?: unknown };
		if (typeof payload.message === "string") {
			message = payload.message.trim().slice(0, 180);
		}
	} catch {
		// Keep the HTTP status if GitHub returned a non-JSON body.
	}
	return (
		operation +
		"（HTTP " +
		response.status +
		"）" +
		(message ? "：" + message : "")
	);
}

function normalizeSettings(value: unknown): SettingsRecord {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new SettingsApiError("settings.json 必须是 JSON 对象。", 500);
	}
	const raw = value as Record<string, unknown>;
	const merged = { ...DEFAULT_SETTINGS, ...raw };
	const result: Record<string, unknown> = { ...merged };
	for (const key of [
		"bannerTitle",
		"bannerSubtitle",
		"backgroundImage",
		"backgroundColor",
		"avatar",
		"nickname",
		"bio",
		"announcement",
		"githubUrl",
		"email",
		"backgroundMusic",
		"aboutContent",
		"sourceGithubUrl",
	] as const) {
		result[key] =
			typeof merged[key] === "string" ? merged[key] : DEFAULT_SETTINGS[key];
	}
	for (const key of [
		"showGithub",
		"showEmail",
		"showSupportAndShare",
		"showAbout",
		"showAboutDonation",
		"showNavSocial",
		"showNavMy",
		"showNavAbout",
		"showSourceGithub",
	] as const) {
		result[key] =
			typeof merged[key] === "boolean" ? merged[key] : DEFAULT_SETTINGS[key];
	}
	return result as SettingsRecord;
}

async function readSettings(
	config: GitHubConfig,
): Promise<{ settings: SettingsRecord; sha: string | null }> {
	const response = await fetch(fileUrl(config), {
		headers: requestHeaders(config),
	});
	if (response.status === 404) {
		return { settings: { ...DEFAULT_SETTINGS }, sha: null };
	}
	if (!response.ok) {
		throw new SettingsApiError(
			await githubError(response, "读取 settings.json 失败"),
		);
	}
	const file = (await response.json()) as GitHubFile;
	if (!file.sha || typeof file.content !== "string") {
		throw new SettingsApiError("GitHub 返回的 settings.json 文件数据不完整。");
	}
	const rawContent =
		file.encoding === "base64" ? decodeBase64(file.content) : file.content;
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawContent);
	} catch {
		throw new SettingsApiError(
			"仓库中的 settings.json 不是有效 JSON，已停止写入以避免覆盖数据。",
			500,
		);
	}
	return { settings: normalizeSettings(parsed), sha: file.sha };
}

function validateMediaUrl(value: unknown, label: string): string {
	if (typeof value !== "string") {
		throw new SettingsApiError(label + "必须是字符串。", 400);
	}
	const trimmed = value.trim();
	if (trimmed.length > 2048) {
		throw new SettingsApiError(label + "不能超过 2048 个字符。", 400);
	}
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

function validateText(
	value: unknown,
	label: string,
	maxLength: number,
): string {
	if (typeof value !== "string") {
		throw new SettingsApiError(label + "必须是字符串。", 400);
	}
	if (value.length > maxLength) {
		throw new SettingsApiError(label + "不能超过 " + maxLength + " 个字符。", 400);
	}
	return value.trim();
}

function validateBackgroundColor(value: unknown): string {
	if (typeof value !== "string") {
		throw new SettingsApiError("背景颜色必须是字符串。", 400);
	}
	const color = value.trim();
	if (!color) return "";
	if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
		throw new SettingsApiError(
			"背景颜色只支持 #RGB 或 #RRGGBB 格式；留空则使用主题默认颜色。",
			400,
		);
	}
	return color.toLowerCase();
}

function validateAnnouncement(value: unknown): string {
	if (typeof value !== "string") {
		throw new SettingsApiError("公告文本必须是字符串。", 400);
	}
	if (value.length > 10000) {
		throw new SettingsApiError("公告文本不能超过 10000 个字符。", 400);
	}
	return value.replace(/\r\n?/g, "\n").trim();
}

function validateAboutContent(value: unknown): string {
	if (typeof value !== "string") {
		throw new SettingsApiError("关于我正文必须是字符串。", 400);
	}
	if (value.length > 30000) {
		throw new SettingsApiError("关于我正文不能超过 30000 个字符。", 400);
	}
	return value.replace(/\r\n?/g, "\n");
}

function validateEmail(value: unknown): string {
	const email = validateText(value, "邮箱地址", 320);
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new SettingsApiError("邮箱地址格式不正确。", 400);
	}
	return email;
}

function validateBoolean(value: unknown, label: string): boolean {
	if (typeof value !== "boolean") {
		throw new SettingsApiError(label + "必须是布尔值 true 或 false。", 400);
	}
	return value;
}

function applySubmittedSettings(
	current: SettingsRecord,
	input: Record<string, unknown>,
): SettingsRecord {
	const next: Record<string, unknown> = { ...current };
	const has = (key: SettingKey) => Object.hasOwn(input, key);

	if (has("bannerTitle")) {
		next.bannerTitle = validateText(
			input.bannerTitle,
			"顶部主标题",
			200,
		);
	}
	if (has("bannerSubtitle")) {
		next.bannerSubtitle = validateText(
			input.bannerSubtitle,
			"顶部副标题",
			500,
		);
	}
	if (has("backgroundImage")) {
		next.backgroundImage = validateMediaUrl(
			input.backgroundImage,
			"背景图片链接",
		);
	}
	if (has("backgroundColor")) {
		next.backgroundColor = validateBackgroundColor(input.backgroundColor);
	}
	if (has("avatar")) next.avatar = validateMediaUrl(input.avatar, "头像链接");
	if (has("nickname")) next.nickname = validateText(input.nickname, "昵称", 120);
	if (has("bio")) next.bio = validateText(input.bio, "个人签名", 5000);
	if (has("announcement")) {
		next.announcement = validateAnnouncement(input.announcement);
	}
	if (has("githubUrl")) {
		next.githubUrl = validateMediaUrl(input.githubUrl, "GitHub 链接");
	}
	if (has("showGithub")) {
		next.showGithub = validateBoolean(input.showGithub, "showGithub");
	}
	if (has("email")) next.email = validateEmail(input.email);
	if (has("showEmail")) {
		next.showEmail = validateBoolean(input.showEmail, "showEmail");
	}
	if (has("backgroundMusic")) {
		next.backgroundMusic = validateMediaUrl(
			input.backgroundMusic,
			"背景音乐链接",
		);
	}
	if (has("showSupportAndShare")) {
		next.showSupportAndShare = validateBoolean(
			input.showSupportAndShare,
			"showSupportAndShare",
		);
	}
	for (const key of [
		"showAbout",
		"showAboutDonation",
		"showNavSocial",
		"showNavMy",
		"showNavAbout",
	] as const) {
		if (has(key)) next[key] = validateBoolean(input[key], key);
	}
	if (has("aboutContent")) {
		next.aboutContent = validateAboutContent(input.aboutContent);
	}
	if (has("showSourceGithub")) {
		next.showSourceGithub = validateBoolean(input.showSourceGithub, "showSourceGithub");
	}
	if (has("sourceGithubUrl")) {
		next.sourceGithubUrl = validateMediaUrl(input.sourceGithubUrl, "GitHub 原文/源码链接");
	}

	return normalizeSettings(next);
}

async function handleSave(request: Request): Promise<Response> {
	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return json({ error: "请求正文必须是有效 JSON。" }, 400);
	}
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return json({ error: "请求正文必须是 JSON 对象。" }, 400);
	}

	try {
		const config = getConfig();
		const current = await readSettings(config);
		const settings = applySubmittedSettings(
			current.settings,
			input as Record<string, unknown>,
		);
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
			const status =
				response.status === 409 || response.status === 422 ? 409 : 502;
			throw new SettingsApiError(
				await githubError(response, "写入 settings.json 失败"),
				status,
			);
		}
		const result = (await response.json()) as { commit?: { sha?: string } };
		return json({ ok: true, settings, commitSha: result.commit?.sha ?? null });
	} catch (error) {
		const status = error instanceof SettingsApiError ? error.status : 502;
		const message = error instanceof Error ? error.message : "保存全局配置失败。";
		return json({ error: message }, status);
	}
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

// POST remains available for existing admin clients; PUT is supported for the updated form.
export const POST: APIRoute = async ({ request }) => handleSave(request);
export const PUT: APIRoute = async ({ request }) => handleSave(request);
