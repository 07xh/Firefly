import type { APIRoute } from "astro";

export const prerender = false;

type WorkflowRun = {
	head_sha?: string;
	status?: string;
	conclusion?: string | null;
	html_url?: string;
};
type WorkflowRunsResponse = { workflow_runs?: WorkflowRun[] };

export const GET: APIRoute = async ({ url }) => {
	const sha = url.searchParams.get("sha")?.trim() ?? "";
	if (!/^[a-f0-9]{40}$/i.test(sha)) {
		return new Response(JSON.stringify({ error: "提交 SHA 格式不正确" }), {
			status: 400,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store",
			},
		});
	}

	try {
		const response = await fetch(
			`https://api.github.com/repos/07xh/Firefly/actions/workflows/deploy-cloudflare.yml/runs?head_sha=${encodeURIComponent(sha)}&per_page=10`,
			{
				headers: {
					Accept: "application/vnd.github+json",
					"User-Agent": "Firefly-Admin/1.0 (https://github.com/07xh/Firefly)",
					"X-GitHub-Api-Version": "2022-11-28",
				},
			},
		);
		if (!response.ok) {
			return new Response(
				JSON.stringify({
					error: `GitHub 工作流查询失败 (${response.status})`,
				}),
				{
					status: 502,
					headers: {
						"content-type": "application/json; charset=utf-8",
						"cache-control": "no-store",
					},
				},
			);
		}

		const data = (await response.json()) as WorkflowRunsResponse;
		const run = (data.workflow_runs ?? []).find(
			(item) => item.head_sha?.toLowerCase() === sha.toLowerCase(),
		);
		if (!run) {
			return new Response(JSON.stringify({ status: "waiting", url: null }), {
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				},
			});
		}

		let status = "running";
		if (run.status === "completed") {
			status = run.conclusion === "success" ? "success" : "failure";
		} else if (
			run.status === "queued" ||
			run.status === "requested" ||
			run.status === "waiting"
		) {
			status = "waiting";
		}
		return new Response(
			JSON.stringify({
				status,
				url: run.html_url ?? null,
				conclusion: run.conclusion ?? null,
			}),
			{
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				},
			},
		);
	} catch {
		return new Response(
			JSON.stringify({ error: "无法连接 GitHub 查询部署状态" }),
			{
				status: 502,
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store",
				},
			},
		);
	}
};
