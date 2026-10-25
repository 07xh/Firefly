import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

const ROOT = "src/content/dynamic/";
const FILE_PATTERN = /^src\/content\/dynamic\/[A-Za-z0-9_-]+\.md$/;

type Config = { token: string; repo: string; branch: string };
type GithubFile = { name: string; path: string; sha: string; type: string };
type FullFile = { path: string; sha: string; content: string; encoding: string };

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function config(): Config {
  const env = workerEnv as unknown as {
    FIREFLY_CONTENTS_TOKEN?: string;
    GITHUB_CONTENTS_REPO?: string;
    GITHUB_CONTENTS_BRANCH?: string;
  };
  const token = env.FIREFLY_CONTENTS_TOKEN?.trim();
  const repo = env.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
  const branch = env.GITHUB_CONTENTS_BRANCH?.trim() || "master";
  if (!token) throw new Error("FIREFLY_CONTENTS_TOKEN 未配置");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("GitHub 仓库配置有误");
  return { token, repo, branch };
}

function encodeUtf8(source: string): string {
  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function decodeUtf8(source: string): string {
  const bytes = Uint8Array.from(atob(source.replace(/\s/g, "")), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function validDateTime(input: unknown): input is string {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(input)) return false;
  const pieces = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!pieces) return false;
  const [, year, month, day, hour, minute, second] = pieces;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second || 0)));
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day) &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === Number(second || 0);
}

function validatedInput(value: unknown): { published: string; pinned: boolean; location: string; body: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!validDateTime(input.published) ||
    typeof input.body !== "string" || !input.body.trim() ||
    new TextEncoder().encode(input.body).length > 200_000 ||
    typeof input.location !== "string" || input.location.length > 100 ||
    typeof input.pinned !== "boolean") return null;
  if (input.body.includes("\u0000") || input.location.includes("\n") || input.location.includes("\r")) return null;
  return {
    published: input.published.slice(0, 19).replace("T", " ") + (input.published.length === 16 ? ":00" : ""),
    pinned: input.pinned,
    location: input.location.trim(),
    body: input.body.trimEnd() + "\n",
  };
}

function markdown(input: NonNullable<ReturnType<typeof validatedInput>>, previous?: string): string {
  const existing = previous?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (previous && !existing) throw new Error("原动态缺少合法的 Frontmatter，已取消修改");
  const preserved = existing
    ? existing[1].split(/\r?\n/).filter((line) => !/^(published|pinned|location):/.test(line) && line.trim())
    : [];
  const front = [
    ...preserved,
    "published: " + input.published,
    "pinned: " + String(input.pinned),
    ...(input.location ? ["location: " + JSON.stringify(input.location)] : []),
  ];
  return "---\n" + front.join("\n") + "\n---\n\n" + input.body;
}

