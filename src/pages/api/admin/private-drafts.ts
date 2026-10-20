import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";
import {
	resolvePrivateDraftStore,
	type PrivateDraftRuntime,
} from "../../../lib/private-draft-storage-binding";
import {
	PrivateBackupError,
	type PrivateDraftBackupBucket,
} from "../../../lib/private-draft-r2-backup";
import {
	deletePrivateDraft,
	getPrivateDraft,
	listPrivateDrafts,
	PrivateDraftError,
	type PrivateDraftKV,
	savePrivateDraft,
} from "../../../lib/private-drafts";

export const prerender = false;

function guardMigrationWrites(): void {
	const flags = workerEnv as unknown as {
		FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE?: string;
	};
	if (flags.FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE === "true") {
		throw new PrivateDraftError(
			"私人草稿正在迁移，请先完成核对再恢复编辑。",
			503,
		);
	}
}

function response(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

function privateStore(): PrivateDraftKV {
	return resolvePrivateDraftStore(workerEnv as unknown as PrivateDraftRuntime);
}

function backupStore(): PrivateDraftBackupBucket {
	const runtime = workerEnv as unknown as {
		FIREFLY_PRIVATE_DRAFT_BACKUPS?: PrivateDraftBackupBucket;
	};
	if (!runtime.FIREFLY_PRIVATE_DRAFT_BACKUPS) {
		throw new PrivateDraftError(
			"独立 R2 备份存储未配置；已停止修改私人草稿。",
			503,
		);
	}
	return runtime.FIREFLY_PRIVATE_DRAFT_BACKUPS;
}

function handleError(error: unknown): Response {
	if (error instanceof PrivateBackupError) {
		return response({ error: error.message }, error.status);
	}
	if (error instanceof PrivateDraftError) {
		return response({ error: error.message }, error.status);
	}
	// Never log request bodies, draft content, passwords or Cloudflare bindings.
	console.error("[Firefly] private draft storage operation failed");
	return response(
		{ error: "私人草稿存储暂时不可用，请保留本地原文后重试。" },
		503,
	);
}

async function readInput(request: Request): Promise<Record<string, unknown>> {
	let parsed: unknown;
	try {
		const bytes = await request.arrayBuffer();
		if (bytes.byteLength > 600_000) {
			throw new PrivateDraftError("私人草稿请求超过 600 KB。", 413);
		}
		parsed = JSON.parse(new TextDecoder().decode(bytes));
	} catch (error) {
		if (error instanceof PrivateDraftError) throw error;
		throw new PrivateDraftError("草稿请求不是有效 JSON。", 400);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new PrivateDraftError("草稿请求内容格式不正确。", 400);
	}
	return parsed as Record<string, unknown>;
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const store = privateStore();
		const slug = url.searchParams.get("slug");
		if (slug !== null) return response(await getPrivateDraft(store, slug));
		const cursor = url.searchParams.get("cursor") || undefined;
		return response(await listPrivateDrafts(store, cursor));
	} catch (error) {
		return handleError(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		guardMigrationWrites();
		const store = privateStore();
		const backup = backupStore();
		const input = await readInput(request);
		return response(
			await savePrivateDraft(
				store,
				{
					slug: input.slug,
					content: input.content,
					extension: input.extension,
				},
				backup,
			),
			201,
		);
	} catch (error) {
		return handleError(error);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	try {
		guardMigrationWrites();
		const store = privateStore();
		const backup = backupStore();
		const input = await readInput(request);
		return response(
			await savePrivateDraft(
				store,
				{
					slug: input.slug,
					content: input.content,
					extension: input.extension,
					expectedVersion: input.version,
				},
				backup,
			),
		);
	} catch (error) {
		return handleError(error);
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	try {
		guardMigrationWrites();
		const store = privateStore();
		const backup = backupStore();
		const input = await readInput(request);
		if (typeof input.slug !== "string" || typeof input.version !== "string") {
			return response({ error: "删除草稿需要文件名和当前版本号。" }, 400);
		}
		return response(
			await deletePrivateDraft(store, input.slug, input.version, backup),
		);
	} catch (error) {
		return handleError(error);
	}
};
