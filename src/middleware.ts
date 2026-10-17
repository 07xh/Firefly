import { defineMiddleware } from "astro";
import {
	authConfigReady,
	getAdminAuthEnv,
	isValidSession,
} from "./lib/admin-auth";

function plainResponse(message: string, status: number): Response {
	return new Response(message, {
		status,
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "no-store",
			"x-content-type-options": "nosniff",
			"referrer-policy": "no-referrer",
			"x-frame-options": "DENY",
			"content-security-policy":
				"frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
			"permissions-policy": "camera=(), microphone=(), geolocation=()",
			"cross-origin-opener-policy": "same-origin",
		},
	});
}

function isPublicAuthRoute(pathname: string): boolean {
	return (
		pathname === "/admin/login" ||
		pathname === "/admin/login/" ||
		pathname === "/api/admin/auth/login" ||
		pathname === "/api/admin/auth/login/" ||
		pathname === "/api/admin/auth/logout" ||
		pathname === "/api/admin/auth/logout/" ||
		pathname === "/api/admin/auth/session" ||
		pathname === "/api/admin/auth/session/"
	);
}

export const onRequest = defineMiddleware(async (context, next) => {
	const pathname = context.url.pathname;
	const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
	const isAdminApi =
		pathname === "/api/admin" || pathname.startsWith("/api/admin/");
	if (!isAdminPage && !isAdminApi) return next();

	// Public auth endpoints validate their own request origin and inputs.
	if (isPublicAuthRoute(pathname)) {
		const response = await next();
		const headers = new Headers(response.headers);
		headers.set("cache-control", "no-store");
		headers.set("x-content-type-options", "nosniff");
		headers.set("referrer-policy", "no-referrer");
		headers.set("x-frame-options", "DENY");
		headers.set(
			"content-security-policy",
			"frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
		);
		headers.set(
			"permissions-policy",
			"camera=(), microphone=(), geolocation=()",
		);
		headers.set("cross-origin-opener-policy", "same-origin");
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	// State-changing API requests must be same-origin JSON with a bounded body.
	if (
		isAdminApi &&
		!["GET", "HEAD", "OPTIONS"].includes(context.request.method)
	) {
		if (context.request.headers.get("Origin") !== context.url.origin) {
			return plainResponse("Forbidden: request origin is not allowed.", 403);
		}
		const contentType = context.request.headers
			.get("Content-Type")
			?.split(";")[0]
			.trim()
			.toLowerCase();
		if (contentType !== "application/json") {
			return plainResponse(
				"Unsupported Media Type: admin API writes require application/json.",
				415,
			);
		}
		const contentLength = context.request.headers.get("Content-Length");
		if (
			contentLength !== null &&
			(!/^\d+$/.test(contentLength) || Number(contentLength) > 1_048_576)
		) {
			return plainResponse(
				"Payload Too Large: admin API requests are limited to 1 MiB.",
				413,
			);
		}
	}

	const env = getAdminAuthEnv(context.locals);
	if (!authConfigReady(env)) {
		return plainResponse(
			"Firefly admin is locked: configure ADMIN_PASSWORD and the SESSION KV binding.",
			503,
		);
	}

	const authenticated = await isValidSession(context.request, env.SESSION);
	if (!authenticated) {
		if (isAdminApi) {
			return plainResponse(
				"Unauthorized: please log in to the Firefly admin.",
				401,
			);
		}
		const login = new URL("/admin/login/", context.url.origin);
		login.searchParams.set("next", context.url.pathname + context.url.search);
		return Response.redirect(login.toString(), 302);
	}

	const response = await next();
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
});
