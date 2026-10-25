// Optional private Cloudflare R2 image upload for the Firefly admin.
// No API access keys are needed: the Worker uses its own R2 bucket binding.
// The existing GitHub image upload and all already-published URLs are untouched.

export interface FireflyR2Bucket {
  put(
    key: string,
    value: Uint8Array,
    options: {
      httpMetadata: { contentType: string; cacheControl: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 4 * 1024 * 1024;

// Only the server-side Worker operator sets this URL. It must already
// publicly serve the SAME R2 bucket; do not issue an image URL otherwise.
export function normalizeR2PublicBaseUrl(raw: string): string {
  const input = raw.trim();
  if (!input || input.length > 2048 || /[\\?#]/.test(input)) {
    throw new Error("FIREFLY_R2_PUBLIC_BASE_URL 必须是没有查询参数的 HTTPS 公开地址。");
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("FIREFLY_R2_PUBLIC_BASE_URL 不是有效的 HTTPS URL。");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.port ||
    /^(?:localhost|127\.|0\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname) ||
    url.hostname.endsWith(".local") ||
    url.hostname.endsWith(".localhost")
  ) {
    throw new Error("R2 图片公开地址必须是可公开访问的 HTTPS 域名。");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.some((part) => !/^[A-Za-z0-9_-]{1,80}$/.test(part))) {
    throw new Error("R2 图片公开地址的路径前缀包含不支持的字符。");
  }
  return url.origin + (segments.length ? "/" + segments.join("/") : "");
}

export function newR2ImageKey(
  mime: string,
  date: Date,
  uuid: string,
): string {
  const extension = IMAGE_EXTENSIONS[mime];
  if (!extension || !Number.isFinite(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(uuid)) {
    throw new Error("R2 图片文件信息无效。");
  }
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `firefly/${year}/${month}/${day}/${uuid.replace(/-/g, "").toLowerCase()}.${extension}`;
}

export async function uploadImageToR2(args: {
  bucket?: FireflyR2Bucket;
  publicBaseUrl?: string;
  bytes: Uint8Array;
  mime: string;
  now?: Date;
  uuid?: string;
}): Promise<{ key: string; imageUrl: string; filename: string }> {
  if (!args.bucket || typeof args.bucket.put !== "function") {
    throw new Error("R2 图床尚未绑定：请在 Cloudflare Worker 中配置 FIREFLY_IMAGE_R2。");
  }
  if (!args.publicBaseUrl) {
    throw new Error("R2 图床尚未配置公开图片地址 FIREFLY_R2_PUBLIC_BASE_URL。");
  }
  const base = normalizeR2PublicBaseUrl(args.publicBaseUrl);
  if (
    !(args.bytes instanceof Uint8Array) ||
    args.bytes.length < 1 ||
    args.bytes.length > MAX_BYTES ||
    !Object.hasOwn(IMAGE_EXTENSIONS, args.mime)
  ) {
    throw new Error("R2 图片大小或类型不符合要求。");
  }
  const key = newR2ImageKey(
    args.mime,
    args.now ?? new Date(),
    args.uuid ?? crypto.randomUUID(),
  );
  // Each randomized key is a new object; never copy, replace or delete
  // existing GitHub/third-party image references or R2 objects.
  await args.bucket.put(key, args.bytes, {
    httpMetadata: {
      contentType: args.mime,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { uploadedBy: "firefly-admin", source: "image-upload" },
  });
  return {
    key,
    filename: key.split("/").at(-1) ?? key,
    imageUrl: `${base}/${key}`,
  };
}
