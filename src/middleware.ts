import { defineMiddleware } from "astro:middleware";
import {
	getSessionToken,
	type SessionKV,
	validateAdminSession,
} from "./lib/admin-session";

function securityHeaders(response: Response): Response {
	const headers = new Headers(response.headers);
	headers.set("cache-control", "private, no-store");
	headers.set("x-content-type-options", "nosniff");
	headers.set("referrer-policy", "no-referrer");
	headers.set("x-frame-options", "DENY");
	headers.set(
		"content-security-policy",
		"frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
	);
	headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
	headers.set("cross-origin-opener-policy", "same-origin");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function errorResponse(
	message: string,
	status: number,
	api: boolean,
	extraHeaders?: Record<string, string>,
): Response {
	const headers = new Headers({
		"cache-control": "no-store",
		"x-content-type-options": "nosniff",
		"referrer-policy": "no-referrer",
		"x-frame-options": "DENY",
		"content-security-policy":
			"frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
		"permissions-policy": "camera=(), microphone=(), geolocation=()",
		"cross-origin-opener-policy": "same-origin",
		...extraHeaders,
	});
	if (api) {
		headers.set("content-type", "application/json; charset=utf-8");
		return new Response(JSON.stringify({ error: message }), {
			status,
			headers,
		});
	}
	headers.set("content-type", "text/plain; charset=utf-8");
	return new Response(message, { status, headers });
}

function redirectToLogin(context: Parameters<Parameters<typeof defineMiddleware>[0]>[0]): Response {
	const login = new URL("/admin/login/", context.url.origin);
	login.searchParams.set(
		"next",
		`${context.url.pathname}${context.url.search}`,
	);
	return securityHeaders(
		new Response(null, {
			status: 302,
			headers: { location: login.toString() },
		}),
	);
}

export const onRequest = defineMiddleware(async (context, next) => {
	const pathname = context.url.pathname;
	const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
	const isAdminApi =
		pathname === "/api/admin" || pathname.startsWith("/api/admin/");
	const isLoginPage =
		pathname === "/admin/login" || pathname === "/admin/login/";

	if (!isAdminPage && !isAdminApi) return next();

	try {
		// The login page remains public; all other admin pages/APIs require a session.
		if (isLoginPage) return securityHeaders(await next());

		// Validate request shape before processing state-changing admin API calls.
		if (
			isAdminApi &&
			!["GET", "HEAD", "OPTIONS"].includes(context.request.method)
		) {
			const origin = context.request.headers.get("Origin");
			if (!origin || origin !== context.url.origin) {
				return errorResponse("请求来源不受允许。", 403, true);
			}
			const contentType = context.request.headers
				.get("Content-Type")
				?.split(";")[0]
				.trim()
				.toLowerCase();
			const isImageUpload =
				(pathname === "/api/admin/upload" || pathname === "/api/admin/upload/") &&
				context.request.method === "POST";
			if (contentType !== "application/json" && !(isImageUpload && contentType === "multipart/form-data")) {
				return errorResponse(
					isImageUpload
						? "后台写入请求必须使用 application/json 或 multipart/form-data。"
						: "后台写入请求必须使用 application/json。",
					415,
					true,
				);
			}
			const contentLength = context.request.headers.get("Content-Length");
			const maxBodyBytes = isImageUpload ? 5 * 1024 * 1024 : 1_048_576;
			if (
				contentLength !== null &&
				(!/^\d+$/.test(contentLength) || Number(contentLength) > maxBodyBytes)
			) {
				return errorResponse(
					isImageUpload ? "图片上传请求超过 5 MiB 限制。" : "请求正文超过 1 MiB 限制。",
					413,
					true,
				);
			}
		}

		// Requests without a session do not need KV access. This also gives a
		// deterministic 302/401 even if a KV binding is temporarily unavailable.
		const token = getSessionToken(context.request);
		if (!token) {
			if (isAdminApi) {
				return errorResponse("登录已失效，请重新登录。", 401, true);
			}
			return redirectToLogin(context);
		}

		// Load Cloudflare bindings only when a protected request needs session validation.
		// A top-level cloudflare:workers import breaks Astro prerendering.
		const { env: workerEnv } = await import("cloudflare:workers");
		const sessions = (workerEnv as unknown as { FIREFLY_SESSIONS?: SessionKV })
			.FIREFLY_SESSIONS;
		if (!sessions) {
			return errorResponse(
				"后台认证尚未配置：请为 Worker 绑定 FIREFLY_SESSIONS KV 命名空间。",
				503,
				isAdminApi,
			);
		}

		const valid = await validateAdminSession(sessions, token);
		if (!valid) {
			if (isAdminApi) {
				return errorResponse("登录已失效，请重新登录。", 401, true);
			}
			return redirectToLogin(context);
		}

		return securityHeaders(await next());
	} catch (error) {
		console.error("[Firefly] admin middleware failure", {
			path: pathname,
			method: context.request.method,
			message: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			"后台认证处理失败，请查看 Worker 日志。",
			500,
			isAdminApi,
			{ "x-firefly-middleware-error": "1" },
		);
	}
});
