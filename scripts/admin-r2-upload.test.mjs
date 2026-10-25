import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
// The parent CI runs Node tests BEFORE pnpm install on both Node 22/23.
// Execute the real TS implementation using Node's own built-in type-strip
// instead of requiring tsx or a downloaded dependency.
const r2Source = readFileSync(new URL("src/lib/admin-r2-image-upload.ts", root), "utf8");
const r2Code = stripTypeScriptTypes(r2Source, { mode: "strip" });
const { normalizeR2PublicBaseUrl, newR2ImageKey, uploadImageToR2 } =
  await import("data:text/javascript;base64," + Buffer.from(r2Code).toString("base64"));
const route = readFileSync(new URL("src/pages/api/admin/upload.ts", root), "utf8");
const middleware = readFileSync(new URL("src/middleware.ts", root), "utf8");
const sourceEditor = readFileSync(new URL("public/admin-enhancements.js", root), "utf8");
const visualEditor = readFileSync(new URL("public/admin-wysiwyg.js", root), "utf8");
const fixedUuid = "123e4567-e89b-42d3-a456-426614174000";

test("R2 public base must be a safe HTTPS origin or simple optional prefix", () => {
  assert.equal(normalizeR2PublicBaseUrl("https://img.example.com/"), "https://img.example.com");
  assert.equal(normalizeR2PublicBaseUrl(" https://img.example.com/articles/2026/ "), "https://img.example.com/articles/2026");
  for (const bad of [
    "", "http://img.example.com", "https://user:pass@img.example.com",
    "https://localhost", "https://127.0.0.1", "https://192.168.10.3",
    "https://10.2.3.4", "https://172.16.1.2", "https://images.local",
    "https://img.example.com?foo=bar", "https://img.example.com/path#hash",
    "https://img.example.com:8443", "https://img.example.com/%2Fprivate",
  ]) {
    assert.throws(() => normalizeR2PublicBaseUrl(bad), Error, bad);
  }
});

test("R2 object key is new immutable date-scoped UUID path, not the old GitHub image path", () => {
  const key = newR2ImageKey("image/png", new Date("2026-10-25T13:40:00Z"), fixedUuid);
  assert.equal(key, "firefly/2026/10/25/123e4567e89b42d3a456426614174000.png");
  assert.ok(!key.includes("src/assets/images"));
  assert.throws(() => newR2ImageKey("image/svg+xml", new Date(), fixedUuid));
  assert.throws(() => newR2ImageKey("image/png", new Date(), "unsafe/../../image"));
});

test("successful R2 PUT uses bucket binding, correct content metadata and a fully qualified public URL", async () => {
  const puts = [];
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);
  const bucket = {
    async put(key, payload, options) {
      puts.push({ key, payload, options });
      return { key };
    },
  };
  const result = await uploadImageToR2({
    bucket,
    publicBaseUrl: "https://img.example.com",
    bytes,
    mime: "image/png",
    now: new Date("2026-10-25T13:40:00Z"),
    uuid: fixedUuid,
  });
  assert.equal(puts.length, 1);
  assert.equal(puts[0].key, result.key);
  assert.deepEqual(puts[0].payload, bytes);
  assert.equal(puts[0].options.httpMetadata.contentType, "image/png");
  assert.match(puts[0].options.httpMetadata.cacheControl, /immutable/);
  assert.equal(result.filename, "123e4567e89b42d3a456426614174000.png");
  assert.equal(result.imageUrl, "https://img.example.com/" + result.key);
});

test("R2 configuration and storage errors fail closed, never pretend the write succeeded", async () => {
  const bytes = new Uint8Array([1]);
  await assert.rejects(uploadImageToR2({
    publicBaseUrl: "https://img.example.com", mime: "image/png", bytes,
  }), /FIREFLY_IMAGE_R2/);
  await assert.rejects(uploadImageToR2({
    bucket: { put: async () => ({}) }, mime: "image/png", bytes,
  }), /FIREFLY_R2_PUBLIC_BASE_URL/);
  await assert.rejects(uploadImageToR2({
    bucket: { put: async () => { throw new Error("storage is down"); } },
    publicBaseUrl: "https://img.example.com",
    mime: "image/png", bytes,
  }), /storage is down/);
  let writes = 0;
  const bucket = { put: async () => { writes++; } };
  await assert.rejects(uploadImageToR2({
    bucket, publicBaseUrl: "https://img.example.com",
    mime: "image/svg+xml", bytes,
  }));
  await assert.rejects(uploadImageToR2({
    bucket, publicBaseUrl: "https://img.example.com",
    mime: "image/png", bytes: new Uint8Array(4 * 1024 * 1024 + 1),
  }));
  assert.equal(writes, 0, "invalid files must not reach the R2 bucket");
});

test("existing protected GitHub endpoint remains default, same upload auth/MIME restrictions apply to R2", () => {
  assert.match(route, /requestedProvider === null \? "github"/);
  assert.match(route, /provider !== "github" && provider !== "r2"/);
  assert.match(route, /if \(provider === "r2"\)/);
  assert.match(route, /src\/assets\/images\/\$\{filename\}/);
  assert.match(route, /Authorization: `Bearer \$\{token\}`/);
  assert.match(route, /validMagic\(bytes, mime\)/);
  assert.match(route, /MAX_IMAGE_BYTES = 4 \* 1024 \* 1024/);
  assert.match(route, /storage: "github"/);
  assert.match(route, /storage: "r2"/);
  assert.match(route, /commitSha: null/);
  assert.match(middleware, /validateAdminSession\(sessions, token\)/);
  assert.match(middleware, /pathname === "\/api\/admin\/upload"/);
  assert.match(middleware, /origin !== context\.url\.origin/);
});

test("both Markdown and visual article editors share one opt-in storage selector", () => {
  assert.match(sourceEditor, /select\.id = "fireflyUploadProvider"/);
  assert.match(sourceEditor, /new Option\("GitHub（原有图床）", "github"\)/);
  assert.match(sourceEditor, /new Option\("Cloudflare R2（新增）", "r2"\)/);
  assert.match(sourceEditor, /form\.append\("provider", provider\)/);
  assert.match(visualEditor, /getElementById\("fireflyUploadProvider"\)/);
  assert.match(visualEditor, /form\.append\("provider", provider\)/);
  assert.match(visualEditor, /data\.storage === "r2"/);
  assert.doesNotMatch(sourceEditor, /localStorage\.setItem\("fireflyUploadProvider"/);
});
