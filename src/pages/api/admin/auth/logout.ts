import type { APIRoute } from "astro";
import {
	authConfigReady,
	clearSessionCookie,
	getAdminAuthEnv,
	isSameOriginRequest,
	jsonResponse,
	revokeSession,
} from "../../../../lib/admin-auth";

export const POST: APIRoute = async ({ request, url, locals }) => {
	if (!isSameOriginRequest(request, url)) {
		return jsonResponse({ error: "请求来源不受允许" }, 403);
	}

	const env = getAdminAuthEnv(locals);
	if (authConfigReady(env)) {
		await revokeSession(request, env.SESSION);
	}
	return jsonResponse(
		{ ok: true },
		200,
		{ "set-cookie": clearSessionCookie() },
	);
};
