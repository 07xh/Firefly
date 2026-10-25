import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeAdminHealth } from "../src/lib/admin-system-health.ts";

test("never exposes tokens, admin password, backend IDs or private records", () => {
	const report = summarizeAdminHealth({
		FIREFLY_ADMIN_PASSWORD: "SECRET_PASSWORD_000000000000000000",
		FIREFLY_CONTENTS_TOKEN: "SECRET_GITHUB_TOKEN_00000",
		FIREFLY_SESSIONS: { namespace: "PRIVATE_SESSION_KV_ID" },
		FIREFLY_PRIVATE_DRAFTS: { id: "PRIVATE_DRAFT_KV" },
		FIREFLY_PRIVATE_DRAFT_DB: { id: "PRIVATE_DRAFT_D1" },
		FIREFLY_PRIVATE_DRAFT_BACKUPS: { id: "PRIVATE_DRAFT_R2" },
		IMG_BED_API_TOKEN: "SECRET_IMAGE_HOST_TOKEN_000",
	});
	const visible = JSON.stringify(report);
	for (const forbidden of [
		"SECRET_PASSWORD_", "SECRET_GITHUB_TOKEN_", "PRIVATE_SESSION_KV_ID",
		"PRIVATE_DRAFT_KV", "PRIVATE_DRAFT_D1", "PRIVATE_DRAFT_R2",
		"SECRET_IMAGE_HOST_TOKEN_",
	]) assert.equal(visible.includes(forbidden), false, forbidden + " leaked");
	assert.equal(report.status, "ready");
	assert.deepEqual(report.issues, []);
	assert.equal(report.optional.privateDraftD1Bound, true);
});

test("current base requirements are explicit and optional storage never blocks ready", () => {
	const report = summarizeAdminHealth({
		FIREFLY_ADMIN_PASSWORD: "x".repeat(16),
		FIREFLY_SESSIONS: {},
		FIREFLY_CONTENTS_TOKEN: "test",
	});
	assert.equal(report.status, "ready");
	assert.equal(report.optional.privateDraftKvBound, false);
	assert.equal(report.optional.privateDraftR2Bound, false);
	assert.equal(report.optional.externalImageHostTokenConfigured, false);
});

test("missing required secrets are reported safely without giving values", () => {
	const report = summarizeAdminHealth({ FIREFLY_ADMIN_PASSWORD: "short" });
	assert.equal(report.status, "needs_attention");
	assert.equal(report.issues.length, 3);
	assert.equal(report.authentication.passwordConfigured, false);
	assert.equal(report.authentication.sessionKvBound, false);
	assert.equal(report.github.tokenConfigured, false);
});

test("diagnostics endpoint inherits protected admin middleware and cannot write", () => {
	const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
	const api = readFileSync(new URL("../src/pages/api/admin/system-health.ts", import.meta.url), "utf8");
	assert.match(middleware, /pathname\.startsWith\("\/api\/admin\/"\)/);
	assert.match(api, /export const GET: APIRoute/);
	assert.match(api, /AbortSignal\.timeout\(5000\)/);
	assert.match(api, /\/contents\/package\.json\?ref=/);
	assert.doesNotMatch(api, /\/contents\/src\/data\/settings\.json\?ref=/);
	assert.doesNotMatch(api, /export const (?:POST|PUT|PATCH|DELETE)/);
	assert.doesNotMatch(api, /return json\(env\)/);
	assert.doesNotMatch(api, /(?<!\w)(?:console\.log)\(/);
});

test("admin system display uses safe DOM APIs and includes manual probing", () => {
	const page = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");
	const js = readFileSync(new URL("../public/admin-system-health.js", import.meta.url), "utf8");
	const css = readFileSync(new URL("../public/admin-system-health.css", import.meta.url), "utf8");
	assert.match(page, /id="adminSystemHealthProbe"/);
	assert.match(page, /id="adminSystemHealthReport"/);
	assert.match(page, /admin-system-health\.js/);
	assert.match(page, /admin-system-health\.css/);
	assert.match(js, /\/api\/admin\/system-health\//);
	assert.match(js, /replaceChildren\(/);
	assert.match(js, /textContent/);
	assert.doesNotMatch(js, /innerHTML\s*=/);
	assert.doesNotMatch(js, /method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
	for (const line of css.split("\n").filter((line) => line.includes("{") && !line.trim().startsWith("@"))) {
		assert.match(line, /\.admin-workspace/);
	}
});
