import assert from "node:assert/strict";
import test from "node:test";
import { checkChangedPaths } from "./guard-admin-only-changes.mjs";

test("only known admin files and their dedicated checks are allowed", () => {
  const paths = [
    "src/pages/admin/index.astro",
    "src/pages/admin/login.astro",
    "src/pages/api/admin/articles.ts",
    "src/pages/api/auth/login.ts",
    "src/components/admin/Editor.svelte",
    "src/lib/admin-session.ts",
    "src/lib/ai-provider-config.ts",
    "src/styles/admin-index.css",
    "public/admin-wysiwyg.js",
    "public/admin/settings.html",
    "scripts/admin-mint.test.mjs",
    "scripts/ai-draft.test.mjs",
    "docs/ADMIN_IMPLEMENTATION_ROADMAP.md",
    ".github/workflows/admin-only-guard.yml",
    "scripts/guard-admin-only-changes.mjs",
    "scripts/guard-admin-only-changes.test.mjs",
  ];
  assert.deepEqual(checkChangedPaths(paths), []);
});

test("public UI, site content, shared config and production deploy changes are blocked", () => {
  const forbidden = [
    "src/pages/index.astro",
    "src/pages/manage.astro",
    "src/pages/posts/[...slug].astro",
    "src/components/layout/Navbar.astro",
    "src/layouts/MainGridLayout.astro",
    "src/styles/main.css",
    "src/config/siteConfig.ts",
    "src/data/settings.json",
    "src/content/posts/example.md",
    "public/favicon/favicon.ico",
    "astro.config.mjs",
    "package.json",
    "pnpm-lock.yaml",
    "src/middleware.ts",
    ".github/workflows/deploy-cloudflare.yml",
    ".github/workflows/build.yml",
    "docs/README.ja.md",
    "07xh/engineering-drawing-study",
    "../src/pages/admin/index.astro",
    "src\\pages\\admin\\index.astro",
  ];
  assert.deepEqual(checkChangedPaths(forbidden), forbidden);
});

test("all changes are evaluated, including mixed backend and frontend changes", () => {
  assert.deepEqual(
    checkChangedPaths(["src/pages/api/admin/articles.ts", "src/pages/archive.astro"]),
    ["src/pages/archive.astro"],
  );
});
