import { env as workerEnv } from "cloudflare:workers";

import type { APIRoute } from "astro";
import {
	publicAdminSystemHealth,
	type FireflyBindingFlags,
} from "../../../lib/admin-system-health";

export const prerender = false;

type ProbeRuntime = FireflyBindingFlags & {
	FIREFLY_PRIVATE_DRAFTS?: {
		list(options: { prefix: string; limit: number }): Promise<unknown>;
	};
	FIREFLY_PRIVATE_DRAFT_BACKUPS?: {
		list(options: { prefix: string; limit: number }): Promise<unknown>;
	};
	FIREFLY_PRIVATE_DRAFT_DB?: {
		prepare(sql: string): {
			first(): Promise<unknown>;
		};
	};
	GITHUB_CONTENTS_REPO?: string;
};

function json(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

async function probe(run: () => Promise<unknown>): Promise<"ok" | "failed"> {
	try {
		await run();
		return "ok";
	} catch {
		// Never return internal endpoint paths, database errors or secrets.
		return "failed";
	}
}

export const GET: APIRoute = async ({ url }) => {
	const env = workerEnv as unknown as ProbeRuntime;
	const summary = publicAdminSystemHealth(env);
	if (url.searchParams.get("probe") !== "1") {
		return json({ ...summary, connectivity: null });
	}
	const kv = env.FIREFLY_PRIVATE_DRAFTS;
	const r2 = env.FIREFLY_PRIVATE_DRAFT_BACKUPS;
	const d1 = env.FIREFLY_PRIVATE_DRAFT_DB;
	const token = env.FIREFLY_CONTENTS_TOKEN?.trim();
	const repo = env.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
	const checks = await Promise.all([
		kv
			? probe(() => kv.list({ prefix: "draft:v1:", limit: 1 }))
			: Promise.resolve("not_configured" as const),
		r2
			? probe(() => r2.list({ prefix: "private-draft-backups/v1/", limit: 1 }))
			: Promise.resolve("not_configured" as const),
		d1
			? probe(() => d1.prepare("SELECT COUNT(*) AS total FROM private_drafts").first())
			: Promise.resolve("not_configured" as const),
		token && /^[\w.-]+\/[\w.-]+$/.test(repo)
			? probe(async () => {
					const response = await fetch(
						"https://api.github.com/repos/" + repo,
						{
							headers: {
								Authorization: "Bearer " + token,
								Accept: "application/vnd.github+json",
								"User-Agent": "Firefly-Admin/1.0",
							},
							signal: AbortSignal.timeout(5000),
						},
					);
					if (!response.ok) throw new Error("GitHub unreachable");
				})
			: Promise.resolve("not_configured" as const),
	]);
	return json({
		...summary,
		connectivity: {
			kv: checks[0],
			r2: checks[1],
			d1: checks[2],
			github: checks[3],
		},
	});
};
