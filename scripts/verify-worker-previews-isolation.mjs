import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	parseWranglerJson,
	parsePrivateProductionManifest,
} from "./verify-private-preview-isolation.mjs";

const REQUIRE_KV = new Set(["FIREFLY_SESSIONS", "FIREFLY_PRIVATE_DRAFTS"]);
const REQUIRE_D1 = "FIREFLY_PRIVATE_DRAFT_DB";
const REQUIRE_R2 = "FIREFLY_PRIVATE_DRAFT_BACKUPS";
const REQUIRED_VARS = {
	FIREFLY_PRIVATE_DRAFT_BACKEND: "d1",
	FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE: "false",
};
const KV_ID = /^[a-fA-F0-9]{32}$/;
const D1_ID = /^[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}$/;
const IS_STAGING = /(?:^|[-_.])(?:preview|staging|pr-[0-9]+)(?:[-_.]|$)/i;

function stable(value) {
	if (Array.isArray(value)) return value.map(stable);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.keys(value)
			.sort()
			.map((key) => [key, stable(value[key])]),
	);
}

const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

function array(value) {
	return Array.isArray(value) ? value : [];
}

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Cloudflare Worker Previews use config.previews, unlike independently deployed
 * staging Workers. The preview is attached to the SAME worker name but MUST
 * have entirely separate account-level KV/D1/R2 bindings.
 *
 * Static preflight only: it cannot prove the private production manifest is
 * exhaustive, the Cloudflare account resources exist, or secrets are separate.
 */
export function verifyWorkerPreviewConfig(production, candidate, protectedResources) {
	const errors = [];
	const check = (condition, message) => {
		if (!condition) errors.push(message);
	};
	if (!isObject(production) || !isObject(candidate)) return ["Wrangler 配置格式错误。"];
	const productionRoot = { ...production };
	const candidateRoot = { ...candidate };
	delete productionRoot.previews;
	delete candidateRoot.previews;
	check(equal(productionRoot, candidateRoot),
		"本地 Worker Preview 配置修改了正式 Worker 的顶层参数，已拒绝。");
	const preview = candidate.previews;
	if (!isObject(preview)) return [...errors, "必须定义独立 Worker Previews 配置块。"];
	const allowedKeys = new Set(["vars", "kv_namespaces", "d1_databases", "r2_buckets"]);
	check(Object.keys(preview).every((key) => allowedKeys.has(key)),
		"预览配置包含尚未审计的绑定、路由或危险参数。");
	for (const required of allowedKeys) {
		check(Object.hasOwn(preview, required), "预览缺少必要设置：" + required);
	}
	check(isObject(preview.vars), "预览 vars 必须为对象。");
	if (isObject(preview.vars)) {
		for (const [name, value] of Object.entries(REQUIRED_VARS)) {
			check(preview.vars[name] === value, "预览没有设置安全的私人草稿运行模式：" + name);
		}
		check(Object.keys(preview.vars).every((key) => Object.hasOwn(REQUIRED_VARS, key)),
			"预览 vars 不允许包含密码、Token 或未审核环境变量。");
	}
	check(Array.isArray(preview.kv_namespaces), "KV 必须是显式预览绑定列表。");
	check(Array.isArray(preview.d1_databases), "D1 必须是显式预览绑定列表。");
	check(Array.isArray(preview.r2_buckets), "R2 必须是显式预览绑定列表。");

	const kv = array(preview.kv_namespaces);
	const d1 = array(preview.d1_databases);
	const r2 = array(preview.r2_buckets);
	check(kv.length === REQUIRE_KV.size && kv.every((item) => REQUIRE_KV.has(item?.binding)) &&
		new Set(kv.map((item) => item?.binding)).size === REQUIRE_KV.size &&
		kv.every((item) => KV_ID.test(item?.id ?? "")),
		"预览必须绑定唯一且有效的会话 KV 和私人草稿 KV。");
	check(d1.length === 1 && d1[0]?.binding === REQUIRE_D1 &&
		D1_ID.test(d1[0]?.database_id ?? "") &&
		IS_STAGING.test(d1[0]?.database_name ?? ""),
		"预览必须绑定独立 D1 ID 和标注为预览的数据库名称。");
	check(r2.length === 1 && r2[0]?.binding === REQUIRE_R2 &&
		IS_STAGING.test(r2[0]?.bucket_name ?? ""),
		"预览必须绑定预览专用 R2 Bucket。");

	// An untracked, user-verified manifest must cover every existing production
	// resource: do not ship these values in the repo or CI output.
	const ids = protectedResources;
	if (!Array.isArray(ids) || ids.length < 4 ||
		ids.some((value) => typeof value !== "string" || !value.trim()) ||
		new Set(ids).size !== ids.length) {
		errors.push("缺少有效的生产资源私有清单；无法核实预览与生产隔离。");
		return errors;
	}
	check(ids.filter((x) => KV_ID.test(x)).length >= 2 &&
		ids.some((x) => D1_ID.test(x)) &&
		ids.some((x) => !KV_ID.test(x) && !D1_ID.test(x)),
		"生产清单必须覆盖会话 KV、草稿 KV、D1 和 R2 的实际资源标识。");
	const bound = [
		...kv.map((item) => item?.id),
		...d1.map((item) => item?.database_id),
		...r2.map((item) => item?.bucket_name),
	];
	check(bound.every((x) => typeof x === "string") &&
		new Set(bound).size === bound.length,
		"预览资源之间发生重复绑定或存在无效标识。");
	check(bound.every((x) => !ids.includes(x)),
		"预览引用了生产存储资源，禁止测试或部署。");
	return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const file = process.env.FIREFLY_PREVIEW_WRANGLER_PATH;
		const manifest = process.env.FIREFLY_PRODUCTION_RESOURCE_MANIFEST;
		if (!file || !manifest) throw new Error("需要本地预览配置与非公开生产资源清单的文件路径。");
		const candidatePath = resolve(file);
		if (candidatePath === resolve("wrangler.jsonc") ||
			candidatePath === resolve("wrangler.toml")) {
			throw new Error("不可将正式配置直接用作隔离预览配置。");
		}
		const production = parseWranglerJson(readFileSync("wrangler.jsonc", "utf8"));
		const candidate = parseWranglerJson(readFileSync(candidatePath, "utf8"));
		const deny = parsePrivateProductionManifest(readFileSync(manifest, "utf8"));
		const failures = verifyWorkerPreviewConfig(production, candidate, deny);
		if (failures.length) throw new Error(failures.join("\n"));
		console.log("PASS: Worker Previews static separation gate. Not a real Cloudflare resource verification.");
	} catch (error) {
		// Never print the local manifest or full configuration.
		console.error("FAIL: " + (error instanceof Error ? error.message : "预览配置校验失败"));
		process.exitCode = 1;
	}
}
