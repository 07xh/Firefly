import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("../src/pages/api/admin/dynamics.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/pages/admin/dynamics/index.astro", import.meta.url), "utf8");
const client = readFileSync(new URL("../public/admin-dynamics.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../src/content.config.ts", import.meta.url), "utf8");

test("dynamics only uses the existing content directory and schema fields", () => {
  assert.match(api, /const ROOT = "src\/content\/dynamic\/";/);
  assert.match(api, /FILE_PATTERN = \/\^src\\\/content\\\/dynamic/);
  assert.match(schema, /loader: glob\(\{ pattern: "\*\*\/\*\.md", base: "\.\/src\/content\/dynamic" \}\)/);
  for (const item of ["published", "pinned", "location", "body"]) {
    assert.ok(api.includes(item));
  }
});

test("management endpoints use protected route and existing session middleware", () => {
  assert.match(middleware, /pathname\.startsWith\("\/api\/admin\/"\)/);
  assert.match(middleware, /validateAdminSession\(sessions, token\)/);
  assert.match(middleware, /origin !== context\.url\.origin/);
  assert.match(api, /export const GET: APIRoute/);
  assert.match(api, /export const POST: APIRoute/);
  assert.match(api, /export const PUT: APIRoute/);
  assert.match(api, /export const DELETE: APIRoute/);
  assert.match(api, /file\.sha !== value\.sha/g);
  assert.match(api, /content: encodeUtf8\(body\)/);
});

test("UI exposes all CRUD, preview and existing image uploader controls", () => {
  for (const id of ["list", "search", "new", "editor", "published", "location", "pinned",
    "body", "preview", "save", "remove", "imageFile", "insertImage"]) {
    assert.ok(page.includes('id="' + id + '"'), "missing UI control " + id);
  }
  assert.match(page, /src="\/admin-dynamics\.js"/);
  assert.match(client, /\/api\/admin\/dynamics\//);
  assert.match(client, /\/api\/admin\/preview\//);
  assert.match(client, /\/api\/admin\/upload\//);
  assert.match(client, /window\.confirm/);
  assert.match(client, /encodeURIComponent\(item\.path\)/);
  assert.match(index, /href="\/admin\/dynamics\/"/);
});

test("dynamic samples remain readable and unchanged", () => {
  const paths = ["2026-07-15-010756.md", "2026-07-15-020613.md", "2026-07-15-021127.md"];
  for (const name of paths) {
    const source = readFileSync(new URL("../src/content/dynamic/" + name, import.meta.url), "utf8");
    assert.match(source, /^---\r?\npublished: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    assert.match(source, /\n---\r?\n/);
  }
});

test("dynamic API validates datetime, body length and immutable file path", () => {
  assert.match(api, /function validDateTime/);
  assert.match(api, /getUTCFullYear\(\) === Number\(year\)/);
  assert.match(api, /encode\(input\.body\)\.length > 200_000/);
  assert.match(api, /typeof input\.pinned !== "boolean"/);
  assert.match(api, /function safePath/);
  assert.match(api, /sha !== value\.sha/);
  assert.match(api, /response\.status === 409 \|\| response\.status === 422/);
});
