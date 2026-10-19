import type { APIRoute } from "astro";
import {
  activateAiProvider,
  listAiProviders,
  saveAiProviders,
  testAiProvider,
} from "../../../lib/ai-provider-config";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "AI 服务管理请求失败。";
  return message.slice(0, 300);
}

export const GET: APIRoute = async () => {
  try {
    return json(await listAiProviders());
  } catch (error) {
    return json({ error: safeMessage(error) }, 503);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json({ error: "配置请求过大，请检查输入内容。" }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "请求内容必须是 JSON 对象。" }, 400);
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "请求内容无法解析，请刷新页面后重试。" }, 400);
  }

  try {
    if (input.action === "save") {
      await saveAiProviders(input.provider);
      return json({ ok: true, message: "服务配置已安全保存。", providers: await listAiProviders() });
    }
    if (input.action === "test") {
      const result = await testAiProvider(input);
      return json({ ok: true, message: "连接测试成功。", result });
    }
    if (input.action === "activate" && typeof input.id === "string") {
      await activateAiProvider(input.id);
      return json({ ok: true, message: "已切换当前 AI 服务。", providers: await listAiProviders() });
    }
    return json({ error: "未知操作，请刷新后台后重试。" }, 400);
  } catch (error) {
    return json({ error: safeMessage(error) }, 400);
  }
};
