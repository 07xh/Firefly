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


test("historical dynamics are discovered from the shared Git tree and isolated per file", () => {
  assert.match(api, /git\/trees\//);
  assert.match(api, /recursive=1/);
  assert.match(api, /file\.type === "blob" && safePath\(file\.path\)/);
  assert.match(api, /payload\.truncated/);
  assert.match(api, /Promise\.allSettled/);
  assert.match(api, /warnings/);
  assert.doesNotMatch(api, /if \(response\.status === 404\) return json\(\[\]\)/);
  assert.match(api, /names\.length > 0 && entries\.length === 0/);
});

test("refresh preserves the editor, bypasses stale caches and retains prior list on failure", () => {
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /"\?refresh=" \+ Date\.now\(\)/);
  assert.match(client, /Array\.isArray\(result\) \? result : result\.items/);
  assert.match(client, /已读取/);
  assert.match(client, /原文件未删除/);
  assert.match(client, /读取失败，不代表仓库没有动态/);
  assert.doesNotMatch(client, /\$\("refresh"\)\.addEventListener\("click",[\s\S]{0,110}toNew\(\)/);
});

test("all four historical source files have frontmatter understood by the manager", () => {
  const paths = [
    "2026-07-15-010756.md",
    "2026-07-15-020613.md",
    "2026-07-15-021127.md",
    "2026-07-15-161529.md",
  ];
  for (const name of paths) {
    const source = readFileSync(new URL("../src/content/dynamic/" + name, import.meta.url), "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    assert.ok(match, "broken frontmatter in " + name);
    assert.match(match[1], /^published:\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/m);
    assert.ok(source.slice(match[0].length).trim().length > 0, "empty body in " + name);
  }
});
