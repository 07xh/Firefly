import { defineMiddleware } from "astro:middleware";
import {
  getSessionToken,
  validateAdminSession,
  type SessionKV,
} from "./lib/admin-session";

type AdminEnv = {
  FIREFLY_SESSIONS?: SessionKV;
};

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

function errorResponse(message: string, status: number, api: boolean): Response {
  const headers = new Headers({
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "content-security-policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "cross-origin-opener-policy": "same-origin",
  });
  if (api) {
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
  headers.set("content-type", "text/plain; charset=utf-8");
  return new Response(message, { status, headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi =
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  const isLoginPage = pathname === "/admin/login" || pathname === "/admin/login/";

  if (!isAdminPage && !isAdminApi) return next();

  // The login screen is deliberately public; the application session protects every
  // other admin page and API endpoint. The login API lives outside /api/admin.
  if (isLoginPage) return securityHeaders(await next());

  // Enforce same-origin JSON requests and a conservative payload limit for writes.
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
    if (contentType !== "application/json") {
      return errorResponse("后台写入请求必须使用 application/json。", 415, true);
    }
    const contentLength = context.request.headers.get("Content-Length");
    if (
      contentLength !== null &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > 1_048_576)
    ) {
      return errorResponse("请求正文超过 1 MiB 限制。", 413, true);
    }
  }

  const env = (context.locals as unknown as { runtime?: { env?: AdminEnv } })
    .runtime?.env;
  const sessions = env?.FIREFLY_SESSIONS;
  if (!sessions) {
    return errorResponse(
      "后台认证尚未配置：请为 Worker 绑定 FIREFLY_SESSIONS KV 命名空间。",
      503,
      isAdminApi,
    );
  }

  const token = getSessionToken(context.request);
  if (!token) {
    if (isAdminApi) {
      return errorResponse("登录已失效，请重新登录。", 401, true);
    }
    const login = new URL("/admin/login/", context.url.origin);
    login.searchParams.set("next", pathname + context.url.search);
    return Response.redirect(login.toString(), 302);
  }

  let valid = false;
  try {
    valid = await validateAdminSession(sessions, token);
  } catch {
    return errorResponse("后台会话服务暂时不可用，请稍后重试。", 503, isAdminApi);
  }
  if (!valid) {
    if (isAdminApi) {
      return errorResponse("登录已失效，请重新登录。", 401, true);
    }
    const login = new URL("/admin/login/", context.url.origin);
    login.searchParams.set("next", pathname + context.url.search);
    return Response.redirect(login.toString(), 302);
  }

  return securityHeaders(await next());
});
