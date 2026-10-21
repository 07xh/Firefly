import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	changesVisitorFrontend,
	forbiddenVisitorChanges,
	parseGitNameStatus,
	isAdminFocusedBranch,
	validateAdminOnlyChanges,
} from "./check-admin-only-changes.mjs";

test("admin-focused branches are selected for the visitor UI freeze", () => {
	for (const branch of [
		"feat/private-draft-d1-atomic-backend-20261021",
		"feat/admin-system-health-20261021",
		"feat/cloudflare-imgbed-admin-20261019",
		"fix/admin-data-safety-20261021",
		"fix/imgbed-delete-references-20261021",
		"ci/admin-only-frontend-freeze-20261021",
		"ci/pr-target-all-branches-20261021",
		"fix/private-draft-record-integrity-20261021",
		"fix/private-backup-audit-listing-integrity-20261021",
		"security/admin-session-secret-rotation-20261020",
		"perf/admin-article-lazy-content-20261021",
		"integration/admin-private-safety-20261021",
	]) assert.equal(isAdminFocusedBranch(branch), true, branch);
	assert.equal(isAdminFocusedBranch("feature/homepage-redesign"), false);
});

test("a visitor-facing component, article or site config is forbidden", () => {
	for (const path of [
		"src/components/Nav.astro",
		"src/layouts/Base.astro",
		"src/styles/global.css",
		"src/assets/banner.png",
		"src/content/posts/example.md",
		"src/pages/index.astro",
		"src/pages/posts/[...slug].astro",
		"src/data/settings.json",
		"src/i18n/zh.ts",
		"public/images/home.png",
		"astro.config.mjs",
		"package.json",
		"pnpm-lock.yaml",
	]) assert.equal(changesVisitorFrontend(path), true, path);
});

test("backend, admin-only, and test files remain allowed", () => {
	for (const path of [
		"src/pages/admin/index.astro",
		"src/pages/admin/system.astro",
		"src/pages/api/admin/private-drafts.ts",
		"src/pages/api/auth/login.ts",
		"src/lib/private-draft-d1.ts",
		"public/admin-wysiwyg.js",
		"scripts/admin-session.test.mjs",
		"docs/ADMIN_IMPLEMENTATION_ROADMAP.md",
		".github/workflows/build.yml",
	]) assert.equal(changesVisitorFrontend(path), false, path);
});

test("mixed backend + frontend change fails instead of ignoring frontend files", () => {
	const paths=["src/lib/private-drafts.ts","src/pages/index.astro","src/content/posts/secret.md"];
	assert.deepEqual(forbiddenVisitorChanges(paths),["src/pages/index.astro","src/content/posts/secret.md"]);
	assert.throws(() => validateAdminOnlyChanges(paths), /不允许修改前台文件/);
	assert.equal(validateAdminOnlyChanges(["src/lib/private-drafts.ts","src/pages/admin/index.astro"]),2);
});

test("guard starts when called from a relative CLI script path", () => {
	const output=execFileSync(process.execPath,["scripts/check-admin-only-changes.mjs"],{
		cwd:process.cwd(),
		env:{...process.env,GITHUB_EVENT_NAME:"push"},
		encoding:"utf8",
	});
	assert.match(output,/Skipping visitor UI freeze/);
});

test("name-status parser checks removed visitor files and both rename locations", () => {
	const changes = "M\0src/lib/private-drafts.ts\0D\0src/pages/index.astro\0R100\0src/content/posts/old.md\0src/pages/admin/old.astro\0";
	const paths = parseGitNameStatus(changes);
	assert.deepEqual(paths, [
		"src/lib/private-drafts.ts",
		"src/pages/index.astro",
		"src/content/posts/old.md",
		"src/pages/admin/old.astro",
	]);
	assert.deepEqual(forbiddenVisitorChanges(paths), [
		"src/pages/index.astro",
		"src/content/posts/old.md",
	]);
});

test("name-status parser does not discard unsafe paths when Git output is malformed", () => {
	assert.deepEqual(parseGitNameStatus(""), []);
	for (const value of [
		"M\0src/pages/index.astro",
		"M\0",
		"R100\0src/pages/index.astro\0",
		"BAD\0src/pages/index.astro\0",
		"M\0src/lib/private-drafts.ts\0D\0",
	]) assert.throws(() => parseGitNameStatus(value), /Git diff/);
});

test("renaming an admin file into the visitor site also fails visitor freeze", () => {
	const paths = parseGitNameStatus("R088\0src/pages/admin/old.astro\0src/pages/index.astro\0");
	assert.throws(() => validateAdminOnlyChanges(paths), /不允许修改前台文件/);
});
