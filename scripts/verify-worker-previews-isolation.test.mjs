import assert from "node:assert/strict";
import test from "node:test";
import { verifyWorkerPreviewConfig } from "./verify-worker-previews-isolation.mjs";

const production = {
	name: "firefly",
	workers_dev: true,
	compatibility_date: "2026-10-17",
	main: "@astrojs/cloudflare/entrypoints/server",
	assets: {
		directory: "./dist",
		binding: "ASSETS",
		run_worker_first: ["/admin", "/admin/*", "/api/admin", "/api/admin/*", "/api/auth/*"],
	},
	kv_namespaces: [{ binding: "FIREFLY_SESSIONS" }],
	previews: {},
};
const productionIds = [
	"0".repeat(32),
	"1".repeat(32),
	"aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
	"firefly-production-private-backups",
];

const candidate = () => ({
	...structuredClone(production),
	previews: {
		vars: {
			FIREFLY_PRIVATE_DRAFT_BACKEND: "d1",
			FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE: "false",
		},
		kv_namespaces: [
			{ binding: "FIREFLY_SESSIONS", id: "2".repeat(32) },
			{ binding: "FIREFLY_PRIVATE_DRAFTS", id: "3".repeat(32) },
		],
		d1_databases: [{
			binding: "FIREFLY_PRIVATE_DRAFT_DB",
			database_name: "firefly-preview-drafts",
			database_id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
		}],
		r2_buckets: [{
			binding: "FIREFLY_PRIVATE_DRAFT_BACKUPS",
			bucket_name: "firefly-preview-private-backups",
		}],
	},
});
const violations = (edit, ids = productionIds) => {
	const config = candidate();
	edit(config);
	return verifyWorkerPreviewConfig(production, config, ids).join("\n");
};

test("Worker Previews use unchanged production top-level config with isolated bindings", () => {
	assert.deepEqual(verifyWorkerPreviewConfig(production, candidate(), productionIds), []);
});

test("missing or incomplete private production manifest prevents preflight success", () => {
	assert.match(violations(() => {}, null), /生产资源私有清单/);
	assert.match(violations(() => {}, ["some-resource"]), /生产资源私有清单/);
	assert.match(violations(() => {}, ["a", "b", "c", "d"]), /覆盖会话 KV/);
});

test("top-level production Worker changes fail, including secrets and deployment routes", () => {
	assert.match(violations(c => { c.name = "firefly-preview"; }), /顶层参数/);
	assert.match(violations(c => { c.assets.directory = "./public"; }), /顶层参数/);
	assert.match(violations(c => { c.routes = ["0701000.xyz/*"]; }), /顶层参数/);
	assert.match(violations(c => { c.vars = { TOKEN: "not-secret" }; }), /顶层参数/);
	assert.match(violations(c => { delete c.main; }), /顶层参数/);
});

test("previews reject unknown dangerous, secret-bearing, or production bindings", () => {
	assert.match(violations(c => { c.previews.routes = ["0701000.xyz/*"]; }), /未审计/);
	assert.match(violations(c => { c.previews.unsafe = {}; }), /未审计/);
	assert.match(violations(c => { c.previews.vars.FIREFLY_ADMIN_PASSWORD = "no"; }), /密码、Token/);
	assert.match(violations(c => { c.previews.vars.FIREFLY_PRIVATE_DRAFT_BACKEND = "kv"; }), /安全的私人草稿/);
	assert.match(violations(c => { c.previews.vars.FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE = "true"; }), /安全的私人草稿/);
	assert.match(violations(c => { c.previews = {}; }), /预览缺少必要设置/);
});

test("KV, D1, R2 account-level identifiers must not overlap production", () => {
	assert.match(violations(c => { c.previews.kv_namespaces[0].id = productionIds[0]; }), /引用了生产存储/);
	assert.match(violations(c => { c.previews.kv_namespaces[1].id = productionIds[1]; }), /引用了生产存储/);
	assert.match(violations(c => { c.previews.d1_databases[0].database_id = productionIds[2]; }), /引用了生产存储/);
	assert.match(violations(c => { c.previews.r2_buckets[0].bucket_name = productionIds[3]; }), /引用了生产存储/);
	assert.match(violations(c => { c.previews.kv_namespaces[1].id = c.previews.kv_namespaces[0].id; }), /重复绑定/);
	assert.match(violations(c => { c.previews.kv_namespaces = []; }), /唯一且有效/);
	assert.match(violations(c => { c.previews.d1_databases[0].database_id = "placeholder"; }), /独立 D1/);
	assert.match(violations(c => { c.previews.r2_buckets[0].bucket_name = "firefly-data"; }), /预览专用/);
});

test("previews must not omit a required binding or add unreviewed bindings", () => {
	assert.match(violations(c => { c.previews.kv_namespaces.push({ binding: "EXTRA", id: "f".repeat(32) }); }), /唯一且有效/);
	assert.match(violations(c => { c.previews.r2_buckets = []; }), /预览专用/);
	assert.match(violations(c => { c.previews.d1_databases[0].database_name = "firefly-prod"; }), /独立 D1/);
});
