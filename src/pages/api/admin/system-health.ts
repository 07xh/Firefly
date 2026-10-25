import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";
import {
	type AdminHealthBindings,
	summarizeAdminHealth,
} from "../../../lib/admin-system-health";

export const prerender = false;

type HealthRuntime = AdminHealthBindings & {
	GITHUB_CONTENTS_REPO?: string;
	GITHUB_CONTENTS_BRANCH?: string;
};

type ProbeStatus = "ok" | "failed" | "not_configured" | "not_requested";

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

async function checkGitHubContents(env: HealthRuntime): Promise<ProbeStatus> {
	const token = env.FIREFLY_CONTENTS_TOKEN?.trim();
	if (!token) return "not_configured";
	const repo = env.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
	const branch = env.GITHUB_CONTENTS_BRANCH?.trim() || "master";
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || !/^[A-Za-z0-9_.\/-]+$/.test(branch) || branch.includes("..")) {
		return "failed";
	}
	try {
		const url = "https://api.github.com/repos/" + repo
			+ "/contents/src/data/settings.json?ref=" + encodeURIComponent(branch);
		const response = await fetch(url, {
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: "Bearer " + token,
				"User-Agent": "Firefly-Admin/1.0",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			signal: AbortSignal.timeout(5000),
		});
		// A 404 may indicate a missing settings file rather than a token issue,
		// but it is not proof of a healthy content-management connection.
		return response.ok ? "ok" : "failed";
	} catch {
		return "failed";
	}
}

export const GET: APIRoute = async ({ url }) => {
	const env = workerEnv as unknown as HealthRuntime;
	const summary = summarizeAdminHealth(env);
	const probe = url.searchParams.get("probe") === "1";
	const github: ProbeStatus = probe ? await checkGitHubContents(env) : "not_requested";
	return json({
		...summary,
		connectivity: { github },
		readOnly: true,
	});
};
