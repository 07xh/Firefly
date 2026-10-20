import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";
import {
	PrivateBackupError,
	type PrivateDraftBackupBucket,
} from "../../../lib/private-draft-r2-backup";
import {
	getPrivateDraftRevision,
	listPrivateDraftRevisions,
	PrivateDraftError,
	type PrivateDraftKV,
	restorePrivateDraftRevision,
} from "../../../lib/private-drafts";

export const prerender = false;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

function storage(): PrivateDraftKV {
	const env = workerEnv as unknown as {
		FIREFLY_PRIVATE_DRAFTS?: PrivateDraftKV;
	};
	if (!env.FIREFLY_PRIVATE_DRAFTS) {
		throw new PrivateDraftError(
			"私人草稿存储未绑定，无法查询或恢复历史版本。",
			503,
		);
	}
	return env.FIREFLY_PRIVATE_DRAFTS;
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

function errorResponse(error: unknown): Response {
	if (error instanceof PrivateBackupError) {
		return json({ error: error.message }, error.status);
	}
	if (error instanceof PrivateDraftError) {
		return json({ error: error.message }, error.status);
	}
	// The error could contain private content or binding details: never log it.
	console.error("[Firefly] private draft history operation failed");
	return json({ error: "私人草稿历史存储暂时不可用，请保留现有备份。" }, 503);
}

export const GET: APIRoute = async ({ url }) => {
	try {
		const store = storage();
		const slug = url.searchParams.get("slug");
		if (!slug) return json({ error: "请输入要查询的私人草稿文件名。" }, 400);
		const version = url.searchParams.get("version");
		if (version !== null) {
			return json(await getPrivateDraftRevision(store, slug, version));
		}
		return json(
			await listPrivateDraftRevisions(
				store,
				slug,
				url.searchParams.get("cursor") || undefined,
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const store = storage();
		const backup = backupStore();
		const raw = await request.text();
		if (new TextEncoder().encode(raw).byteLength > 4096) {
			return json({ error: "恢复请求超过 4 KB 限制。" }, 413);
		}
		let input: unknown;
		try {
			input = JSON.parse(raw);
		} catch {
			return json({ error: "恢复请求格式不合法。" }, 400);
		}
		if (!input || typeof input !== "object" || Array.isArray(input)) {
			return json({ error: "恢复请求必须是对象。" }, 400);
		}
		const details = input as Record<string, unknown>;
		if (
			typeof details.slug !== "string" ||
			typeof details.revision !== "string"
		) {
			return json({ error: "恢复必须指定草稿文件名和历史版本编号。" }, 400);
		}
		return json(
			await restorePrivateDraftRevision(
				store,
				{
					slug: details.slug,
					revision: details.revision,
					expectedVersion: details.expectedVersion,
				},
				backup,
			),
		);
	} catch (error) {
		return errorResponse(error);
	}
};
