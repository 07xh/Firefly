// Editor link validation is independent of Tiptap to keep URL handling testable.
export function validateEditorLink(value) {
  const src = typeof value === "string" ? value.trim() : "";
  if (!src || src.length > 2048 || /[\x00-\x20\x7f<>"'\x60\\]/.test(src)) return null;
  if (/^mailto:/i.test(src)) {
    if (!/^mailto:[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+(?:\?[^<>"']*)?$/i.test(src)) return null;
    return src;
  }
  try {
    const url = new URL(src);
    if (!["http:","https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return src;
  } catch { return null; }
}
