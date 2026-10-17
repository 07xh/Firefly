import type { APIRoute } from "astro";
import { authConfigReady, getAdminAuthEnv, isValidSession, jsonResponse } from "../../../../lib/admin-auth";

export const GET: APIRoute = async ({ request, locals }) => {
  const env = getAdminAuthEnv(locals);
  if (!authConfigReady(env)) {
    return jsonResponse({ authenticated: false, error: "后台登录尚未配置" }, 503);
  }
  const authenticated = await isValidSession(request, env.ADMIN_SESSION_SECRET!);
  return jsonResponse({ authenticated }, authenticated ? 200 : 401);
};
