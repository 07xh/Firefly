import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("API keys are obtained from Cloudflare Worker Secrets, not encrypted or stored in KV", async () => {
  const source = await read("../src/lib/ai-provider-config.ts");
  assert.match(source, /function normalizeSecretName/);
  assert.match(source, /AI_API_KEY_/);
  assert.match(source, /function getProviderSecret/);
  const providerSecretLookup = source.slice(source.indexOf("function getProviderSecret"), source.indexOf("function validBaseUrl"));
  assert.match(providerSecretLookup, /normalizeSecretName\\(provider\\.id\\)/);
  assert.doesNotMatch(providerSecretLookup, /AI_API_KEY(?!_)/);
  assert.match(source, /return "AI_API_KEY_" \+ id\.toUpperCase\(\)\.replace\(\/-\/g, "_"/);
  assert.match(source, /url\.protocol !== "https:"/);
  assert.match(source, /AbortSignal\.timeout\(15000\)/);
  assert.match(source, /hasApiKey: Boolean\(getProviderSecret\(provider\)\)/);
  const providerTypeStart = source.indexOf("type ProviderConfig =");
  const providerTypeEnd = source.indexOf("};", providerTypeStart);
  assert.doesNotMatch(source.slice(providerTypeStart, providerTypeEnd), /apiKey/);
  assert.doesNotMatch(source, /AI_CONFIG_ENCRYPTION_KEY|encryptedKey|encryptApiKey|decryptApiKey/);
  assert.match(source, /JSON.stringify/);
});

test("the admin password-style field is display-only and API requests omit key contents", async () => {
  const page = await read("../src/pages/admin/index.astro");
  assert.match(page, /id="aiProviderType"[^>]*>[\s\S]*?其他 OpenAI 兼容服务商/);
  assert.match(page, /id="aiProviderKey" type="password"[^>]*disabled/);
  assert.match(page, /本界面不会接收、读取或保存密钥内容/);
  assert.match(page, /id="aiProviderEnabled" type="checkbox" checked/);
  assert.doesNotMatch(page, /apiKey:\$\("aiProviderKey"\)\.value/);
});

test("the admin provider API lists only status metadata and tests a saved provider secret", async () => {
  const route = await read("../src/pages/api/admin/ai-providers.ts");
  assert.match(route, /listAiProviders/);
  assert.match(route, /saveAiProviders\(input\.provider\)/);
  assert.match(route, /testAiProvider\(input\)/);
  assert.doesNotMatch(route, /input\.apiKey|input\.provider\.apiKey/);
  const middleware = await read("../src/middleware.ts");
  assert.match(middleware, /pathname\.startsWith\("\/api\/admin\/"\)/);
  assert.match(middleware, /validateAdminSession/);
});

test("AI drafting uses the selected provider but keeps a legacy Worker Secret fallback", async () => {
  const route = await read("../src/pages/api/admin/ai-draft.ts");
  assert.match(route, /getActiveAiProvider\(\)/);
  assert.match(route, /env\.AI_API_KEY/);
  assert.match(route, /Worker Secret 与 FIREFLY_SESSIONS KV 绑定/);
});
