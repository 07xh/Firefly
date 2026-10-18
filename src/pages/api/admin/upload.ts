import { env as workerEnv } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

type RuntimeEnv = {
  FIREFLY_CONTENTS_TOKEN?: string;
  GITHUB_CONTENTS_REPO?: string;
  GITHUB_CONTENTS_BRANCH?: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

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

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function validMagic(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
      bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d &&
      bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/gif") {
    const signature = new TextDecoder().decode(bytes.subarray(0, 6));
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mime === "image/webp") {
    return bytes.length >= 12 &&
      new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP";
  }
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const env = workerEnv as unknown as RuntimeEnv;
    const token = env.FIREFLY_CONTENTS_TOKEN?.trim();
    const repo = env.GITHUB_CONTENTS_REPO?.trim() || "07xh/Firefly";
    const branch = env.GITHUB_CONTENTS_BRANCH?.trim() || "master";
    if (!token) return json({ error: "FIREFLY_CONTENTS_TOKEN 尚未配置。" }, 503);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return json({ error: "仓库配置不合法。" }, 503);

    const contentLength = request.headers.get("Content-Length");
    if (contentLength && (!/^\\d+$/.test(contentLength) || Number(contentLength) > 5 * 1024 * 1024)) {
      return json({ error: "上传请求超过 5 MiB 限制。" }, 413);
    }
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) return json({ error: "请求中没有图片文件。" }, 400);
    if (value.size < 1 || value.size > MAX_IMAGE_BYTES) {
      return json({ error: "图片必须大于 0 且不超过 4 MiB。" }, 413);
    }

    const mime = value.type.toLowerCase();
    const extension = MIME_EXTENSIONS[mime];
    if (!extension) return json({ error: "仅支持 PNG、JPEG、WebP 和 GIF 图片。" }, 415);

    const bytes = new Uint8Array(await value.arrayBuffer());
    if (!validMagic(bytes, mime)) return json({ error: "文件内容与图片类型不匹配，已拒绝上传。" }, 415);

    const now = new Date();
    const date = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0"),
    ].join("");
    const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const filename = `${date}-${random}.${extension}`;
    const path = `src/assets/images/${filename}`;
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Firefly-Admin/1.0 (https://github.com/07xh/Firefly)",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: `Upload article image: ${filename}`,
        content: encodeBase64(bytes),
        branch,
      }),
    });

    const payload = await response.json().catch(() => ({})) as {
      message?: string;
      content?: { path?: string; sha?: string };
      commit?: { sha?: string; html_url?: string };
    };
    if (!response.ok) {
      const message = typeof payload.message === "string" ? payload.message.slice(0, 200) : "GitHub 图片上传失败";
      return json({ error: `GitHub 图片上传失败 (${response.status})：${message}` }, response.status === 409 ? 409 : 502);
    }

    const encodedBranch = encodeURIComponent(branch).replace(/%2F/g, "%2F");
    const imageUrl = `https://raw.githubusercontent.com/${repo}/${encodedBranch}/${path.split("/").map(encodeURIComponent).join("/")}`;
    return json({
      ok: true,
      path: payload.content?.path ?? path,
      filename,
      imageUrl,
      commitSha: payload.commit?.sha ?? null,
      commitUrl: payload.commit?.html_url ?? null,
    }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "图片上传失败。" }, 500);
  }
};
