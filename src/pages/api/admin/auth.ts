import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";

import {
	clearAdminSession,
	getSessionToken,
	SESSION_COOKIE,
	type SessionKV,
} from "../../../lib/admin-session";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const sessions = (workerEnv as unknown as { FIREFLY_SESSIONS?: SessionKV })
		.FIREFLY_SESSIONS;
	const token = getSessionToken(request);
	try {
		await clearAdminSession(sessions, token);
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store",
				"set-cookie":
					SESSION_COOKIE +
					"=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
				"x-content-type-options": "nosniff",
				"referrer-policy": "no-referrer",
			},
		});
	} catch {
		return new Response(JSON.stringify({ error: "退出登录失败，请重试。" }), {
			status: 503,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store",
			},
		});
	}
};
