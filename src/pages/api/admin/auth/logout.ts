import type { APIRoute } from "astro";
import { clearSessionCookie, isSameOriginRequest, jsonResponse } from "../../../../lib/admin-auth";

export const POST: APIRoute = async ({ request, url }) => {
  if (!isSameOriginRequest(request, url)) {
    return jsonResponse({ error: "请求来源不受允许" }, 403);
  }
  return jsonResponse({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
};
