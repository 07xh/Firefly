/**
 * Read-only Firefly admin diagnostics. No secrets, token values, IDs,
 * request bodies or private article content appear in this return value.
 */
export type FireflyBindingFlags = {
	FIREFLY_ADMIN_PASSWORD?: string;
	FIREFLY_CONTENTS_TOKEN?: string;
	FIREFLY_SESSIONS?: unknown;
	SESSION?: unknown;
	FIREFLY_PRIVATE_DRAFTS?: unknown;
	FIREFLY_PRIVATE_DRAFT_BACKUPS?: unknown;
	FIREFLY_PRIVATE_DRAFT_DB?: unknown;
	FIREFLY_PRIVATE_DRAFT_BACKEND?: string;
	FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE?: string;
	IMG_BED_API_TOKEN?: string;
};

export function publicAdminSystemHealth(flags: FireflyBindingFlags) {
	const rawBackend = flags.FIREFLY_PRIVATE_DRAFT_BACKEND?.trim() || "kv";
	const backend =
		rawBackend === "kv" || rawBackend === "d1" ? rawBackend : "unknown";
	const migrating = flags.FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE === "true";
	const legacyKV = Boolean(flags.FIREFLY_PRIVATE_DRAFTS);
	const d1 = Boolean(flags.FIREFLY_PRIVATE_DRAFT_DB);
	const r2 = Boolean(flags.FIREFLY_PRIVATE_DRAFT_BACKUPS);
	const session = Boolean(flags.FIREFLY_SESSIONS);
	const password = Boolean(flags.FIREFLY_ADMIN_PASSWORD?.trim());
	const gitToken = Boolean(flags.FIREFLY_CONTENTS_TOKEN?.trim());
	const mediaToken = Boolean(flags.IMG_BED_API_TOKEN?.trim());
	const issues: string[] = [];

	if (!session || !password)
		issues.push("管理员登录所需的会话 KV 或密码尚未完整配置。");
	if (!gitToken) issues.push("GitHub 文章管理访问令牌尚未配置。");
	if (backend === "unknown")
		issues.push("私人草稿后端模式不是支持的 KV 或 D1。");
	if (backend === "d1" && !d1)
		issues.push("当前选择 D1，但未绑定私人草稿数据库。");
	if (backend === "kv" && !legacyKV)
		issues.push("当前选择 KV，但未绑定私人草稿命名空间。");
	if (!r2) issues.push("未绑定独立 R2 私人草稿备份；私人草稿写入应该被阻止。");
	if (migrating)
		issues.push("私人草稿正在迁移维护期，编辑、删除和历史恢复应暂停。");
	if (!mediaToken) issues.push("图床令牌尚未配置，图片库可能不可用。");

	return {
		status: migrating
			? "maintenance"
			: issues.length
				? "needs_attention"
				: "configured",
		security: {
			sessionBinding: session,
			adminPasswordConfigured: password,
		},
		articles: { githubTokenConfigured: gitToken },
		privateDrafts: {
			backend,
			migrationMode: migrating,
			kvBound: legacyKV,
			d1Bound: d1,
			r2BackupBound: r2,
		},
		media: { imageHostTokenConfigured: mediaToken },
		issues,
		note: "仅表示配置或绑定是否存在；实际读写和真实恢复仍需联调。",
	};
}
