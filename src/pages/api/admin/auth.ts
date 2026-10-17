import type { APIRoute } from "astro";
import {
  clearAdminSession,
  getSessionToken,
  sessionCookie,
  SESSION_COOKIE,
  type SessionKV,
} from "../../../lib/admin-session";

type LogoutEnv = {
  FIREFLY_SESSIONS?: SessionKV;
};

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as unknown as { runtime?: { env?: LogoutEnv } })
    .runtime?.env;
  const sessions = env?.FIREFLY_SESSIONS;
  const token = getSessionToken(request);
  try {
    await clearAdminSession(sessions, token);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "set-cookie": SESSION_COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
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
