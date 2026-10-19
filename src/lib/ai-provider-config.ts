import { env as workerEnv } from "cloudflare:workers";

type ProviderType = "other-openai-compatible";
type ProviderConfig = {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  model: string;
  enabled: boolean;
};
type ProviderStore = { activeId: string; providers: ProviderConfig[]; updatedAt: string };
type KvNamespace = { get(key: string, type?: "text"): Promise<string | null>; put(key: string, value: string): Promise<void> };
type RuntimeEnv = { FIREFLY_SESSIONS?: KvNamespace; AI_API_KEY?: string; AI_API_BASE_URL?: string; AI_MODEL?: string; [key: string]: unknown };

const STORE_KEY = "firefly:ai-provider-config:v2";
const MAX_PROVIDERS = 10;
const SUPPORTED_PROVIDER_TYPE: ProviderType = "other-openai-compatible";

function env(): RuntimeEnv { return workerEnv as unknown as RuntimeEnv; }
function safeText(value: unknown, max: number): string { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

function normalizeSecretName(id: string): string {
  return "AI_API_KEY_" + id.toUpperCase().replace(/-/g, "_");
}

function getProviderSecret(provider: ProviderConfig): string {
  const dedicated = env()[normalizeSecretName(provider.id)];
  return typeof dedicated === "string" ? dedicated.trim() : "";
}

function validBaseUrl(value: unknown): string {
  const raw = safeText(value, 500).replace(/\/+$/, "");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("API 地址必须是完整的 HTTPS URL。"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) {
    throw new Error("API 地址必须使用 HTTPS，且不能包含用户名、密码、查询参数或片段。");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host.includes(":") || /^\d+(?:\.\d+){0,3}$/.test(host) || !host.includes(".") ||
      host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host === "metadata.google.internal") {
    throw new Error("请填写公网 HTTPS 域名，不能使用 IP 地址、本地或内网主机。");
  }
  if (url.pathname.endsWith("/chat/completions")) {
    url.pathname = url.pathname.slice(0, -"/chat/completions".length) || "/";
  }
  return url.toString().replace(/\/+$/, "");
}

function kv(): KvNamespace {
  const binding = env().FIREFLY_SESSIONS;
  if (!binding) throw new Error("Worker 未绑定 FIREFLY_SESSIONS KV，无法保存 AI 服务配置。");
  return binding;
}

function jsonStore(raw: string | null): ProviderStore {
  if (!raw) return { activeId: "", providers: [], updatedAt: "" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("AI 服务配置数据格式损坏，请先检查 KV 配置。"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("AI 服务配置数据格式不正确。");
  const value = parsed as Record<string, unknown>;
  const providers = Array.isArray(value.providers) ? value.providers.slice(0, MAX_PROVIDERS).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const id = safeText(row.id, 60);
    const name = safeText(row.name, 100);
    const model = safeText(row.model, 200);
    try {
      if (!/^[A-Za-z0-9_-]{1,60}$/.test(id) || !name || !model) return [];
      return [{ id, name, model, baseUrl: validBaseUrl(row.baseUrl), type: SUPPORTED_PROVIDER_TYPE, enabled: row.enabled === true }];
    } catch { return []; }
  }) : [];
  const ids = new Set(providers.map((provider) => provider.id));
  return { activeId: typeof value.activeId === "string" && ids.has(value.activeId) ? value.activeId : "", providers, updatedAt: safeText(value.updatedAt, 80) };
}

async function readStore(): Promise<ProviderStore> { return jsonStore(await kv().get(STORE_KEY)); }
async function writeStore(store: ProviderStore): Promise<void> { await kv().put(STORE_KEY, JSON.stringify(store)); }

export async function listAiProviders(): Promise<{ activeId: string; updatedAt: string; providers: Array<{ id: string; name: string; type: ProviderType; baseUrl: string; model: string; enabled: boolean; hasApiKey: boolean; secretName: string }> }> {
  const store = await readStore();
  return {
    activeId: store.activeId, updatedAt: store.updatedAt,
    providers: store.providers.map((provider) => ({
      ...provider, hasApiKey: Boolean(getProviderSecret(provider)), secretName: normalizeSecretName(provider.id),
    })),
  };
}

export async function saveAiProviders(input: unknown): Promise<void> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("请求内容必须是 JSON 对象。");
  const raw = input as Record<string, unknown>;
  const id = safeText(raw.id, 60);
  const name = safeText(raw.name, 100);
  const model = safeText(raw.model, 200);
  const baseUrl = validBaseUrl(raw.baseUrl);
  const enabled = raw.enabled === true;
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) throw new Error("配置标识只能使用英文、数字、下划线和连字符，最长 60 位。");
  if (!name || !model) throw new Error("请填写服务名称和模型 ID。");
  if (raw.type !== undefined && raw.type !== SUPPORTED_PROVIDER_TYPE) throw new Error("当前版本仅支持其他 OpenAI 兼容服务商。");
  const store = await readStore();
  if (!store.providers.some((provider) => provider.id === id) && store.providers.length >= MAX_PROVIDERS) throw new Error("最多支持 10 个 AI 服务配置。");
  const provider: ProviderConfig = { id, name, type: SUPPORTED_PROVIDER_TYPE, model, baseUrl, enabled };
  const providers = [...store.providers.filter((item) => item.id !== id), provider];
  const activeId = enabled ? id : (store.activeId === id ? "" : store.activeId);
  await writeStore({ activeId, providers, updatedAt: new Date().toISOString() });
}

