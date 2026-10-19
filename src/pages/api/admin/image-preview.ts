import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

type RuntimeEnv = {
	FIREFLY_CONTENTS_TOKEN?: string;
	GITHUB_CONTENTS_REPO?: string;
	GITHUB_CONTENTS_BRANCH?: string;
};

const IMAGE_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
};
const MAX_PREVIEW_BYTES = 12 * 1024 * 1024;

function json(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

function hasControlCharacters(value: string): boolean {
	for (const character of value) {
		const code = character.charCodeAt(0);
		if (code < 32 || code === 127) return true;
	}
	return false;
}

function isAllowedImagePath(path: string): boolean {
	if (
		path.length > 2048 ||
		!path.startsWith("src/content/posts/") ||
		path.includes("\\") ||
		hasControlCharacters(path)
	) {
		return false;
	}

	const segments = path.split("/");
	if (segments.some((segment) => !segment || segment === "." || segment === "..")) return false;

	const extension = segments.at(-1)?.split(".").pop()?.toLowerCase() || "";
	return Boolean(IMAGE_TYPES[extension]);
}

function decodeBase64Image(value: string): Uint8Array | null {
	try {
		const binary = atob(value.replace(/\s/g, ""));
		return Uint8Array.from(binary, (char) => char.charCodeAt(0));
	} catch {
		return null;
	}
}

export const GET: APIRoute = async ({ url }) => {
	const path = url.searchParams.get("path") || "";
	if (!isAllowedImagePath(path)) return json("图片地址不支持预览。请确认它是文章中的图片，且格式受支持。", 400);

	const env = workerEnv as unknown as RuntimeEnv;
	const token = env.FIREFLY_CONTENTS_TOKEN?.trim();
	const repo = env.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
	const branch = env.GITHUB_CONTENTS_BRANCH?.trim() || "master";
	if (!token) return json("图片预览功能尚未完成配置，请检查后台设置。", 503);
	if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return json("图片保存位置设置不正确，请检查后台设置。", 503);

	try {
		const encodedPath = path.split("/").map(encodeURIComponent).join("/");
		const githubUrl =
			"https://api.github.com/repos/" +
			repo +
			"/contents/" +
			encodedPath +
			"?ref=" +
			encodeURIComponent(branch);
		const response = await fetch(githubUrl, {
			headers: {
				Accept: "application/vnd.github.raw+json",
				Authorization: "Bearer " + token,
				"User-Agent": "Firefly-Admin/1.0 (https://github.com/07xh/Firefly)",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});

		if (!response.ok) {
			const message = response.status === 404
				? "找不到这张图片，请检查文章中的图片路径。"
				: "读取图片失败（" + response.status + "），请检查仓库读取权限。";
			return json(message, response.status === 404 ? 404 : 502);
		}

		const announcedSize = Number(response.headers.get("content-length"));
		if (Number.isFinite(announcedSize) && announcedSize > MAX_PREVIEW_BYTES) {
			await response.body?.cancel();
			return json("这张图片太大，后台暂时无法预览（最大 12 MiB）；原图片未被修改。", 413);
		}

		let bytes: Uint8Array;
		const upstreamType = response.headers.get("content-type") || "";
		if (upstreamType.includes("application/json")) {
			const payload = (await response.json()) as { content?: unknown; encoding?: unknown };
			if (payload.encoding !== "base64" || typeof payload.content !== "string") {
				return json("暂时无法读取这张图片，请稍后重试。", 502);
			}

			const decoded = decodeBase64Image(payload.content);
			if (!decoded) return json("暂时无法读取这张图片，请稍后重试。", 502);
			bytes = decoded;
		} else {
			bytes = new Uint8Array(await response.arrayBuffer());
		}

		if (bytes.byteLength < 1) return json("这张图片没有内容，请检查原图片文件。", 404);
		if (bytes.byteLength > MAX_PREVIEW_BYTES) {
			return json("这张图片太大，后台暂时无法预览（最大 12 MiB）；原图片未被修改。", 413);
		}

		const extension = path.split("/").at(-1)?.split(".").pop()?.toLowerCase() || "";
		const body = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(body).set(bytes);
		return new Response(body, {
			status: 200,
			headers: {
				"content-type": IMAGE_TYPES[extension],
				"content-length": String(bytes.byteLength),
				"cache-control": "private, no-store",
				"x-content-type-options": "nosniff",
				"content-security-policy": "default-src 'none'; sandbox",
			},
		});
	} catch {
		return json("暂时无法读取图片，请检查网络后重试。", 502);
	}
};
