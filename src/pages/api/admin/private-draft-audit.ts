import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";
import { auditPrivateDraftBackups } from "../../../lib/private-draft-backup-audit";
import {
	PrivateBackupError,
	type PrivateDraftBackupBucket,
} from "../../../lib/private-draft-r2-backup";
import {
	type PrivateDraftRuntime,
	resolvePrivateDraftStore,
} from "../../../lib/private-draft-storage-binding";
import { PrivateDraftError } from "../../../lib/private-drafts";

export const prerender = false;

function json(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const slug = url.searchParams.get("slug");
		if (!slug) return json({ error: "请输入要核对的私人草稿文件名。" }, 400);
		const env = workerEnv as unknown as PrivateDraftRuntime & {
			FIREFLY_PRIVATE_DRAFT_BACKUPS?: PrivateDraftBackupBucket;
		};
		if (!env.FIREFLY_PRIVATE_DRAFT_BACKUPS) {
			throw new PrivateBackupError(
				"独立 R2 私人备份未绑定，无法核对备份内容。",
				503,
			);
		}
		const store = resolvePrivateDraftStore(env);
		return json(
			await auditPrivateDraftBackups(
				store,
				env.FIREFLY_PRIVATE_DRAFT_BACKUPS,
				slug,
			),
		);
	} catch (error) {
		if (error instanceof PrivateDraftError || error instanceof PrivateBackupError) {
			return json({ error: error.message }, error.status);
		}
		// Do not log raw stored content or the failure object.
		console.error("[Firefly] private draft audit failed");
		return json(
			{ error: "草稿核验未完成，不能据此判定备份安全。请检查存储服务。" },
			503,
		);
	}
};
