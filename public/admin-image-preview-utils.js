const POST_CONTENT_ROOT = ["src", "content", "posts"];
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif"]);

/**
 * Resolve a Markdown image path relative to the source article, not the admin URL.
 * Only repository-local images under src/content/posts are eligible for the private preview proxy.
 */
export function resolveRepositoryImagePath(articlePath, imageSource) {
  if (typeof articlePath !== "string" || typeof imageSource !== "string") return null;
  const article = articlePath.trim();
  const source = imageSource.trim();
  if (!article || !source || source.startsWith("#") || source.startsWith("/") || source.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) || /[\\\x00-\x1f\x7f]/.test(source)) return null;

  const sourcePath = source.split(/[?#]/, 1)[0];
  if (!sourcePath) return null;

  let decoded;
  try {
    decoded = decodeURIComponent(sourcePath);
  } catch {
    return null;
  }
  if (!decoded || decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("//")) return null;

  const articleParts = article.split("/");
  if (articleParts.length < 4 || articleParts[0] !== "src" || articleParts[1] !== "content" || articleParts[2] !== "posts") return null;
  const articleName = articleParts.pop();
  if (!articleName || articleName === "." || articleName === "..") return null;

  const resolved = articleParts.slice();
  for (const segment of decoded.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (resolved.length <= POST_CONTENT_ROOT.length) return null;
      resolved.pop();
      continue;
    }
    if (/[\\\x00-\x1f\x7f]/.test(segment)) return null;
    resolved.push(segment);
  }

  if (resolved.length <= POST_CONTENT_ROOT.length || resolved.slice(0, POST_CONTENT_ROOT.length).join("/") !== POST_CONTENT_ROOT.join("/")) return null;
  const extension = resolved[resolved.length - 1].split(".").pop()?.toLowerCase();
  if (!extension || !IMAGE_EXTENSIONS.has(extension)) return null;
  return resolved.join("/");
}

export function getAdminImagePreviewUrl(articlePath, imageSource) {
  const path = resolveRepositoryImagePath(articlePath, imageSource);
  return path ? "/api/admin/image-preview/?path=" + encodeURIComponent(path) : null;
}
