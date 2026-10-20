import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";
import { resolvePrivateDraftStore, type PrivateDraftRuntime } from "../../../lib/private-draft-storage-binding";
import {
	getPrivateR2Backup,
	listPrivateR2Backups,
	PrivateBackupError,
	type PrivateDraftBackupBucket,
} from "../../../lib/private-draft-r2-backup";
import {
	PrivateDraftError,
	type PrivateDraftKV,
	savePrivateDraft,
} from "../../../lib/private-drafts";

export const prerender = false;

function guardMigrationWrites(): void {
	const flags = workerEnv as unknown as { FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE?: string };
	if (flags.FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE === "true") {
		throw new PrivateDraftError("私人草稿正在迁移，请先完成核对再恢复编辑。", 503);
	}
}



function reply(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

function bindings() {
	const env = workerEnv as unknown as PrivateDraftRuntime & {
		FIREFLY_PRIVATE_DRAFTS?: PrivateDraftKV;
		FIREFLY_PRIVATE_DRAFT_BACKUPS?: PrivateDraftBackupBucket;
	};
	if (!env.FIREFLY_PRIVATE_DRAFT_BACKUPS) {
		throw new PrivateBackupError(
			"独立 R2 备份没有配置，无法读取历史备份。",
			503,
		);
	}
	return env;
}

function resultError(error: unknown): Response {
	if (
		error instanceof PrivateBackupError ||
		error instanceof PrivateDraftError
	) {
		return reply({ error: error.message }, error.status);
	}
	console.error("[Firefly] private R2 recovery operation failed");
	return reply({ error: "R2 私人备份操作失败，请保留现有文件并重试。" }, 503);
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const bucket = bindings().FIREFLY_PRIVATE_DRAFT_BACKUPS;
		if (!bucket) throw new PrivateBackupError("R2 存储不可用。", 503);
		const slug = url.searchParams.get("slug");
		if (!slug) return reply({ error: "需要私人草稿文件名。" }, 400);
		const version = url.searchParams.get("version");
		return reply(
			version !== null
				? await getPrivateR2Backup(bucket, slug, version)
				: await listPrivateR2Backups(
						bucket,
						slug,
						url.searchParams.get("cursor") || undefined,
					),
		);
	} catch (error) {
		return resultError(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		guardMigrationWrites();
		const bound = bindings();
		const bucket = bound.FIREFLY_PRIVATE_DRAFT_BACKUPS;
		const store = resolvePrivateDraftStore(bound);
		if (!bucket || !store) {
			throw new PrivateBackupError(
				"KV 主存储与 R2 备份均需绑定才能安全恢复。",
				503,
			);
		}
		const input = await request.text();
		if (new TextEncoder().encode(input).byteLength > 4096) {
			return reply({ error: "恢复请求超过 4 KB。" }, 413);
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(input);
		} catch {
			return reply({ error: "恢复请求不是有效 JSON。" }, 400);
		}
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return reply({ error: "恢复请求必须是 JSON 对象。" }, 400);
		}
		const payload = parsed as Record<string, unknown>;
		if (
			typeof payload.slug !== "string" ||
			typeof payload.version !== "string"
		) {
			return reply({ error: "恢复操作必须指定草稿文件名和备份版本号。" }, 400);
		}
		const record = await getPrivateR2Backup(
			bucket,
			payload.slug,
			payload.version,
		);
		return reply(
			await savePrivateDraft(
				store,
				{
					slug: payload.slug,
					content: record.content,
					extension: record.extension,
					expectedVersion: payload.expectedVersion,
				},
				bucket,
			),
		);
	} catch (error) {
		return resultError(error);
	}
};