function extract(file: { path: string; sha: string; content: string }) {
  const match = file.content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error("动态 Frontmatter 不完整：" + file.path);
  const meta = match[1];
  const published = meta.match(/^published:\s*(.*?)\s*$/m)?.[1].replace(/^["']|["']$/g, "").trim() || "";
  const pinned = /^pinned:\s*true\s*$/m.test(meta);
  const rawLocation = meta.match(/^location:\s*(.*?)\s*$/m)?.[1] || "";
  let location = rawLocation;
  if (rawLocation.startsWith('"')) {
    try { location = JSON.parse(rawLocation) as string; } catch { location = rawLocation.slice(1, -1); }
  }
  const body = file.content.slice(match[0].length).replace(/^\r?\n/, "");
  return { path: file.path, sha: file.sha, published: published.replace(" ", "T").slice(0, 19), pinned, location, body };
}

async function github(c: Config, path: string, init?: RequestInit): Promise<Response> {
  return fetch("https://api.github.com/repos/" + c.repo + "/" + path, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + c.token,
      "User-Agent": "Firefly-Admin/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
  });
}

function encodedPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function read(c: Config, path: string): Promise<FullFile | null> {
  const response = await github(c, "contents/" + encodedPath(path) + "?ref=" + encodeURIComponent(c.branch));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("读取动态失败 (GitHub HTTP " + response.status + ")");
  const payload = await response.json() as FullFile;
  if (payload.encoding !== "base64" || typeof payload.content !== "string" || typeof payload.sha !== "string") {
    throw new Error("GitHub 文件响应格式不正确");
  }
  return { ...payload, content: decodeUtf8(payload.content) };
}

async function write(c: Config, path: string, body: string, sha?: string) {
  const response = await github(c, "contents/" + encodedPath(path), {
    method: "PUT",
    body: JSON.stringify({
      message: (sha ? "Update dynamic: " : "Create dynamic: ") + path.slice(ROOT.length),
      content: encodeUtf8(body),
      branch: c.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (response.status === 409 || response.status === 422) return json({ error: "动态已被其他操作修改，或文件名已存在；请刷新列表后重新操作。" }, 409);
  if (!response.ok) return json({ error: "保存动态失败（GitHub HTTP " + response.status + "）" }, 502);
  const output = await response.json() as { content?: { sha?: string }; commit?: { sha?: string; html_url?: string } };
  return json({ ok: true, path, sha: output.content?.sha, commitSha: output.commit?.sha, commitUrl: output.commit?.html_url }, sha ? 200 : 201);
}

function safePath(value: unknown): value is string {
  return typeof value === "string" && FILE_PATTERN.test(value);
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const c = config();
    const path = url.searchParams.get("path");
    if (path !== null) {
      if (!safePath(path)) return json({ error: "动态路径不合法" }, 400);
      const file = await read(c, path);
      return file ? json(extract(file)) : json({ error: "动态不存在" }, 404);
    }
    const response = await github(c, "contents/" + ROOT.slice(0, -1) + "?ref=" + encodeURIComponent(c.branch));
    if (response.status === 404) return json([]);
    if (!response.ok) return json({ error: "获取动态列表失败（GitHub HTTP " + response.status + "）" }, 502);
    const files = await response.json() as GithubFile[];
    if (!Array.isArray(files)) return json({ error: "GitHub 动态目录格式不正确" }, 502);
    const names = files.filter((file) => file.type === "file" && safePath(file.path));
    if (names.length > 250) return json({ error: "动态数量较多，当前管理器每次最多读取 250 条" }, 413);
    const entries = await Promise.all(names.map(async (entry) => {
      const file = await read(c, entry.path);
      return file ? extract(file) : null;
    }));
    return json(entries.filter((entry) => entry !== null).map((entry) => ({
      path: entry.path, sha: entry.sha, published: entry.published,
      pinned: entry.pinned, location: entry.location, preview: entry.body.slice(0, 160).replace(/\s+/g, " "),
    })).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.published.localeCompare(a.published)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "动态列表读取失败" }, 503);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const input = validatedInput(await request.json());
    if (!input) return json({ error: "请检查发布时间、正文、地点和置顶状态（正文最多 200 KB）" }, 400);
    const c = config();
    const stem = input.published.replace(/[- :]/g, "").replace(/^(\d{8})(\d{6})$/, "$1-$2");
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const path = ROOT + stem + "-" + suffix + ".md";
    return await write(c, path, markdown(input));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "创建动态失败" }, 503);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const value = await request.json() as Record<string, unknown>;
    const input = validatedInput(value);
    if (!input || !safePath(value.path) || typeof value.sha !== "string" || !/^[0-9a-f]{40}$/.test(value.sha)) {
      return json({ error: "动态内容、路径或版本信息不合法" }, 400);
    }
    const c = config();
    const file = await read(c, value.path);
    if (!file) return json({ error: "动态不存在，可能已删除" }, 404);
    if (file.sha !== value.sha) return json({ error: "动态已被修改，请刷新并确认最新版本" }, 409);
    return await write(c, file.path, markdown(input, file.content), file.sha);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "修改动态失败" }, 503);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const value = await request.json() as Record<string, unknown>;
    if (!safePath(value.path) || typeof value.sha !== "string" || !/^[0-9a-f]{40}$/.test(value.sha)) {
      return json({ error: "删除路径或文件版本不合法" }, 400);
    }
    const c = config();
    const file = await read(c, value.path);
    if (!file) return json({ error: "动态已不存在" }, 404);
    if (file.sha !== value.sha) return json({ error: "动态内容已改变，需刷新确认后再删除" }, 409);
    const result = await github(c, "contents/" + encodedPath(file.path), {
      method: "DELETE",
      body: JSON.stringify({ message: "Delete dynamic: " + file.path.slice(ROOT.length), branch: c.branch, sha: file.sha }),
    });
    if (result.status === 409 || result.status === 422) return json({ error: "GitHub 版本冲突，动态未删除" }, 409);
    if (!result.ok) return json({ error: "删除失败（GitHub HTTP " + result.status + "）" }, 502);
    const payload = await result.json() as { commit?: { sha?: string; html_url?: string } };
    return json({ ok: true, commitSha: payload.commit?.sha, commitUrl: payload.commit?.html_url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "删除动态失败" }, 503);
  }
};