export async function activateAiProvider(id: string): Promise<void> {
  const store = await readStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider || !provider.enabled) throw new Error("请先保存并启用此服务配置。");
  if (!getProviderSecret(provider)) throw new Error("Cloudflare Worker Secret 尚未配置：" + normalizeSecretName(provider.id) + "。请先在 Cloudflare 设置中添加密钥。");
  await writeStore({ ...store, activeId: id, updatedAt: new Date().toISOString() });
}

export async function getActiveAiProvider(): Promise<{ apiKey: string; baseUrl: string; model: string } | null> {
  const store = await readStore();
  const provider = store.providers.find((item) => item.id === store.activeId && item.enabled);
  if (!provider) return null;
  const apiKey = getProviderSecret(provider);
  if (!apiKey) throw new Error("当前 AI 服务缺少 Cloudflare Worker Secret：" + normalizeSecretName(provider.id) + "。请先在 Cloudflare 设置中添加密钥。");
  return { apiKey, baseUrl: validBaseUrl(provider.baseUrl), model: provider.model };
}

export async function testAiProvider(input: unknown): Promise<{ ok: true; model: string; elapsedMs: number }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("请求内容无效。");
  const id = safeText((input as Record<string, unknown>).id, 60);
  const store = await readStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider) throw new Error("请先保存此服务配置，再测试连接。");
  const apiKey = getProviderSecret(provider);
  if (!apiKey) throw new Error("请先在 Cloudflare Worker Secrets 中配置 " + normalizeSecretName(provider.id) + "。此页面不会接收或保存 API Key。");
  const baseUrl = validBaseUrl(provider.baseUrl);
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : baseUrl + "/chat/completions";
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST", headers: { authorization: "Bearer " + apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ model: provider.model, messages: [{ role: "user", content: "Reply with exactly: OK" }], max_tokens: 128 }),
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error("连接失败或超时。请检查 HTTPS 地址、网络和服务商状态；密钥不会返回给浏览器。"); }
  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) throw new Error("认证失败（HTTP " + status + "）。请检查 Cloudflare Secret 是否正确且有权限。");
    if (status === 404) throw new Error("接口或模型不存在（HTTP 404）。请检查 API 地址与模型 ID。");
    if (status === 429) throw new Error("请求过多或额度不足（HTTP 429）。");
    throw new Error("服务商返回 HTTP " + status + "。未读取或回传响应中的敏感内容。");
  }
  const payload = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown }; finish_reason?: unknown }>;
    error?: { message?: unknown; type?: unknown; code?: unknown };
  } | null;
  const message = payload?.choices?.[0]?.message;
  const answer = message?.content;
  const contentText = typeof answer === "string"
    ? answer.trim()
    : Array.isArray(answer)
      ? answer.map((part) => {
          if (!part || typeof part !== "object") return "";
          const item = part as { text?: unknown };
          return typeof item.text === "string" ? item.text : "";
        }).join("").trim()
      : "";
  if (!contentText) {
    // Some reasoning-capable models may spend a tiny token budget on reasoning
    // and return no user-facing content. Keep the probe generous enough to test
    // a real completion, without returning upstream payloads or secrets.
    const hasReasoning = typeof message?.reasoning_content === "string" && message.reasoning_content.trim().length > 0;
    if (hasReasoning) throw new Error("服务已响应，但模型只返回了推理内容，没有生成可见回答。请稍后重试；连接测试已调整为提供更充足的输出额度。");
    const upstreamError = payload?.error;
    if (upstreamError && typeof upstreamError === "object") {
      const errorRecord = upstreamError as { type?: unknown; code?: unknown };
      const code = [errorRecord.type, errorRecord.code].find((value) => typeof value === "string");
      if (typeof code === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(code)) {
        throw new Error("服务商返回了无法识别的 Chat Completions 响应（错误代码：" + code + "）。请检查模型 ID 与服务商接口兼容性。");
      }
    }
    throw new Error("连接成功，但响应中没有可见回答。请检查模型 ID 与 Chat Completions 兼容性。");
  }
  return { ok: true, model: provider.model, elapsedMs: Date.now() - started };
}