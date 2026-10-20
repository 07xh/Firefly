import {
	createD1PrivateDraftStore,
	type PrivateDraftD1Database,
} from "./private-draft-d1";
import { PrivateDraftError, type PrivateDraftKV } from "./private-drafts";

export type PrivateDraftRuntime = {
	FIREFLY_PRIVATE_DRAFT_BACKEND?: string;
	FIREFLY_PRIVATE_DRAFTS?: PrivateDraftKV;
	FIREFLY_PRIVATE_DRAFT_DB?: PrivateDraftD1Database;
};

/**
 * Explicitly select the D1 backend ONLY after a verified manual migration.
 * Default remains KV; merely binding D1 does not change where drafts live.
 */
export function resolvePrivateDraftStore(runtime: PrivateDraftRuntime): PrivateDraftKV {
	const backend = runtime.FIREFLY_PRIVATE_DRAFT_BACKEND?.trim() || "kv";
	if (backend === "d1") {
		if (!runtime.FIREFLY_PRIVATE_DRAFT_DB) {
			throw new PrivateDraftError("D1 草稿库尚未绑定，已阻止存储访问。", 503);
		}
		return createD1PrivateDraftStore(runtime.FIREFLY_PRIVATE_DRAFT_DB);
	}
	if (backend !== "kv") {
		throw new PrivateDraftError("私人草稿存储模式无效，请检查 Worker 配置。", 503);
	}
	if (!runtime.FIREFLY_PRIVATE_DRAFTS) {
		throw new PrivateDraftError(
			"私人草稿 KV 尚未配置，已阻止操作而不是退回公开 GitHub。",
			503,
		);
	}
	return runtime.FIREFLY_PRIVATE_DRAFTS;
}
