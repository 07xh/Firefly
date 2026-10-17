import type { APIRoute } from "astro";
import {
  createSessionToken,
  hashText,
  SESSION_TTL_SECONDS,
  sessionCookie,
  storeAdminSession,
  type SessionKV,
} from "../../../lib/admin-session";

type LoginEnv = {
  FIREFLY_ADMIN_PASSWORD?: string;
  FIREFLY_SESSIONS?: SessionKV;
};

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extraHeaders,
  });
  return new Response(JSON.stringify(data), { status, headers });
}

async function sameSecret(candidate: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return jsonResponse({ error: "请求来源不受允许。" }, 403);
  }
  const contentType = request.headers.get("Content-Type")
    ?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse({ error: "登录请求必须使用 JSON。" }, 415);
  }
  const announcedLength = request.headers.get("Content-Length");
  if (announcedLength && Number(announcedLength) > 8192) {
    return jsonResponse({ error: "登录请求过大。" }, 413);
  }

  const env = (locals as unknown as { runtime?: { env?: LoginEnv } })
    .runtime?.env;
  const password = env?.FIREFLY_ADMIN_PASSWORD;
  const sessions = env?.FIREFLY_SESSIONS;
  if (!password || password.length < 16 || !sessions) {
    return jsonResponse(
      { error: "后台认证尚未配置。请检查 Worker 密码 Secret 与 FIREFLY_SESSIONS KV 绑定。" },
      503,
    );
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8192) {
      return jsonResponse({ error: "登录请求过大。" }, 413);
    }
    let body: { password?: unknown };
    try {
      body = JSON.parse(raw) as { password?: unknown };
    } catch {
      return jsonResponse({ error: "登录请求格式无效。" }, 400);
    }
    if (typeof body.password !== "string" || body.password.length > 4096) {
      return jsonResponse({ error: "请输入有效的管理员密码。" }, 400);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateKey = "login-attempts:" + await hashText(ip);
    const previousText = await sessions.get(rateKey, "text");
    const parsedAttempts = Number(previousText ?? "0");
    const attempts = Number.isInteger(parsedAttempts) && parsedAttempts >= 0
      ? parsedAttempts
      : 0;
    if (attempts >= 5) {
      return jsonResponse(
        { error: "尝试次数过多，请 15 分钟后再试。" },
        429,
        { "retry-after": "900" },
      );
    }

    if (!(await sameSecret(body.password, password))) {
      await sessions.put(rateKey, String(attempts + 1), { expirationTtl: 900 });
      return jsonResponse({ error: "管理员密码不正确。" }, 401);
    }

    await sessions.delete(rateKey);
    const token = createSessionToken();
    await storeAdminSession(sessions, token);
    return jsonResponse(
      { ok: true, expiresIn: SESSION_TTL_SECONDS },
      200,
      { "set-cookie": sessionCookie(token) },
    );
  } catch {
    return jsonResponse({ error: "认证服务暂时不可用，请稍后重试。" }, 503);
  }
};
