import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_KV = ["FIREFLY_SESSIONS", "FIREFLY_PRIVATE_DRAFTS"];
const REQUIRED_D1 = "FIREFLY_PRIVATE_DRAFT_DB";
const REQUIRED_R2 = "FIREFLY_PRIVATE_DRAFT_BACKUPS";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KV_ID = /^[0-9a-f]{32}$/i;
const STAGING_NAME = /(?:^|[-.])(?:preview|staging|pr-[0-9]+)(?:[-.]|$)/i;

function array(value) {
	return Array.isArray(value) ? value : [];
}

function names(items, key) {
	return array(items).map((item) => item?.[key]).filter((value) => typeof value === "string");
}

function bindings(config) {
	return [
		...array(config.kv_namespaces).map((item) => ({ kind: "kv", name: item?.binding, id: item?.id })),
		...array(config.d1_databases).map((item) => ({ kind: "d1", name: item?.binding, id: item?.database_id })),
		...array(config.r2_buckets).map((item) => ({ kind: "r2", name: item?.binding, id: item?.bucket_name })),
	];
}

/**
 * Pre-deploy safety gate, not a Cloudflare API verification.
 * Production resource identifiers must be supplied via a private local JSON
 * manifest, never added to git or printed to CI logs.
 */
export function validatePrivatePreviewConfig(production, preview, privateProductionResourceIds) {
	const errors = [];
	const add = (test, message) => { if (!test) errors.push(message); };
	if (!production || typeof production !== "object" || !preview || typeof preview !== "object") {
		return ["Wrangler 生产或预览配置无效。"];
	}
	const deny = new Set(array(privateProductionResourceIds).filter((x) => typeof x === "string"));
	add(deny.size >= 4, "必须提供包含生产 KV、D1、R2 标识的独立私有清单，才能证明预览资源隔离。");
	add(typeof preview.name === "string" && STAGING_NAME.test(preview.name), "预览 Worker 名称必须明确包含 preview、staging 或 pr-编号。");
	add(preview.name !== production.name, "预览 Worker 不能和正式 Worker 同名。");
	add(preview.workers_dev === true, "仅允许独立 workers.dev 预览地址。");
	add(!("route" in preview) && !("routes" in preview) && !("zone_id" in preview), "预览配置不得绑定正式站点自定义路由或区域。");
	add(!("env" in preview) && !("unsafe" in preview), "预览配置不应继承未知生产环境或 unsafe 参数。");
	add(preview.main === production.main, "预览必须使用仓库同一 Workers 入口。");
	add(preview.assets?.directory === production.assets?.directory, "预览应使用相同的静态构建目录。");
	const expectedRoutes = array(production.assets?.run_worker_first);
	const actualRoutes = array(preview.assets?.run_worker_first);
	add(expectedRoutes.every((path) => actualRoutes.includes(path)), "预览必须保留后台 API 与登录路径的 Worker 路由。");

	const found = bindings(preview);
	for (const name of REQUIRED_KV) {
		const kv = found.filter((item) => item.kind === "kv" && item.name === name);
		add(kv.length === 1 && KV_ID.test(kv[0]?.id || ""), name + " 必须绑定唯一的独立 KV Namespace ID。");
	}
	const d1 = found.filter((item) => item.kind === "d1" && item.name === REQUIRED_D1);
	add(d1.length === 1 && UUID.test(d1[0]?.id || ""), REQUIRED_D1 + " 必须绑定有效的独立 D1 database_id。");
	const r2 = found.filter((item) => item.kind === "r2" && item.name === REQUIRED_R2);
	add(r2.length === 1 && typeof r2[0]?.id === "string" && STAGING_NAME.test(r2[0].id), REQUIRED_R2 + " 必须使用有 preview/staging 标识的独立 R2 Bucket。");
	const boundIds = found.map((item) => item.id).filter((value) => typeof value === "string");
	add(new Set(boundIds).size === boundIds.length, "预览 KV、D1、R2 不得互相复用同一个标识。");
	add(boundIds.every((id) => !deny.has(id)), "预览配置引用了生产存储标识，禁止部署。");

	// Require an explicit, non-migration staging runtime. The production site
	// must remain on its current KV configuration until manually approved.
	const vars = preview.vars;
	add(vars && typeof vars === "object" && !Array.isArray(vars), "预览必须显式指定安全运行模式。");
	if (vars && typeof vars === "object" && !Array.isArray(vars)) {
		add(vars.FIREFLY_PRIVATE_DRAFT_BACKEND === "d1", "预览应使用隔离 D1（不能误回退生产 KV）。");
		add(vars.FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE === "false", "预览默认必须禁用迁移写入模式。");
		const allowed = new Set(["FIREFLY_PRIVATE_DRAFT_BACKEND", "FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE", "NODE_VERSION"]);
		add(Object.keys(vars).every((key) => allowed.has(key)), "Wrangler vars 只能含允许的非敏感运行开关；密码与 Token 使用独立 Secret。");
	}
	add(!("account_id" in preview) || typeof preview.account_id === "string", "账户配置格式不正确。");
	return errors;
}

export function parseWranglerJson(text) {
	// No transformation of URLs or user-supplied secret values. Wrangler JSONC
	// supports comments; only remove comments OUTSIDE JSON strings.
	let output = "";
	let quote = false;
	let escaped = false;
	let lineComment = false;
	let blockComment = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const next = text[i + 1];
		if (lineComment) {
			if (ch === "\n") { output += ch; lineComment = false; }
			continue;
		}
		if (blockComment) {
			if (ch === "*" && next === "/") { blockComment = false; i++; }
			continue;
		}
		if (quote) {
			output += ch;
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') quote = false;
			continue;
		}
		if (ch === '"') { output += ch; quote = true; continue; }
		if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
		if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
		output += ch;
	}
	return JSON.parse(output.replace(/,\s*([}\]])/g, "$1"));
}

export function parsePrivateProductionManifest(text) {
	const parsed = JSON.parse(text);
	if (!Array.isArray(parsed)) throw new Error("私有生产资源清单必须是 JSON 字符串数组。");
	if (parsed.some((x) => typeof x !== "string")) throw new Error("生产资源标识格式错误。");
	return parsed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	// Keep all identifiers out of stdout and PR logs. Never take CLI flags
	// containing secrets or credentials (which would leak into process lists).
	try {
		const previewFile = process.env.FIREFLY_PREVIEW_WRANGLER_PATH;
		const prodFile = process.env.FIREFLY_PRODUCTION_RESOURCE_MANIFEST;
		if (!previewFile || !prodFile) throw new Error("需要本机预览 Wrangler 文件及非公开生产资源清单路径。");
		if (resolve(previewFile) === resolve("wrangler.jsonc")) throw new Error("禁止直接用正式 Wrangler 配置部署预览。");
		const production = parseWranglerJson(readFileSync("wrangler.jsonc", "utf8"));
		const preview = parseWranglerJson(readFileSync(previewFile, "utf8"));
		const deny = parsePrivateProductionManifest(readFileSync(prodFile, "utf8"));
		const errors = validatePrivatePreviewConfig(production, preview, deny);
		if (errors.length) throw new Error(errors.join("\n"));
		console.log("PASS: preview pre-deploy isolation checks completed; Cloudflare account bindings still require real verification.");
	} catch (error) {
		console.error("FAIL: preview isolation preflight failed: " + (error instanceof Error ? error.message : String(error)));
		process.exitCode = 1;
	}
}
