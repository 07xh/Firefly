import { env as workerEnv } from "cloudflare:workers";

type ProviderInput = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  encryptedKey?: string;
  iv?: string;
};

type ProviderStore = {
  activeId: string;
  providers: ProviderInput[];
  updatedAt: string;
};

type KvNamespace = {
  get(key: string, type?: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

type RuntimeEnv = {
  FIREFLY_SESSIONS?: KvNamespace;
  AI_CONFIG_ENCRYPTION_KEY?: string;
  AI_API_KEY?: string;
  AI_API_BASE_URL?: string;
  AI_MODEL?: string;
};

const STORE_KEY = "firefly:ai-provider-config:v1";
const MAX_PROVIDERS = 10;

function env(): RuntimeEnv {
  return workerEnv as unknown as RuntimeEnv;
}

function safeText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validBaseUrl(value: unknown): string {
  const raw = safeText(value, 500).replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("API 地址必须是完整的 HTTPS URL。");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search) {
    throw new Error("API 地址必须使用 HTTPS，且不能包含用户名、密码、查询参数或片段。");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  const privateIpv4 = ipv4 && ipv4.slice(1).every(part => Number(part) <= 255) && (
    Number(ipv4[1]) === 0 || Number(ipv4[1]) === 10 ||
    Number(ipv4[1]) === 127 || Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254 ||
    Number(ipv4[1]) === 192 && Number(ipv4[2]) === 168 ||
    Number(ipv4[1]) === 172 && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31
  );
  if (privateIpv4 || host === "localhost" || host.endsWith(".localhost") ||
      host === "::1" || host === "0.0.0.0" || host.endsWith(".local") ||
      host.endsWith(".internal") || host === "metadata.google.internal") {
    throw new Error("不允许使用本地、内网或云元数据主机地址。");
  }
  if (url.pathname.endsWith("/chat/completions")) {
    url.pathname = url.pathname.slice(0, -"/chat/completions".length) || "/";
  }
  return url.toString().replace(/\/+$/, "");
}

async function cryptoKey(): Promise<CryptoKey> {
  const secret = env().AI_CONFIG_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("尚未配置 AI_CONFIG_ENCRYPTION_KEY。请先在 Cloudflare Worker 中添加至少 32 个字符的随机 Secret。");
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptApiKey(value: string): Promise<{ encryptedKey: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await cryptoKey(),
    new TextEncoder().encode(value),
  );
  return {
    encryptedKey: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

async function decryptApiKey(provider: ProviderInput): Promise<string> {
  if (!provider.encryptedKey || !provider.iv) return "";
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(provider.iv) },
    await cryptoKey(),
    base64ToBytes(provider.encryptedKey),
  );
  return new TextDecoder().decode(clear);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function kv(): KvNamespace {
  const binding = env().FIREFLY_SESSIONS;
  if (!binding) throw new Error("Worker 未绑定 FIREFLY_SESSIONS KV，无法保存 AI 服务配置。");
  return binding;
}

async function readStore(): Promise<ProviderStore> {
  const raw = await kv().get(STORE_KEY);
  if (raw) {
    const value = JSON.parse(raw) as Partial<ProviderStore>;
    return {
      activeId: safeText(value.activeId, 80),
      providers: Array.isArray(value.providers) ? value.providers.slice(0, MAX_PROVIDERS) : [],
      updatedAt: safeText(value.updatedAt, 80),
    };
  }


  return { activeId: "", providers: [], updatedAt: "" };
}

async function writeStore(store: ProviderStore): Promise<void> {
  await kv().put(STORE_KEY, JSON.stringify(store));
}

export async function listAiProviders(): Promise<{
  activeId: string;
  updatedAt: string;
  providers: Array<{ id: string; name: string; baseUrl: string; model: string; enabled: boolean; hasApiKey: boolean }>;
}> {
  const store = await readStore();
  return {
    activeId: store.activeId,
    updatedAt: store.updatedAt,
    providers: store.providers.map(({ id, name, baseUrl, model, enabled, encryptedKey }) => ({
      id, name, baseUrl, model, enabled, hasApiKey: Boolean(encryptedKey),
    })),
  };
}

export async function saveAiProviders(input: unknown): Promise<void> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("请求内容必须是 JSON 对象。");
  }
  const raw = input as Record<string, unknown>;
  const id = safeText(raw.id, 80);
  const name = safeText(raw.name, 100);
  const model = safeText(raw.model, 200);
  const baseUrl = validBaseUrl(raw.baseUrl);
  const enabled = raw.enabled === true;
  const apiKey = safeText(raw.apiKey, 2000);
  const clearKey = raw.clearKey === true;
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error("服务 ID 格式不正确。");
  if (!name || !model) throw new Error("请填写服务名称和模型 ID。");
  if (apiKey && apiKey.length < 8) throw new Error("API Key 长度异常，请检查是否粘贴完整。");

  const store = await readStore();
  let previous = store.providers.find((item) => item.id === id);
  if (!previous && store.providers.length >= MAX_PROVIDERS) throw new Error("最多支持 10 个 AI 服务配置。");
  let secretFields: Pick<ProviderInput, "encryptedKey" | "iv"> = {};
  if (apiKey) secretFields = await encryptApiKey(apiKey);
  else if (!clearKey && previous?.encryptedKey && previous.iv) {
    secretFields = { encryptedKey: previous.encryptedKey, iv: previous.iv };
  }

  const provider: ProviderInput = { id, name, model, baseUrl, enabled, ...secretFields };
  const providers = [...store.providers.filter((item) => item.id !== id), provider];
  const activeId = enabled ? id : (store.activeId === id ? "" : store.activeId);
  await writeStore({ activeId, providers, updatedAt: new Date().toISOString() });
}

export async function activateAiProvider(id: string): Promise<void> {
  const store = await readStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider || !provider.enabled || !provider.encryptedKey) {
    throw new Error("请先保存已启用且配置了 API Key 的服务商。");
  }
  await decryptApiKey(provider);
  await writeStore({ ...store, activeId: id, updatedAt: new Date().toISOString() });
}

