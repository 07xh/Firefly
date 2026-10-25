import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// Keep dedicated create/duplicate regressions in the existing protected admin test step.
import "./admin-article-duplicates.test.mjs";
import "./admin-article-create.test.mjs";
import "./admin-pagescms-workspace.test.mjs";

const root = new URL("../", import.meta.url);
const admin = readFileSync(new URL("src/pages/admin/index.astro", root), "utf8");
const api = readFileSync(new URL("src/pages/api/admin/articles.ts", root), "utf8");
const listing = readFileSync(new URL("src/utils/content-utils.ts", root), "utf8");

function pureAdminFunction(name) {
  const source = admin.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n\\}"));
  assert.ok(source, name + " should exist");
  return new Function("return (" + source[0] + ");")();
}

test("published article converts to draft while saving scheduled articles preserves scheduling", () => {
  const convert = pureAdminFunction("shouldConvertToDraft");
  assert.equal(convert("save", { draft: false }, false, ""), true);
  assert.equal(convert("save", { draft: false }, false, "2020-01-01T00:00:00+08:00"), true);
  assert.equal(convert("save", { draft: false }, false, "2099-01-01T00:00:00+08:00"), false);
  assert.equal(convert("publish", { draft: false }, false, ""), false);
  assert.equal(convert("save", { draft: true }, true, ""), false);
  assert.equal(convert("save", { draft: true }, false, ""), false);
  assert.equal(convert("save", null, false, ""), false);
  assert.match(admin, /const isDraft = mode === "publish" \? false : convertingToDraft \|\| \$\("draft"\)\.checked/);
  assert.match(api, /content = updateFrontmatterField\(content, "draft", String\(input\.draft\)\)/);
});

test("delete resolves a stable article path, never display text or status labels", () => {
  const resolve = pureAdminFunction("articlePathForDeleteButton");
  const path = "src/content/posts/python-symbol-guide.md";
  assert.equal(resolve({ closest: () => ({ dataset: { adminArticlePath: path } }) }), path);
  assert.equal(resolve({ closest: () => null }), "");
  assert.match(admin, /row\.dataset\.adminArticlePath=a\.path/);
  assert.match(admin, /const path = articlePathForDeleteButton\(button\)/);
  assert.doesNotMatch(admin, /const path = row\?\.querySelectorAll\("span"\)/);
  assert.equal((admin.match(/await api\("DELETE"/g) ?? []).length, 1, "one authoritative delete flow");
  assert.match(api, /method: "DELETE"/);
});

test("production hides drafts rather than exposing source after save", () => {
  assert.match(listing, /if \(data\.draft === true\) return false/);
  assert.ok(api.includes("draft: /^draft:"), "backend must return draft status");
});
