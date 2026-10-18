const BUILTIN_COMPONENTS = new Set(["Badge", "StepItem", "Steps", "TabGroup", "Timeline", "TimelineItem"]);

function plainText(value) {
  return String(value || "")
    .replace(/^\s*\x60{3,}[^\n]*\n/gm, "")
    .replace(/^\s*\x60{3,}\s*$/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[\x60*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readAttributes(source) {
  const attributes = [];
  const pattern = /([A-Za-z][A-Za-z0-9:_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)')\s*\})/g;
  for (const match of String(source || "").matchAll(pattern)) {
    attributes.push({ name: match[1], value: match[2] ?? match[3] ?? match[4] ?? match[5] ?? "" });
  }
  return attributes;
}

const COMPONENT_ITEM_TYPES = new Set(["default", "tip", "note", "important", "warning", "caution"]);
const COMPONENT_ITEM_ICONS = new Set(["star", "rocket", "git", "flag", "book", "heart", "zap", "bug", "tag", "calendar", "code", "edit"]);
const COMPONENT_TEXT_UNSAFE = /[<>{}\x60*_~$\[\]]/;

function parseLiteralAttributes(source, allowedNames) {
  const raw = String(source || "");
  if (!raw.trim()) return [];
  const pattern = /\s*([A-Za-z][A-Za-z0-9:_-]*)\s*=\s*(?:"([^"<>{}\r\n]*)"|'([^'<>{}\r\n]*)')/gy;
  const attributes = [];
  const seen = new Set();
  let cursor = 0;
  while (cursor < raw.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(raw);
    if (!match) return null;
    const name = match[1];
    const value = match[2] ?? match[3] ?? "";
    if (!allowedNames.has(name) || seen.has(name)) return null;
    if (value.length > 160 || /[\r\n]/.test(value)) return null;
    seen.add(name);
    attributes.push({ name, value });
    cursor = pattern.lastIndex;
  }
  return attributes;
}

function isSafeStructuredText(value, maxLength = 500) {
  const text = String(value ?? "").trim();
  return text.length > 0 && text.length <= maxLength && !COMPONENT_TEXT_UNSAFE.test(text) && !/[\r\n]/.test(text);
}

function isEditableComponentItem(name, attributes, body) {
  const allowed = name === "StepItem"
    ? new Set(["title", "type", "icon"])
    : new Set(["date", "title", "type", "icon"]);
  const parsed = parseLiteralAttributes(attributes, allowed);
  const text = String(body || "").trim();
  if (!parsed || !isSafeStructuredText(text)) return false;
  const values = Object.fromEntries(parsed.map(item => [item.name, item.value]));
  if (values.type && !COMPONENT_ITEM_TYPES.has(values.type)) return false;
  if (values.icon && !COMPONENT_ITEM_ICONS.has(values.icon)) return false;
  return true;
}

function matchingComponentItems(body, name) {
  const result = [];
  const pattern = new RegExp("<" + name + "\\b([^>]*)>([\\s\\S]*?)<\\/" + name + "\\s*>", "g");
  for (const match of String(body || "").matchAll(pattern)) {
    const attrs = readAttributes(match[1]);
    const attr = key => attrs.find(item => item.name === key)?.value || "";
    result.push({
      title: attr("title") || attr("date") || "",
      date: attr("date") || "",
      type: attr("type") || "default",
      icon: attr("icon") || "",
      text: plainText(match[2]),
      rawText: match[2].trim(),
      raw: match[0],
      offset: match.index ?? 0,
      editable: isEditableComponentItem(name, match[1], match[2]),
    });
  }
  return result;
}


function parseTabGroupLabels(attributeSource) {
  const attribute = String(attributeSource || "").match(/^\s*labels\s*=\s*\{\s*\[([\s\S]*?)\]\s*\}\s*$/);
  if (!attribute) return null;
  const source = attribute[1];
  const labels = [];
  let cursor = 0;
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (cursor >= source.length) break;
    const quote = source[cursor];
    if (quote !== '"' && quote !== "'") return null;
    cursor += 1;
    const start = cursor;
    while (cursor < source.length && source[cursor] !== quote) {
      if (/['"\\<>{}\[\]\r\n\t]/.test(source[cursor])) return null;
      cursor += 1;
    }
    if (cursor >= source.length) return null;
    const label = source.slice(start, cursor).trim();
    if (!label || label.length > 80) return null;
    labels.push(label);
    cursor += 1;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (cursor >= source.length) break;
    if (source[cursor] !== ",") return null;
    cursor += 1;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    if (cursor >= source.length) break;
    if (source[cursor] !== '"' && source[cursor] !== "'") return null;
  }
  return labels.length ? labels : null;
}

function parseTabGroupCodeBlocks(body) {
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  let cursor = 0;
  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
  const blocks = [];
  while (cursor < lines.length) {
    const opening = lines[cursor].match(/^ {0,3}(\x60{3,})([A-Za-z0-9+#.-]{0,32})[ \t]*$/);
    if (!opening) return null;
    const fence = opening[1];
    const language = opening[2] || "";
    const closingPattern = new RegExp("^ {0,3}\\x60{" + fence.length + ",}[ \\\\t]*$");
    let closing = cursor + 1;
    while (closing < lines.length && !closingPattern.test(lines[closing])) closing += 1;
    if (closing >= lines.length) return null;
    blocks.push({ language, text: lines.slice(cursor + 1, closing).join("\n") });
    cursor = closing + 1;
    while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
  }
  return blocks.length ? blocks : null;
}

function isSafeTabGroupLabel(value) {
  const label = String(value ?? "").trim();
  return label.length > 0 && label.length <= 80 && !/['"\\<>{}\[\]\r\n\t]/.test(label);
}

/** Data-only preview parser. It never evaluates MDX or inserts source as HTML. */
export function inspectProtectedMarkdown(raw, reason = "") {
  const source = typeof raw === "string" ? raw : "";
  const detail = String(reason || "扩展 Markdown");
  const callout = source.match(/^\s*:{3,}\s*(tip|warning|danger|info|success|note|important|caution)(?:\[([^\]\r\n]*)\]|[ \t]+([^\r\n]*?))?[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*:{3,}[ \t]*$/i);
  if (callout) {
    return { kind: "callout", title: (callout[2] ?? callout[3] ?? "").trim(), type: callout[1].toLowerCase(), text: plainText(callout[4]), body: callout[4].trim(), label: "提示容器" };
  }

  if (/latex.*display math/i.test(detail) || /^\s*\$\$[\s\S]*\$\$\s*$/.test(source)) {
    const text = source.replace(/^\s*\$\$\s*/, "").replace(/\s*\$\$\s*$/, "").trim();
    return { kind: "math", title: "数学公式", text, display: true, label: "公式预览" };
  }
  if (/latex.*inline math/i.test(detail)) {
    const segments = [];
    const expression = /(?<!\\)\$([^$\n]+)(?<!\\)\$/g;
    let cursor = 0;
    for (const match of source.matchAll(expression)) {
      const start = match.index ?? 0;
      if (start > cursor) segments.push({ kind: "text", text: plainText(source.slice(cursor, start)) });
      segments.push({ kind: "math", text: match[1].trim() });
      cursor = start + match[0].length;
    }
    if (cursor < source.length) segments.push({ kind: "text", text: plainText(source.slice(cursor)) });
    if (segments.some(segment => segment.kind === "math")) {
      return { kind: "inline-math", title: "含公式的正文", segments, label: "公式预览" };
    }
  }

  const root = source.match(/<\s*(Steps|Timeline|TabGroup|StepItem|TimelineItem)\b([^>]*)>([\s\S]*?)<\/\s*\1\s*>/);
  if (root) {
    const name = root[1];
    const attrs = readAttributes(root[2]);
    if (name === "Steps" || name === "Timeline") {
      const childName = name === "Steps" ? "StepItem" : "TimelineItem";
      const childPattern = new RegExp("<" + childName + "\\b([^>]*)>([\\s\\S]*?)<\\/" + childName + "\\s*>", "g");
      const items = matchingComponentItems(root[3], childName);
      let remainder = root[3];
      const matches = [...root[3].matchAll(childPattern)];
      for (const match of matches.reverse()) {
        const start = match.index ?? 0;
        remainder = remainder.slice(0, start) + remainder.slice(start + match[0].length);
      }
      const editable = root[2].trim() === ""
        && items.length > 0
        && items.length === matches.length
        && remainder.trim() === ""
        && items.every(item => item.editable);
      return {
        kind: name === "Steps" ? "steps" : "timeline",
        componentName: name,
        title: name === "Steps" ? "步骤流程" : "时间线",
        label: "Firefly 组件 · " + name,
        editable,
        items,
      };
    }
    if (name === "TabGroup") {
      const labels = parseTabGroupLabels(root[2]);
      const parsedCodeBlocks = parseTabGroupCodeBlocks(root[3]);
      const fallbackLabelsAttr = root[2].match(/\blabels\s*=\s*\{\s*\[([\s\S]*?)\]\s*\}/);
      const displayLabels = labels || (fallbackLabelsAttr
        ? [...fallbackLabelsAttr[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1])
        : []);
      const fallbackCodeBlocks = [...root[3].matchAll(/\x60{3,}([^\n]*)\n([\s\S]*?)\x60{3,}/g)]
        .map(match => ({ language: (match[1] || "").trim(), text: match[2].trim() }));
      const panels = parsedCodeBlocks || (fallbackCodeBlocks.length
        ? fallbackCodeBlocks
        : root[3].split(/\n\s*\n/).filter(Boolean).map(text => ({ language: "", text: text.trim() })));
      const items = panels.map((item, index) => ({
        title: displayLabels[index] || "内容 " + (index + 1),
        language: item.language,
        text: item.text,
      }));
      const editable = source.trim() === root[0].trim()
        && Boolean(labels)
        && Boolean(parsedCodeBlocks)
        && labels.length === parsedCodeBlocks.length
        && labels.length >= 1
        && labels.length <= 20
        && labels.every(isSafeTabGroupLabel);
      return { kind: "tabs", title: "标签页分组", label: "Firefly 组件 · TabGroup", editable, items };
    }
    return { kind: "component", title: name, label: "Firefly 组件 · " + name, attributes: attrs, text: plainText(root[3]) };
  }

  const badgePattern = /<Badge\b([^>]*)>([\s\S]*?)<\/Badge\s*>/g;
  if (badgePattern.test(source)) {
    badgePattern.lastIndex = 0;
    const segments = [];
    let cursor = 0;
    for (const match of source.matchAll(badgePattern)) {
      const index = match.index ?? 0;
      if (index > cursor) segments.push({ kind: "text", text: plainText(source.slice(cursor, index)) });
      const attrs = readAttributes(match[1]);
      segments.push({ kind: "badge", type: attrs.find(item => item.name === "type")?.value || "default", text: plainText(match[2]) });
      cursor = index + match[0].length;
    }
    if (cursor < source.length) segments.push({ kind: "text", text: plainText(source.slice(cursor)) });
    return { kind: "badges", title: "徽章组件", segments: segments.filter(item => item.text), label: "徽章预览" };
  }

  if (/^\s*[-*+]\s+\[[ xX]\]/m.test(source)) {
    return {
      kind: "task-list", title: "任务清单", label: "Markdown 任务清单",
      items: source.split(/\r?\n/).filter(line => /^\s*[-*+]\s+\[[ xX]\]/.test(line)).map(line => ({
        checked: /^\s*[-*+]\s+\[[xX]\]/.test(line),
        text: plainText(line.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, "")),
      })),
    };
  }

  const footnotes = [...source.matchAll(/^\s*\[\^([^\]]+)\]:\s*(.+)$/gm)].map(match => ({ title: "[^" + match[1] + "]", text: plainText(match[2]) }));
  if (footnotes.length) return { kind: "footnotes", title: "脚注定义", label: "Markdown 脚注", items: footnotes };

  const wikiLinks = [...source.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => ({ title: match[1].split("|")[0].trim(), text: match[1].includes("|") ? match[1].split("|").slice(1).join("|").trim() : match[1].trim() }));
  if (wikiLinks.length) return { kind: "wiki", title: "Wiki 链接", label: "扩展链接", items: wikiLinks };

  const details = source.match(/<details\b[^>]*>([\s\S]*?)<\/details\s*>/i);
  if (details) {
    const summary = details[1].match(/<summary\b[^>]*>([\s\S]*?)<\/summary\s*>/i);
    const body = summary ? details[1].replace(summary[0], "") : details[1];
    return { kind: "details", title: plainText(summary?.[1] || "可展开内容") || "可展开内容", text: plainText(body), label: "HTML 展开区块" };
  }

  const iframe = source.match(/<iframe\b([^>]*)>/i);
  if (iframe) {
    const src = readAttributes(iframe[1]).find(item => item.name.toLowerCase() === "src")?.value || "";
    let host = "";
    try { host = new URL(src).hostname; } catch { host = src ? "相对地址" : "未指定地址"; }
    return { kind: "embed", title: "外部嵌入", host, text: "为安全起见，编辑器不执行嵌入代码。", label: "HTML / iframe" };
  }

  const opening = source.match(/<\s*([A-Z][A-Za-z0-9_.]*)\b([^>]*)>/);
  if (opening) {
    const name = opening[1];
    const closingPattern = new RegExp("<\\s*\\/" + name.replace(/[.]/g, "\\.") + "\\s*>");
    const close = closingPattern.exec(source.slice((opening.index || 0) + opening[0].length));
    const body = close ? source.slice((opening.index || 0) + opening[0].length, (opening.index || 0) + opening[0].length + close.index) : "";
    return {
      kind: "component",
      title: name,
      label: BUILTIN_COMPONENTS.has(name) ? "Firefly 组件 · " + name : "自定义 MDX 组件 · " + name,
      attributes: readAttributes(opening[2]),
      text: plainText(body),
    };
  }

  if (/<(?:iframe|video|audio|svg|script|style|div|span|details|summary|table|img|picture|figure)\b/i.test(source)) {
    return { kind: "html", title: "HTML / 主题标签", text: plainText(source), label: detail };
  }

  return { kind: "unknown", title: detail, text: plainText(source), label: "扩展语法预览" };
}

export function serializeEditableStepTimeline(model, values) {
  const componentName = model?.kind === "timeline" ? "Timeline" : "Steps";
  const childName = componentName === "Timeline" ? "TimelineItem" : "StepItem";
  const items = Array.isArray(values) ? values : [];
  if (!items.length || items.length > 30) throw new Error("流程项目数量必须为 1 到 30 项。");
  const allowedTypes = new Set(["default", "tip", "note", "important", "warning", "caution"]);
  const allowedIcons = new Set(["", "star", "rocket", "git", "flag", "book", "heart", "zap", "bug", "tag", "calendar", "code", "edit"]);
  const attribute = (name, value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (text.length > 160 || /[<>{}"\r\n]/.test(text)) throw new Error(name + " 不能包含标签、表达式、引号或换行。");
    return " " + name + '="' + text.replace(/&/g, "&amp;") + '"';
  };
  const lines = ["<" + componentName + ">"];
  for (const item of items) {
    const title = String(item.title || "").trim();
    const text = String(item.text || "").trim();
    const type = String(item.type || "default");
    const icon = String(item.icon || "");
    if (!isSafeStructuredText(title, 160)) throw new Error("每一项都需要安全的纯文字标题。");
    if (!isSafeStructuredText(text, 500)) throw new Error("正文不能为空，且暂不支持嵌套 Markdown/MDX 符号。");
    if (!allowedTypes.has(type)) throw new Error("不支持的项目颜色类型。");
    if (!allowedIcons.has(icon)) throw new Error("不支持的图标名称。");
    let attrs = "";
    if (componentName === "Timeline") attrs += attribute("date", item.date);
    attrs += attribute("title", title);
    if (type !== "default") attrs += attribute("type", type);
    if (icon) attrs += attribute("icon", icon);
    lines.push("  <" + childName + attrs + ">" + text + "</" + childName + ">");
  }
  lines.push("</" + componentName + ">");
  return lines.join("\n");
}


/** Serializes only literal-label TabGroup components whose content is fenced code. */
export function serializeEditableTabGroup(model, values) {
  if (model?.kind !== "tabs") throw new Error("只能保存标签页组件。");
  const items = Array.isArray(values) ? values : [];
  if (!items.length || items.length > 20) throw new Error("标签页数量必须为 1 到 20 项。");
  const labels = [];
  const blocks = [];
  let totalLength = 0;
  for (const item of items) {
    const title = String(item.title ?? "").trim();
    const language = String(item.language ?? "").trim();
    const code = String(item.text ?? "").replace(/\r\n/g, "\n");
    if (!isSafeTabGroupLabel(title)) throw new Error("标签名称不能为空，且不能包含引号、括号、标签或换行。");
    if (!/^[A-Za-z0-9+#.-]{0,32}$/.test(language)) throw new Error("代码语言只允许字母、数字、+、#、点和连字符，最长 32 个字符。");
    if (code.length > 50000 || code.includes("\0")) throw new Error("单个代码面板最多 50000 个字符，且不能包含空字符。");
    totalLength += title.length + language.length + code.length;
    if (totalLength > 150000) throw new Error("标签页内容总长度不能超过 150000 个字符。");
    labels.push(title);
    let longestFence = 0;
    for (const run of code.matchAll(/\x60+/g)) longestFence = Math.max(longestFence, run[0].length);
    const fence = "\x60".repeat(Math.max(3, longestFence + 1));
    blocks.push(fence + language + "\n" + code + "\n" + fence);
  }
  return "<TabGroup labels={" + JSON.stringify(labels) + "}>\n" + blocks.join("\n") + "\n</TabGroup>";
}
