import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const page = readFileSync(new URL("src/pages/admin/index.astro", root), "utf8");
const css = readFileSync(new URL("public/admin-workspace.css", root), "utf8");

test("workspace redesign stays on the admin-only route", () => {
  assert.match(page, /<body class="admin-workspace">/);
  assert.match(page, /href="\/admin-workspace\.css\?v=/);
  assert.match(page, /<aside class="admin-navigation"[^>]*>/);
  assert.match(page, /<main class="wrap" id="adminMain">/);
  assert.doesNotMatch(css, /@import\s+url\(/);
});

test("retains public-post editor actions and auth controls", () => {
  for (const id of ["logout", "tabArticles", "tabAppearance", "tabAiProviders", "articlesTabPanel", "appearanceTabPanel", "aiProvidersTabPanel", "editor", "body", "new", "search", "statusFilter", "list", "visualTab", "editorTab", "previewTab", "saveDraft", "publish", "delete", "reset", "settingsForm", "aiProviderForm"]) {
    assert.match(page, new RegExp('id="' + id + '"'), id + " must remain");
  }
  for (const label of ["role=\"tablist\"", "role=\"tabpanel\"", "aria-labelledby=\"tabArticles\""]) assert.ok(page.includes(label), label);
});

test("responsive views and screen reader controls remain supported", () => {
  for (const breakpoint of ["1300px", "1299px", "920px", "640px"]) assert.ok(css.includes(breakpoint));
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(page, /class="admin-skip-link" href="#adminMain"/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("all styling is scoped to the admin workspace", () => {
  const rules = css.split("\n").filter(line => line.trim().endsWith("{") && !line.trim().startsWith("/*") && !line.trim().startsWith("@"));
  for (const rule of rules) {
    assert.ok(rule.includes(".admin-workspace") || rule.includes("body.admin-workspace"), "selector should be scoped: " + rule);
  }
});

test("settings editor always supplies its loaded revision on save", () => {
  assert.match(page, /let settingsRevision = null;/);
  assert.match(page, /response\.headers\.get\("ETag"\)/);
  assert.match(page, /"If-Match":settingsRevision/);
  assert.match(page, /data\.settingsVersion/);
  assert.match(page, /settingsReady = false;/);
});

test("settings revision regression tests run with existing admin CI suite", () => {
  const result = spawnSync(process.execPath, [
    "--experimental-strip-types", "--test", "scripts/admin-settings-revision.test.mjs",
  ], { cwd: fileURLToPath(root), encoding: "utf8" });
  assert.equal(result.status, 0, (result.stdout || "") + (result.stderr || ""));
});
