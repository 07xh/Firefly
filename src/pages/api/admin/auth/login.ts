import type { APIRoute } from "astro";
import {
	authConfigReady,
	getAdminAuthEnv,
	isSameOriginRequest,
	jsonResponse,
	passwordMatches,
	sessionCookie,
} from "../../../../lib/admin-auth";

export const POST: APIRoute = async ({ request, url, locals }) => {
	if (!isSameOriginRequest(request, url)) {
		return jsonResponse({ error: "请求来源不受允许" }, 403);
	}

	const contentType = request.headers
		.get("Content-Type")
		?.split(";")[0]
		.trim()
		.toLowerCase();
	if (contentType !== "application/json") {
		return jsonResponse({ error: "仅接受 JSON 登录请求" }, 415);
	}

	const contentLength = request.headers.get("Content-Length");
	if (
		contentLength !== null &&
		(!/^\d+$/.test(contentLength) || Number(contentLength) > 4096)
	) {
		return jsonResponse({ error: "请求过大" }, 413);
	}

	const env = getAdminAuthEnv(locals);
	if (!authConfigReady(env)) {
		return jsonResponse(
			{
				error:
					"后台登录尚未配置。请在 Worker Secrets 中设置 ADMIN_PASSWORD（至少 12 位）和 ADMIN_SESSION_SECRET（至少 32 字节）。",
			},
			503,
		);
	}

	let input: { password?: unknown };
	try {
		const rawBody = await request.text();
		if (new TextEncoder().encode(rawBody).byteLength > 4096) {
			return jsonResponse({ error: "请求过大" }, 413);
		}
		input = JSON.parse(rawBody) as { password?: unknown };
	} catch {
		return jsonResponse({ error: "请求内容不是有效 JSON" }, 400);
	}

	if (
		typeof input.password !== "string" ||
		input.password.length < 1 ||
		input.password.length > 1024
	) {
		return jsonResponse({ error: "请输入有效密码" }, 400);
	}

	if (!(await passwordMatches(input.password, env.ADMIN_PASSWORD))) {
		// Keep the message generic so the endpoint does not reveal configuration details.
		return jsonResponse({ error: "密码不正确" }, 401);
	}

	return jsonResponse(
		{ ok: true },
		200,
		{ "set-cookie": await sessionCookie(env.ADMIN_SESSION_SECRET) },
	);
};
