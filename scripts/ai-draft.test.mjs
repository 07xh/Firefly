import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../src/pages/api/admin/ai-draft.ts", import.meta.url), "utf8");
const runnable = stripTypeScriptTypes(source
  .replace('import { env as workerEnv } from "cloudflare:workers";', 'const workerEnv = { AI_API_KEY: "test-key", AI_MODEL: "test-model" };')
  .replace('import type { APIRoute } from "astro";', "")
  .replace('import { getActiveAiProvider } from "../../../lib/ai-provider-config";', "const getActiveAiProvider = async () => null;"));
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}`);

async function draft(payload, mode = "generate") {
  const original = globalThis.fetch;
  const requestBodies = [];
  const payloads = Array.isArray(payload) ? payload : [payload];
  let call = 0;
  globalThis.fetch = async (_url, options) => {
    requestBodies.push(JSON.parse(options.body));
    const next = payloads[Math.min(call, payloads.length - 1)];
    call += 1;
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next), { status: 200 });
  };
  try {
    const response = await POST({ request: new Request("https://example.com/api/admin/ai-draft/", { method: "POST", body: JSON.stringify({ mode, prompt: "Write an article", existing: { title: "Old" }, body: "Old body" }) }) });
    return { status: response.status, data: await response.json(), requestBody: requestBodies[0], requestBodies, calls: requestBodies.length };
  } finally { globalThis.fetch = original; }
}

const valid = { title: "Title", slug: "title", description: "Summary", category: "Notes", tags: ["a"], body: "Body" };
const choice = (content, finish_reason = "stop") => ({ choices: [{ finish_reason, message: { content } }] });

test("accepts JSON in a fenced text part without forcing response_format on compatible providers", async () => {
  const result = await draft(choice([{ type: "text", text: `\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`` }]));
  assert.equal(result.status, 200);
  assert.equal(result.data.draft.body, "Body");
  assert.equal(result.requestBody.response_format, undefined);
});

test("retries a length-limited response with a compact prompt and accepts only complete JSON", async () => {
  const result = await draft([
    choice('{"title":"Partial"', "length"),
    choice(JSON.stringify(valid), "stop"),
  ]);
  assert.equal(result.status, 200);
  assert.equal(result.data.draft.body, "Body");
  assert.equal(result.calls, 2);
  assert.equal(result.requestBodies[0].max_tokens, 7000);
  assert.equal(result.requestBodies[1].max_tokens, 4000);
  assert.match(result.requestBodies[1].messages[1].content, /1800 个汉字以内/);
});

test("rejects a second length-limited response with actionable diagnostics", async () => {
  const result = await draft([
    choice('{"title":"Partial"', "length"),
    choice('{"title":"Still partial"', "length"),
  ]);
  assert.equal(result.status, 502);
  assert.match(result.data.error, /连续两次.*长度上限/);
  assert.match(result.data.error, /finish_reason=length/);
  assert.match(result.data.error, /4000 tokens/);
  assert.equal(result.data.draft, undefined);
  assert.equal(result.calls, 2);
});

test("reports malformed JSON specifically without echoing provider output", async () => {
  const result = await draft(choice("secret-provider-body {broken}"));
  assert.equal(result.status, 502);
  assert.match(result.data.error, /JSON/);
  assert.doesNotMatch(JSON.stringify(result.data), /secret-provider-body/);
});

test("rejects missing required draft fields", async () => {
  const result = await draft(choice(JSON.stringify({ title: "Title", body: "Body" })));
  assert.equal(result.status, 502);
  assert.match(result.data.error, /字段/);
});

test("reports network failures without leaking exception text", async () => {
  const result = await draft(new Error("secret-network-details"));
  assert.equal(result.status, 502);
  assert.match(result.data.error, /网络|连接/);
  assert.doesNotMatch(JSON.stringify(result.data), /secret-network-details/);
});
