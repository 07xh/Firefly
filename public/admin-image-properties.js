import { validateImageSource } from "./admin-editor-commands.js";

/**
 * Safe, lossless user-facing image attributes for an existing Tiptap Markdown
 * image. Reject ambiguous Markdown syntax instead of silently escaping or
 * altering alt/title text. No HTML parsing and no remote image fetching here.
 */
export function validateVisualImageAttributes(values) {
  const src = validateImageSource(values?.src);
  if (!src) return { ok: false, error: "图片地址须为 HTTPS URL 或站内绝对路径。" };
  const alt = typeof values?.alt === "string" ? values.alt.trim() : "";
  const title = typeof values?.title === "string" ? values.title.trim() : "";
  if (alt.length > 160 || title.length > 160) {
    return { ok: false, error: "图片说明和标题都不能超过 160 个字符。" };
  }
  // Markdown's ![alt](url "title") requires escapes for these tokens.
  // Restrict this visual-only path to literals with stable round-trip behavior.
  if (/[\r\n\0\[\]\\]/.test(alt) || /[\r\n\0"\\]/.test(title)) {
    return { ok: false, error: "图片说明或标题包含特殊 Markdown 字符，请改用源码模式。" };
  }
  return { ok: true, attrs: { src, alt, title } };
}

/**
 * Detect a stale selection even if a modal has remained open while document
 * data was replaced, so commands never overwrite the wrong image.
 */
export function matchesOriginalImage(current, snapshot) {
  return Boolean(current && current.type?.name === "image" &&
    current.attrs?.src === snapshot?.src &&
    (current.attrs?.alt || "") === (snapshot?.alt || "") &&
    (current.attrs?.title || "") === (snapshot?.title || ""));
}
