import assert from "node:assert/strict";
import test from "node:test";
import {
	parseWranglerJson,
	parsePrivateProductionManifest,
	validatePrivatePreviewConfig,
} from "./verify-private-preview-isolation.mjs";

const PRODUCTION = {
	name: "firefly",
	main: "@astrojs/cloudflare/entrypoints/server",
	assets: {
		directory: "./dist",
		run_worker_first: ["/admin", "/admin/*", "/api/admin", "/api/admin/*", "/api/auth/*"],
	},
};
const productionResources = [
	"a".repeat(32),
	"bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
	"firefly-production-backups",
	"c".repeat(32),
];

function safePreview() {
	return {
		name: "firefly-preview-acceptance",
		workers_dev: true,
		main: PRODUCTION.main,
		assets: structuredClone(PRODUCTION.assets),
		kv_namespaces: [
			{ binding: "FIREFLY_SESSIONS", id: "d".repeat(32) },
			{ binding: "FIREFLY_PRIVATE_DRAFTS", id: "e".repeat(32) },
		],
		d1_databases: [{
			binding: "FIREFLY_PRIVATE_DRAFT_DB",
			database_name: "firefly-preview-private-drafts",
			database_id: "ffffffff-2222-4222-8222-ffffffffffff",
		}],
		r2_buckets: [{
			binding: "FIREFLY_PRIVATE_DRAFT_BACKUPS",
			bucket_name: "firefly-preview-private-backups",
		}],
		vars: {
			FIREFLY_PRIVATE_DRAFT_BACKEND: "d1",
			FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE: "false",
		},
	};
}

function violations(change, prodIds=productionResources) {
	const preview = safePreview();
	change(preview);
	return validatePrivatePreviewConfig(PRODUCTION, preview, prodIds).join("\n");
}

test("isolated preview resources and explicit no-migration settings pass the static gate", () => {
	assert.deepEqual(validatePrivatePreviewConfig(PRODUCTION, safePreview(), productionResources), []);
});

test("fail closed without a private production resource manifest", () => {
	assert.match(violations(() => {}, []), /生产 KV、D1、R2/);
	assert.match(violations(() => {}, ["a"]), /生产 KV、D1、R2/);
	assert.throws(() => parsePrivateProductionManifest('{"id":"secret"}'), /数组/);
	assert.throws(() => parsePrivateProductionManifest('["one",2]'), /格式错误/);
});

test("preview cannot be named production or bound to production routes", () => {
	assert.match(violations(p => { p.name = "firefly"; }), /预览 Worker 名称|同名/);
	assert.match(violations(p => { p.name = "firefly-dev"; }), /预览 Worker 名称/);
	assert.match(violations(p => { p.routes = [{ pattern: "0701000.xyz/*" }]; }), /自定义路由/);
	assert.match(violations(p => { p.workers_dev = false; }), /workers.dev/);
	assert.match(violations(p => { p.assets.run_worker_first = []; }), /后台 API/);
	assert.match(violations(p => { p.env = { production: {} }; }), /生产环境/);
});

test("KV/D1/R2 must be distinct and schema-complete", () => {
	assert.match(violations(p => { p.kv_namespaces[0].id = productionResources[0]; }), /生产存储标识/);
	assert.match(violations(p => { p.d1_databases[0].database_id = productionResources[1]; }), /生产存储标识/);
	assert.match(violations(p => { p.r2_buckets[0].bucket_name = productionResources[2]; }), /生产存储标识/);
	assert.match(violations(p => { p.kv_namespaces[1].id = p.kv_namespaces[0].id; }), /复用/);
	assert.match(violations(p => { p.kv_namespaces.pop(); }), /FIREFLY_PRIVATE_DRAFTS/);
	assert.match(violations(p => { p.d1_databases[0].database_id = "REPLACE_ME"; }), /独立 D1/);
	assert.match(violations(p => { p.r2_buckets[0].bucket_name = "private-production"; }), /独立 R2/);
	assert.match(violations(p => { p.r2_buckets.pop(); }), /FIREFLY_PRIVATE_DRAFT_BACKUPS/);
});

test("secrets, migration mode, and fallback KV backend cannot be enabled", () => {
	assert.match(violations(p => { p.vars.FIREFLY_PRIVATE_DRAFT_BACKEND = "kv"; }), /隔离 D1/);
	assert.match(violations(p => { p.vars.FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE = "true"; }), /禁用迁移/);
	assert.match(violations(p => { p.vars.FIREFLY_ADMIN_PASSWORD = "never-store-secrets-in-git"; }), /非敏感运行开关/);
	assert.match(violations(p => { p.vars = undefined; }), /显式指定/);
});

test("JSONC supports comments without destroying URL-like quoted strings", () => {
	const sample = [
		"{",
		"// Wrangler comment",
		'"name": "firefly-preview-acceptance",',
		'"test_url": "https://example.org/a//b",',
		'/* another comment */ "workers_dev": true,',
		"}",
	].join("\n");
	const parsed = parseWranglerJson(sample);
	assert.equal(parsed.test_url, "https://example.org/a//b");
	assert.equal(parsed.workers_dev, true);
	assert.throws(() => parseWranglerJson('{"name":"bad",unquoted:true}'), SyntaxError);
});
