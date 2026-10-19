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
      message: "后台尚未完成文章保存配置，请检查部署设置。",
    }, 503);
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(branch)) {
    return json({
      ok: false,
      stage: "configuration",
      message: "文章保存位置设置不正确，请检查部署设置。",
    }, 503);
  }

  const requestHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Firefly-Admin/1.0 (https://github.com/07xh/Firefly)",
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
        message: "已确认后台能够访问文章保存位置，并可以进行保存检查。本次检查没有创建或修改任何文件。",
        ...base,
      });
    }
    if (probeResponse.status === 403) {
      return json({
        ok: false,
        stage: "write_authorization",
        result: "write_forbidden",
        message: "后台可以读取文章，但没有保存权限。请确认保存凭据仍然有效，并允许修改文章；本次检查没有创建文件。",
        ...base,
      }, 403);
    }
    if (probeResponse.status === 401) {
      return json({
        ok: false,
        stage: "authentication",
        result: "token_rejected",
        message: "后台使用的保存凭据无效或已过期。请更新保存凭据并重新部署后台。",
        ...base,
      }, 502);
    }
    return json({
      ok: false,
      stage: "write_authorization",
      result: "unexpected_response",
      message: "收到无法识别的检查结果。请展开“查看详细检查信息”查看原因；本次检查没有写入文件。",
      ...base,
    }, 502);
  } catch (error) {
    return json({
      ok: false,
      stage: "network",
      message: error instanceof Error ? error.message : "暂时无法连接文章保存服务，请检查网络后重试。",
    }, 502);
  }
};
