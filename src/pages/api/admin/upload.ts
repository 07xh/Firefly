import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

type RuntimeEnv = {
	IMG_BED_BASE_URL?: string;
	IMG_BED_API_TOKEN?: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif": "gif",
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

function isImageBytes(bytes: Uint8Array, mime: string): boolean {
	if (mime === "image/png") {
		return (
			bytes.length >= 8 &&
			bytes[0] === 0x89 &&
			bytes[1] === 0x50 &&
			bytes[2] === 0x4e &&
			bytes[3] === 0x47 &&
			bytes[4] === 0x0d &&
			bytes[5] === 0x0a &&
			bytes[6] === 0x1a &&
			bytes[7] === 0x0a
		);
	}

	if (mime === "image/jpeg") {
		return (
			bytes.length >= 3 &&
			bytes[0] === 0xff &&
			bytes[1] === 0xd8 &&
			bytes[2] === 0xff
		);
	}

	if (mime === "image/gif") {
		const signature = new TextDecoder().decode(bytes.subarray(0, 6));
		return signature === "GIF87a" || signature === "GIF89a";
	}

	if (mime === "image/webp") {
		return (
			bytes.length >= 12 &&
			new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
			new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
		);
	}

	return false;
}

async function getConfig(): Promise<{ base: URL; token: string } | Response> {
	const env = workerEnv as unknown as RuntimeEnv;
	const rawBase = (env.IMG_BED_BASE_URL || "https://tu.0701000.xyz").trim();
	const token = env.IMG_BED_API_TOKEN?.trim();

	let base: URL;
	try {
		base = new URL(rawBase);
	} catch {
		return json(
			{ error: "图床地址配置无效，请检查 IMG_BED_BASE_URL。" },
			503,
		);
	}

	if (
		base.protocol !== "https:" ||
		base.username ||
		base.password ||
		base.search ||
		base.hash ||
		(base.pathname !== "/" && base.pathname !== "")
	) {
		return json(
			{
				error:
					"图床地址必须是 HTTPS 网站根地址，例如 https://tu.0701000.xyz。",
			},
			503,
		);
	}

	if (!token) {
		return json(
			{
				error:
					"尚未配置 IMG_BED_API_TOKEN，请在 Cloudflare Worker Secrets 中添加图床 API Token。",
			},
			503,
		);
	}

	base.pathname = "/";
	return { base, token };
}

async function upstream(
	base: URL,
	token: string,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("Accept", "application/json");

	return fetch(new URL(path.replace(/^\//, ""), base), {
		...init,
		headers,
		redirect: "error",
	});
}

async function readPayload(
	response: Response,
): Promise<Record<string, unknown> | unknown[]> {
	try {
		const value: unknown = await response.json();
		if (value && typeof value === "object") {
			return value as Record<string, unknown> | unknown[];
		}
		return {};
	} catch {
		return {};
	}
}

function upstreamError(
	response: Response,
	value: Record<string, unknown> | unknown[],
): Response {
	const body = Array.isArray(value) ? {} : value;
	let message = `图床请求失败（HTTP ${response.status}）。`;

	if (typeof body.error === "string") {
		message = body.error;
	} else if (typeof body.message === "string") {
		message = body.message;
	}

	return json(
		{ error: message.slice(0, 240) },
		response.status >= 400 && response.status < 600
			? response.status
			: 502,
	);
}

function encodedPath(path: string): string {
	return path
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
}

function isSafeFilePath(path: unknown): path is string {
	return (
		typeof path === "string" &&
		path.length > 0 &&
		path.length <= 500 &&
		!path.startsWith("/") &&
		!path.includes("\\") &&
		!path.split("/").some((part) => !part || part === "." || part === "..")
	);
}

function imageUrl(base: URL, path: string): string {
	return new URL(`file/${encodedPath(path)}`, base).toString();
}

export const GET: APIRoute = async ({ url }) => {
	const config = await getConfig();
	if (config instanceof Response) return config;

	const start = Math.max(
		0,
		Math.floor(Number(url.searchParams.get("start") || "0") || 0),
	);
	const count = Math.min(
		100,
		Math.max(
			1,
			Math.floor(Number(url.searchParams.get("count") || "40") || 40),
		),
	);
	const query = new URLSearchParams({
		start: String(start),
		count: String(count),
		recursive: "true",
		fileType: "image",
	});
	const search = (url.searchParams.get("search") || "").trim().slice(0, 100);
	if (search) query.set("search", search);

	try {
		const response = await upstream(
			config.base,
			config.token,
			`/api/manage/list?${query.toString()}`,
		);
		const payload = await readPayload(response);
		if (!response.ok) return upstreamError(response, payload);

		const record = Array.isArray(payload) ? {} : payload;
		const files = Array.isArray(record.files) ? record.files : [];
		const normalized = files.flatMap((entry) => {
			if (!entry || typeof entry !== "object") return [];

			const file = entry as Record<string, unknown>;
			if (!isSafeFilePath(file.name)) return [];

			const metadata =
				file.metadata && typeof file.metadata === "object"
					? (file.metadata as Record<string, unknown>)
					: {};
			const mime =
				typeof metadata.FileType === "string"
					? metadata.FileType
					: "";
			if (!mime.startsWith("image/")) return [];

			return [
				{
					name: file.name,
					url: imageUrl(config.base, file.name),
					type: mime || "image/*",
					size:
						metadata.FileSizeBytes !== undefined && metadata.FileSizeBytes !== null
							? String(metadata.FileSizeBytes)
							: typeof metadata.FileSize === "string"
								? metadata.FileSize
								: "",
					timestamp:
						typeof metadata.TimeStamp === "string"
							? metadata.TimeStamp
							: "",
				},
			];
		});

		return json({
			files: normalized,
			totalCount:
				typeof record.totalCount === "number"
					? record.totalCount
					: normalized.length,
		});
	} catch {
		return json(
			{ error: "无法连接图床，请检查地址、服务状态和 Worker 日志。" },
			502,
		);
	}
};

export const POST: APIRoute = async ({ request }) => {
	const config = await getConfig();
	if (config instanceof Response) return config;

	const contentType = (request.headers.get("content-type") || "").toLowerCase();
	if (!contentType.startsWith("multipart/form-data")) {
		return json({ error: "上传请求必须使用 multipart/form-data。" }, 415);
	}

	try {
		const form = await request.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			return json({ error: "请选择图片文件。" }, 400);
		}
		if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
			return json({ error: "图片必须大于 0 且不超过 4 MiB。" }, 413);
		}

		const mime = file.type.toLowerCase();
		const extension = MIME_EXTENSIONS[mime];
		if (!extension) {
			return json(
				{ error: "仅支持 PNG、JPEG、WebP 和 GIF 图片。" },
				415,
			);
		}

		const bytes = new Uint8Array(await file.arrayBuffer());
		if (!isImageBytes(bytes, mime)) {
			return json(
				{ error: "文件内容与图片类型不匹配，已拒绝上传。" },
				415,
			);
		}

		const outgoing = new FormData();
		outgoing.set(
			"file",
			new File(
				[bytes],
				file.name.slice(0, 180) || `image.${extension}`,
				{ type: mime },
			),
		);
		const response = await upstream(
			config.base,
			config.token,
			"/upload?returnFormat=full",
			{ method: "POST", body: outgoing },
		);
		const payload = await readPayload(response);
		if (!response.ok) return upstreamError(response, payload);

		const first = Array.isArray(payload) ? payload[0] : payload;
		if (!first || typeof first !== "object") {
			return json(
				{ error: "图床未返回图片信息，请检查上传渠道设置。" },
				502,
			);
		}

		const data = first as Record<string, unknown>;
		const rawUrl =
			typeof data.publicUrl === "string" && data.publicUrl
				? data.publicUrl
				: typeof data.src === "string"
					? data.src
					: "";
		if (!rawUrl) {
			return json({ error: "图床没有返回图片链接。" }, 502);
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(rawUrl, config.base);
		} catch {
			return json({ error: "图床返回的图片链接格式无效。" }, 502);
		}
		if (
			(parsedUrl.protocol !== "https:") ||
			parsedUrl.username ||
			parsedUrl.password
		) {
			return json(
				{ error: "图床返回了不安全的图片链接，已阻止插入。" },
				502,
			);
		}

		const path =
			typeof data.src === "string"
				? data.src.replace(/^\/file\//, "")
				: file.name;
		return json(
			{
				ok: true,
				path,
				filename: file.name,
				imageUrl: parsedUrl.toString(),
				url: parsedUrl.toString(),
			},
			201,
		);
	} catch {
		return json(
			{ error: "图片上传失败，请检查图床权限、上传渠道和文件大小。" },
			502,
		);
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	const config = await getConfig();
	if (config instanceof Response) return config;

	let input: unknown;
	try {
		input = await request.json();
	} catch {
		return json({ error: "删除请求格式无效。" }, 400);
	}

	const name =
		input && typeof input === "object"
			? (input as Record<string, unknown>).name
			: null;
	if (!isSafeFilePath(name)) {
		return json({ error: "图片路径无效，已拒绝删除。" }, 400);
	}

	try {
		// Confirm the exact item is still an image before destructive deletion.
		const lookup = new URLSearchParams({
			start: "0",
			count: "100",
			recursive: "true",
			fileType: "image",
			search: name,
		});
		const listResponse = await upstream(
			config.base,
			config.token,
			`/api/manage/list?${lookup.toString()}`,
		);
		const listPayload = await readPayload(listResponse);
		if (!listResponse.ok) return upstreamError(listResponse, listPayload);

		const listed =
			!Array.isArray(listPayload) && Array.isArray(listPayload.files)
				? listPayload.files
				: [];
		const match = listed.find(
			(item) =>
				item &&
				typeof item === "object" &&
				(item as Record<string, unknown>).name === name,
		);
		if (!match) {
			return json(
				{ error: "未在图床的图片列表中找到该文件，已取消删除。" },
				404,
			);
		}

		const metadata = (match as Record<string, unknown>).metadata;
		const mime =
			metadata && typeof metadata === "object"
				? (metadata as Record<string, unknown>).FileType
				: "";
		if (typeof mime !== "string" || !mime.startsWith("image/")) {
			return json({ error: "该文件不是图片，已拒绝删除。" }, 415);
		}

		// ImgBed's delete API uses GET; Firefly exposes deletion as protected DELETE.
		const deleteResponse = await upstream(
			config.base,
			config.token,
			`/api/manage/delete/${name.split("/").map((part) => encodeURIComponent(part)).join(",")}`,
			{ method: "GET" },
		);
		const deletePayload = await readPayload(deleteResponse);
		if (!deleteResponse.ok) return upstreamError(deleteResponse, deletePayload);

		const result = Array.isArray(deletePayload) ? {} : deletePayload;
		if (result.success !== true) {
			return json(
				{
					error:
						typeof result.error === "string"
							? result.error.slice(0, 240)
							: "图床未确认删除结果。",
				},
				502,
			);
		}
		return json({ ok: true, message: "图片已删除。" });
	} catch {
		return json(
			{ error: "删除图片失败，请检查图床权限和 Worker 日志。" },
			502,
		);
	}
};
