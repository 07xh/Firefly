import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";
import {
	PrivateBackupError,
	ensurePrivateR2Backup,
	type PrivateDraftBackupBucket,
} from "../../../lib/private-draft-r2-backup";
import {
	createD1PrivateDraftStore,
	type PrivateDraftD1Database,
} from "../../../lib/private-draft-d1";
import {
	PrivateDraftError,
	getPrivateDraft,
	type PrivateDraftKV,
	savePrivateDraft,
} from "../../../lib/private-drafts";

export const prerender = false;

type MigrationRuntime = {
	FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE?: string;
	FIREFLY_PRIVATE_DRAFT_BACKEND?: string;
	FIREFLY_PRIVATE_DRAFTS?: PrivateDraftKV;
	FIREFLY_PRIVATE_DRAFT_DB?: PrivateDraftD1Database;
	FIREFLY_PRIVATE_DRAFT_BACKUPS?: PrivateDraftBackupBucket;
};

function response(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

function runtime() {
	const bound = workerEnv as unknown as MigrationRuntime;
	if (
		bound.FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE !== "true" ||
		(bound.FIREFLY_PRIVATE_DRAFT_BACKEND?.trim() || "kv") !== "kv"
	) {
		throw new PrivateDraftError(
			"仅在 KV 迁移维护模式下允许复制私人草稿。",
			403,
		);
	}
	if (
		!bound.FIREFLY_PRIVATE_DRAFTS ||
		!bound.FIREFLY_PRIVATE_DRAFT_DB ||
		!bound.FIREFLY_PRIVATE_DRAFT_BACKUPS
	) {
		throw new PrivateDraftError("KV、D1、R2 三种私有绑定必须全部配置。", 503);
	}
	return {
		legacy: bound.FIREFLY_PRIVATE_DRAFTS,
		d1: createD1PrivateDraftStore(bound.FIREFLY_PRIVATE_DRAFT_DB),
		r2: bound.FIREFLY_PRIVATE_DRAFT_BACKUPS,
	};
}

function handle(error: unknown): Response {
	if (
		error instanceof PrivateDraftError ||
		error instanceof PrivateBackupError
	) {
		return response({ error: error.message }, error.status);
	}
	console.error("[Firefly] private draft migration failed");
	return response(
		{ error: "迁移失败，旧 KV 原稿没有被删除。请检查私有存储配置。" },
		503,
	);
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const { legacy, d1 } = runtime();
		const slug = url.searchParams.get("slug");
		if (!slug) return response({ error: "需要单篇草稿文件名。" }, 400);
		const existing = await getPrivateDraft(legacy, slug);
		const migrated = await d1.get("draft:v1:" + slug, "text");
		return response({
			slug,
			sourceVersion: existing.version,
			alreadyCopied: migrated !== null,
			contentMatched: migrated
				? JSON.parse(migrated).content === existing.content
				: false,
		});
	} catch (error) {
		return handle(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const { legacy, d1, r2 } = runtime();
		const raw = await request.text();
		if (new TextEncoder().encode(raw).byteLength > 4096) {
			return response({ error: "迁移请求超过 4 KB。" }, 413);
		}
		let input: unknown;
		try {
			input = JSON.parse(raw);
		} catch {
			return response({ error: "迁移请求不是有效 JSON。" }, 400);
		}
		if (!input || typeof input !== "object" || Array.isArray(input)) {
			return response({ error: "迁移请求必须是 JSON 对象。" }, 400);
		}
		const details = input as Record<string, unknown>;
		if (
			typeof details.slug !== "string" ||
			typeof details.version !== "string"
		) {
			return response({ error: "必须提供草稿文件名和当前 KV 版本号。" }, 400);
		}
		const source = await getPrivateDraft(legacy, details.slug);
		if (source.version !== details.version) {
			return response(
				{ error: "KV 草稿版本已变化，拒绝使用过期快照迁移。" },
				409,
			);
		}
		if (await d1.get("draft:v1:" + details.slug, "text")) {
			return response(
				{ error: "D1 已有同名草稿，迁移不能覆盖。请先比对数据。" },
				409,
			);
		}
		// Preserve the original version in independently stored R2 first.
		await ensurePrivateR2Backup(r2, source);
		const copied = await savePrivateDraft(
			d1,
			{
				slug: details.slug,
				content: source.content,
				extension: source.extension,
			},
			r2,
		);
		const after = await d1.get("draft:v1:" + details.slug, "text");
		if (!after || JSON.parse(after).content !== source.content) {
			throw new PrivateDraftError(
				"D1 迁移后校验失败。旧 KV 原稿仍然保留。",
				503,
			);
		}
		return response({
			ok: true,
			slug: details.slug,
			sourceVersion: source.version,
			newVersion: copied.version,
			kvSourcePreserved: true,
		});
	} catch (error) {
		return handle(error);
	}
};