export async function getActiveAiProvider(): Promise<{ apiKey: string; baseUrl: string; model: string } | null> {
  const store = await readStore();
  const provider = store.providers.find((item) => item.id === store.activeId && item.enabled);
  if (!provider) return null;
  const apiKey = await decryptApiKey(provider);
  if (!apiKey || !provider.model || !provider.baseUrl) return null;
  return { apiKey, baseUrl: validBaseUrl(provider.baseUrl), model: provider.model };
}

export async function testAiProvider(input: unknown): Promise<{ ok: true; model: string; elapsedMs: number }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("请求内容无效。");
  const raw = input as Record<string, unknown>;
  const id = safeText(raw.id, 80);
  const store = await readStore();
  const provider = store.providers.find((item) => item.id === id);
  if (!provider) throw new Error("请先保存此服务配置，再测试连接。");
  const apiKey = await decryptApiKey(provider);
  if (!apiKey) throw new Error("此服务尚未保存 API Key。");
  const baseUrl = validBaseUrl(provider.baseUrl);
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : baseUrl + "/chat/completions";
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: "Bearer " + apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("连接失败或超时。请检查 HTTPS 地址、网络和服务商状态；密钥不会返回给浏览器。");
  }
  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) throw new Error("认证失败（HTTP " + status + "）。请检查 API Key 权限。");
    if (status === 404) throw new Error("接口或模型不存在（HTTP 404）。请检查 API 地址与模型 ID。");
    if (status === 429) throw new Error("请求过多或额度不足（HTTP 429）。");
    throw new Error("服务商返回 HTTP " + status + "。未读取或回传响应中的敏感内容。");
  }
  const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
  const answer = payload?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("连接成功，但响应格式不符合 Chat Completions。");
  return { ok: true, model: provider.model, elapsedMs: Date.now() - started };
}
