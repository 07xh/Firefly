import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";
import {
	deletePrivateDraft,
	getPrivateDraft,
	listPrivateDrafts,
	PrivateDraftError,
	type PrivateDraftKV,
	savePrivateDraft,
} from "../../../lib/private-drafts";

export const prerender = false;

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
	const runtime = workerEnv as unknown as { FIREFLY_PRIVATE_DRAFTS?: PrivateDraftKV };
	const store = runtime.FIREFLY_PRIVATE_DRAFTS;
	if (!store) {
		throw new PrivateDraftError(
			"私人草稿存储尚未配置；未向公开 GitHub 仓库写入任何内容。",
			503,
		);
	}
	return store;
}

function handleError(error: unknown): Response {
	if (error instanceof PrivateDraftError) {
		return response({ error: error.message }, error.status);
	}
	// Never log request bodies, draft content, passwords or Cloudflare bindings.
	console.error("[Firefly] private draft storage operation failed");
	return response({ error: "私人草稿存储暂时不可用，请保留本地原文后重试。" }, 503);
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
		const store = privateStore();
		const input = await readInput(request);
		return response(await savePrivateDraft(store, {
			slug: input.slug,
			content: input.content,
		}), 201);
	} catch (error) {
		return handleError(error);
	}
};

export const PUT: APIRoute = async ({ request }) => {
	try {
		const store = privateStore();
		const input = await readInput(request);
		return response(await savePrivateDraft(store, {
			slug: input.slug,
			content: input.content,
			expectedVersion: input.version,
		}));
	} catch (error) {
		return handleError(error);
	}
};

export const DELETE: APIRoute = async ({ request }) => {
	try {
		const store = privateStore();
		const input = await readInput(request);
		if (typeof input.slug !== "string" || typeof input.version !== "string") {
			return response({ error: "删除草稿需要文件名和当前版本号。" }, 400);
		}
		return response(await deletePrivateDraft(store, input.slug, input.version));
	} catch (error) {
		return handleError(error);
	}
};
