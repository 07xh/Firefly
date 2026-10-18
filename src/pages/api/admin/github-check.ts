import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

type RuntimeEnv = {
  FIREFLY_CONTENTS_TOKEN?: string;
  GITHUB_CONTENTS_REPO?: string;
  GITHUB_CONTENTS_BRANCH?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

async function getMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.clone().json()) as { message?: unknown; errors?: unknown };
    const message = typeof payload.message === "string" ? payload.message : "";
    const errors = payload.errors ? JSON.stringify(payload.errors) : "";
    return [message, errors].filter(Boolean).join(" · ").replace(/\s+/g, " ").slice(0, 500);
  } catch {
    return (await response.clone().text()).replace(/\s+/g, " ").slice(0, 300);
  }
}

export const GET: APIRoute = async () => {
  const env = workerEnv as unknown as RuntimeEnv;
  const token = env.FIREFLY_CONTENTS_TOKEN?.trim();
  const repo = env.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
  const branch = env.GITHUB_CONTENTS_BRANCH?.trim() || "master";

  if (!token) {
    return json({
      ok: false,
      stage: "configuration",
      message: "Worker 未配置 FIREFLY_CONTENTS_TOKEN。",
    }, 503);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(branch)) {
    return json({
      ok: false,
      stage: "configuration",
      message: "GITHUB_CONTENTS_REPO 或 GITHUB_CONTENTS_BRANCH 配置格式不合法。",
    }, 503);
  }

  const requestHeaders = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  try {
    const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: requestHeaders,
    });
    if (!repoResponse.ok) {
      return json({
        ok: false,
        stage: "repository_access",
        repo,
        branch,
        githubStatus: repoResponse.status,
        githubMessage: await getMessage(repoResponse),
        requestId: repoResponse.headers.get("x-github-request-id"),
        acceptedPermissions: repoResponse.headers.get("x-accepted-github-permissions"),
      }, 502);
    }

    const refUrl = `https://api.github.com/repos/${repo}/git/ref/heads/${branch.split("/").map(encodeURIComponent).join("/")}`;
    const refResponse = await fetch(refUrl, { headers: requestHeaders });
    if (!refResponse.ok) {
      return json({
        ok: false,
        stage: "branch_access",
        repo,
        branch,
        githubStatus: refResponse.status,
        githubMessage: await getMessage(refResponse),
        requestId: refResponse.headers.get("x-github-request-id"),
        acceptedPermissions: refResponse.headers.get("x-accepted-github-permissions"),
      }, 502);
    }

    // Intentionally omit the required "content" field. GitHub should reject this
    // request as invalid before any file/commit is created. A 403 here points to
    // missing write authorization; a 422 shows that the request passed authorization
    // far enough to be rejected by payload validation.
    const probeResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/.firefly-permission-probe.txt`,
      {
        method: "PUT",
        headers: requestHeaders,
        body: JSON.stringify({
          message: "Firefly write permission probe (intentionally incomplete; no file should be created)",
          branch,
        }),
      },
    );
    const githubMessage = await getMessage(probeResponse);
    const base = {
      repo,
      branch,
      githubStatus: probeResponse.status,
      githubMessage,
      requestId: probeResponse.headers.get("x-github-request-id"),
      acceptedPermissions: probeResponse.headers.get("x-accepted-github-permissions"),
    };

    if (probeResponse.status === 422) {
      return json({
        ok: true,
        stage: "write_authorization",
        result: "authorized_for_write_probe",
        message: "GitHub authenticated the request and rejected the deliberately incomplete payload. No test file was created. If the article publish request still returns 403, compare its exact response and verify the Worker is routed to this deployment.",
        ...base,
      });
    }
    if (probeResponse.status === 403) {
      return json({
        ok: false,
        stage: "write_authorization",
        result: "write_forbidden",
        message: "The live Worker token can read the repository but GitHub denied the write probe. Check that this exact token is active and has Contents: Read and write for the selected repository; no file was created.",
        ...base,
      }, 403);
    }
    if (probeResponse.status === 401) {
      return json({
        ok: false,
        stage: "authentication",
        result: "token_rejected",
        message: "GitHub rejected the token used by the live Worker. Replace the Actions secret with a newly generated active token and redeploy.",
        ...base,
      }, 502);
    }
    return json({
      ok: false,
      stage: "write_authorization",
      result: "unexpected_response",
      message: "GitHub returned an unexpected response to the no-write probe; inspect githubStatus and githubMessage. No valid content was sent.",
      ...base,
    }, 502);
  } catch (error) {
    return json({
      ok: false,
      stage: "network",
      message: error instanceof Error ? error.message : "GitHub diagnostic request failed.",
    }, 502);
  }
};
