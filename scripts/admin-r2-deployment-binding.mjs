/**
 * Opt-in R2 image binding for Firefly's GENERATED Cloudflare deploy config.
 * Does not create buckets, change KV, touch secrets, or enable storage without
 * both explicit Actions variables. The existing GitHub upload remains default.
 */
export function configureOptionalFireflyR2(config, {
  bucketName = "",
  publicBaseUrl = "",
} = {}) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("Expected generated Wrangler JSON config");
  }
  const bucket = String(bucketName).trim();
  const publicUrl = String(publicBaseUrl).trim();
  if (!bucket && !publicUrl) return { enabled: false };
  if (!bucket || !publicUrl) {
    throw new Error("Both FIREFLY_IMAGE_R2_BUCKET_NAME and FIREFLY_R2_PUBLIC_BASE_URL must be set together");
  }
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("R2 image bucket name is invalid; create a real bucket first");
  }
  let url;
  try {
    url = new URL(publicUrl);
  } catch {
    throw new Error("R2 image public URL is invalid");
  }
  if (
    url.protocol !== "https:" || !url.hostname || url.username ||
    url.password || url.port || url.search || url.hash ||
    /^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname) ||
    url.hostname.endsWith(".local")
  ) {
    throw new Error("R2 public image URL must be a public HTTPS hostname without credentials or query");
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.some((part) => !/^[A-Za-z0-9_-]{1,80}$/.test(part))) {
    throw new Error("Invalid public R2 URL path prefix");
  }
  const normal = url.origin + (parts.length ? "/" + parts.join("/") : "");
  if (!Array.isArray(config.r2_buckets) && config.r2_buckets !== undefined) {
    throw new Error("Existing R2 bindings have an unexpected shape; refusing overwrite");
  }
  const entries = config.r2_buckets ?? [];
  const candidates = entries.filter((entry) => entry?.binding === "FIREFLY_IMAGE_R2");
  if (candidates.length > 1 ||
      (candidates.length === 1 && candidates[0].bucket_name !== bucket)) {
    throw new Error("Conflicting existing FIREFLY_IMAGE_R2 binding; refusing bucket replacement");
  }
  if (config.vars !== undefined &&
      (!config.vars || typeof config.vars !== "object" || Array.isArray(config.vars))) {
    throw new Error("Existing Wrangler vars are invalid; refusing overwrite");
  }
  if (config.vars?.FIREFLY_R2_PUBLIC_BASE_URL !== undefined &&
      config.vars.FIREFLY_R2_PUBLIC_BASE_URL !== normal) {
    throw new Error("Conflicting existing R2 public URL; refusing overwrite");
  }
  config.r2_buckets = candidates.length ? entries : [
    ...entries, { binding: "FIREFLY_IMAGE_R2", bucket_name: bucket },
  ];
  config.vars = {
    ...(config.vars ?? {}),
    FIREFLY_R2_PUBLIC_BASE_URL: normal,
  };
  return { enabled: true, bucketName: bucket, publicBaseUrl: normal };
}
