/**
 * Read-only admin health summary, adapted from the unmerged system health work
 * in #52. All outputs are allowlisted booleans or fixed descriptions: never
 * return a token, session identifier, database record, secret name/value or ID.
 *
 * Optional feature bindings do not make the currently shipped admin unhealthy.
 */
export type AdminHealthBindings = {
	FIREFLY_ADMIN_PASSWORD?: string;
	FIREFLY_CONTENTS_TOKEN?: string;
	FIREFLY_SESSIONS?: unknown;
	FIREFLY_PRIVATE_DRAFTS?: unknown;
	FIREFLY_PRIVATE_DRAFT_DB?: unknown;
	FIREFLY_PRIVATE_DRAFT_BACKUPS?: unknown;
	IMG_BED_API_TOKEN?: string;
};

export type AdminHealthSummary = {
	status: "ready" | "needs_attention";
	authentication: {
		passwordConfigured: boolean;
		sessionKvBound: boolean;
	};
	github: { tokenConfigured: boolean };
	optional: {
		privateDraftKvBound: boolean;
		privateDraftD1Bound: boolean;
		privateDraftR2Bound: boolean;
		externalImageHostTokenConfigured: boolean;
	};
	issues: string[];
	note: string;
};

export function summarizeAdminHealth(
	env: AdminHealthBindings,
): AdminHealthSummary {
	const passwordConfigured =
		typeof env.FIREFLY_ADMIN_PASSWORD === "string" &&
		env.FIREFLY_ADMIN_PASSWORD.length >= 16;
	const sessionKvBound = Boolean(env.FIREFLY_SESSIONS);
	const tokenConfigured = Boolean(env.FIREFLY_CONTENTS_TOKEN?.trim());
	const issues: string[] = [];
	if (!passwordConfigured) issues.push("未配置符合最低长度要求的后台密码。");
	if (!sessionKvBound) issues.push("后台会话 KV 尚未绑定。");
	if (!tokenConfigured) issues.push("GitHub 内容管理令牌尚未配置。");

	return {
		status: issues.length === 0 ? "ready" : "needs_attention",
		authentication: { passwordConfigured, sessionKvBound },
		github: { tokenConfigured },
		optional: {
			privateDraftKvBound: Boolean(env.FIREFLY_PRIVATE_DRAFTS),
			privateDraftD1Bound: Boolean(env.FIREFLY_PRIVATE_DRAFT_DB),
			privateDraftR2Bound: Boolean(env.FIREFLY_PRIVATE_DRAFT_BACKUPS),
			externalImageHostTokenConfigured: Boolean(env.IMG_BED_API_TOKEN?.trim()),
		},
		issues,
		note: "只读配置检查不代表 GitHub 写入、实际部署、D1/R2 迁移或备份恢复已通过。",
	};
}
