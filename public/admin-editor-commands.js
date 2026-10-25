/**
 * Firefly's small Pages CMS-inspired command registry.
 * No Tiptap/React dependency: the UI may search commands without ever
 * touching the serialized Markdown/MDX document.
 */
export const SLASH_ITEMS = Object.freeze([
  { key: "paragraph", label: "正文段落", keywords: "paragraph text 正文 段落" },
  { key: "h1", label: "一级标题", keywords: "heading h1 title 标题" },
  { key: "h2", label: "二级标题", keywords: "heading h2 subtitle 标题" },
  { key: "h3", label: "三级标题", keywords: "heading h3 标题" },
  { key: "bullet", label: "无序列表", keywords: "list bullet 项目符号" },
  { key: "ordered", label: "有序列表", keywords: "list ordered number 数字列表" },
  { key: "quote", label: "引用", keywords: "quote blockquote 引言" },
  { key: "code", label: "代码块", keywords: "code python 编程" },
  { key: "rule", label: "分隔线", keywords: "rule divider 水平线" },
  { key: "callout", label: "提示卡片", keywords: "callout notice note 提示 警告" },
  { key: "badge", label: "文字徽章", keywords: "badge 标签 徽章" },
  { key: "table", label: "插入表格", keywords: "table grid 表格" },
  { key: "imagePicker", label: "上传本地图片", keywords: "image upload 图片 文件 粘贴" },
  { key: "imageUrl", label: "插入图床图片", keywords: "image url 图片 图床 链接 外链" },
]);

export function filterSlashItems(items, query) {
  const text = String(query || "").trim().normalize("NFKC").toLocaleLowerCase();
  if (!text) return [...items];
  return items.filter(item => (item.label + " " + item.key + " " + item.keywords)
    .normalize("NFKC").toLocaleLowerCase().includes(text));
}

/**
 * Reject protocols and characters that could mutate Markdown output, while
 * supporting HTTPS image hosts and site-absolute image paths.
 */
export function validateImageSource(value) {
  const input = typeof value === "string" ? value.trim() : "";
  if (!input || input.length > 2048 || /[\s"'<>\\\[\]()]/.test(input)) return null;
  if (input.startsWith("/") && !input.startsWith("//")) {
    const pathname = input.split(/[?#]/, 1)[0];
    const segments = pathname.split("/");
    if (segments.some(segment => segment === "." || segment === ".." || /%2e/i.test(segment))) return null;
    return input;
  }
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return input;
  } catch {
    return null;
  }
}
