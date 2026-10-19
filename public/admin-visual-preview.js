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



function findTabGroupRoot(source) {
  const text = String(source || "");
  const opening = text.match(/^\s*<\s*TabGroup\b([^>]*)>/);
  if (!opening) return null;
  const afterOpening = text.slice(opening[0].length);
  const lines = afterOpening.split("\n");
  let offset = 0;
  let fenceLength = 0;
  for (const line of lines) {
    if (fenceLength) {
      const closingFence = new RegExp("^ {0,3}\\x60{" + fenceLength + ",}[ \\x09]*$");
      if (closingFence.test(line)) fenceLength = 0;
    } else {
      const fence = line.match(/^ {0,3}(\x60{3,})/);
      if (fence) {
        fenceLength = fence[1].length;
      } else if (/^\s*<\/\s*TabGroup\s*>\s*$/.test(line)) {
        const body = afterOpening.slice(0, offset);
        const full = text.slice(0, opening[0].length + offset + line.length);
        return [full, "TabGroup", opening[1], body];
      }
    }
    offset += line.length + 1;
  }
  return null;
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
    const closingPattern = new RegExp("^ {0,3}\\x60{" + fence.length + ",}[ \\x09]*$");
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


const SAFE_CALLOUT_TYPES = new Set(["tip", "warning", "danger", "info", "success", "note", "important", "caution"]);

function isSafeCalloutTitle(value, allowEmpty = true) {
  const title = String(value ?? "").trim();
  return (allowEmpty || title.length > 0)
    && title.length <= 120
    && !/[<>{}\x60*_~$\[\]\r\n]/.test(title);
}

function isSafeCalloutBody(value) {
  const body = String(value ?? "").trim();
  if (!body || body.length > 5000 || /[<>{}\x60*_~$\[\]]/.test(body)) return false;
  return body.split(/\r?\n/).every(line =>
    !/^\s*(?::{3,}|#{1,6}\s|>|[-*+]\s|\d+[.)]\s|!\[)/.test(line)
  );
}


function isSafeTaskListText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 && text.length <= 500 && !/[<>{}\x60*_~$\[\]\r\n]/.test(text);
}


function isSafeDetailsTitle(value) {
  const title = String(value ?? "").trim();
  return title.length > 0 && title.length <= 120 && !/[<>{}\x60*_~$\[\]\r\n]/.test(title);
}

function isSafeDetailsBody(value, allowEmpty = true) {
  const body = String(value ?? "").trim();
  if (!allowEmpty && !body) return false;
  if (body.length > 5000 || /[<>{}\x60*_~$\[\]]/.test(body)) return false;
  const lines = body.split(/\r?\n/);
  return lines.every(line => !/^\s*(?:#{1,6}\s|>{1}|[-*+]\s|\d+[.)]\s|:{3,}|!\[)/.test(line))
    && !/\n\s*\n/.test(body);
}

/**
 * Convert internal parser labels into plain Chinese suitable for the editor UI.
 * The original reason is still stored unchanged so parser behaviour is unaffected.
 */
export function describeProtectedSyntax(reason = "") {
  const value = String(reason || "").trim().toLowerCase();
  if (/latex.*display math|display math/.test(value)) return "数学公式";
  if (/latex.*inline math|inline math/.test(value)) return "含公式的正文";
  if (/callout|提示容器/.test(value)) return "提示卡片";
  if (/task[\s_-]*list|任务清单/.test(value)) return "待办清单";
  if (/footnote|脚注/.test(value)) return "脚注内容";
  if (/wiki/.test(value)) return "站内链接";
  if (/import|export/.test(value)) return "组件引用设置";
  if (/expression/.test(value)) return "动态内容";
  if (/iframe|embed/.test(value)) return "外部嵌入内容";
  if (/details|折叠/.test(value)) return "折叠内容";
  if (/badge|徽章/.test(value)) return "徽章标记";
  if (/component|组件/.test(value)) return "特殊内容组件";
  if (/directive|指令/.test(value)) return "特殊内容区块";
  if (/html|theme tag|主题标签/.test(value)) return "特殊版式内容";
  return "特殊内容";
}

/** Data-only preview parser. It never evaluates MDX or inserts source as HTML. */
export function inspectProtectedMarkdown(raw, reason = "") {
  const source = typeof raw === "string" ? raw : "";
  const detail = String(reason || "特殊内容");
  const callout = source.match(/^\s*:{3,}\s*(tip|warning|danger|info|success|note|important|caution)(?:\[([^\]\r\n]*)\]|[ \t]+([^\r\n]*?))?[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*:{3,}[ \t]*$/i);
  if (callout) {
    const title = (callout[2] ?? callout[3] ?? "").trim();
    const body = callout[4].trim();
    const type = callout[1].toLowerCase();
    const editable = source === source.trim()
      && SAFE_CALLOUT_TYPES.has(type)
      && isSafeCalloutTitle(title, true)
      && isSafeCalloutBody(body);
    return { kind: "callout", title, type, text: plainText(body), body, editable, label: "提示卡片" };
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

  let root = source.match(/<\s*(Steps|Timeline|TabGroup|StepItem|TimelineItem)\b([^>]*)>([\s\S]*?)<\/\s*\1\s*>/);
  if (root && root[1] === "TabGroup") root = findTabGroupRoot(source) || root;
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
        title: name === "Steps" ? "步骤清单" : "时间线",
        label: name === "Steps" ? "步骤内容" : "时间线内容",
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
      return { kind: "tabs", title: "分组内容", label: "分组内容", editable, items };
    }
    return { kind: "component", title: ({ Badge: "文字标签", StepItem: "步骤内容", Steps: "步骤清单", TabGroup: "分组内容", Timeline: "时间线", TimelineItem: "时间点" })[name] || "特殊内容模块", label: BUILTIN_COMPONENTS.has(name) ? "博客内置内容" : "自定义展示内容", attributes: attrs, text: plainText(root[3]) };
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
    return { kind: "badges", title: "文字标签", segments: segments.filter(item => item.text), label: "文字标签预览" };
  }

  if (/^\s*[-*+]\s+\[[ xX]\]/m.test(source)) {
    const normalized = source.replace(/\r\n/g, "\n").replace(/\n+$/, "");
    const lines = normalized.split("\n");
    const rawItems = lines.map(line => {
      const match = /^- \[([ xX])\] (.+)$/.exec(line);
      return match ? { checked: /[xX]/.test(match[1]), text: match[2] } : null;
    });
    const editable = Boolean(normalized)
      && source === source.trimStart()
      && lines.length <= 100
      && rawItems.every(item => item && isSafeTaskListText(item.text));
    return {
      kind: "task-list", title: "待办清单", label: "待办清单", editable,
      items: source.split(/\r?\n/).filter(line => /^\s*[-*+]\s+\[[ xX]\]/.test(line)).map(line => ({
        checked: /^\s*[-*+]\s+\[[xX]\]/.test(line),
        text: plainText(line.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, "")),
      })),
    };
  }

  const footnotes = [...source.matchAll(/^\s*\[\^([^\]]+)\]:\s*(.+)$/gm)].map(match => ({ title: "[^" + match[1] + "]", text: plainText(match[2]) }));
  if (footnotes.length) return { kind: "footnotes", title: "脚注定义", label: "脚注内容", items: footnotes };

  const wikiLinks = [...source.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => ({ title: match[1].split("|")[0].trim(), text: match[1].includes("|") ? match[1].split("|").slice(1).join("|").trim() : match[1].trim() }));
  if (wikiLinks.length) return { kind: "wiki", title: "Wiki 链接", label: "站内链接", items: wikiLinks };

  const details = source.match(/<details\b[^>]*>([\s\S]*?)<\/details\s*>/i);
  if (details) {
    const summary = details[1].match(/<summary\b[^>]*>([\s\S]*?)<\/summary\s*>/i);
    const body = summary ? details[1].replace(summary[0], "").trim() : details[1].trim();
    const strict = source === details[0]
      && /^<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*)<\/details>$/.test(source);
    const exact = strict ? source.match(/^<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*)<\/details>$/) : null;
    const title = exact ? exact[1].trim() : plainText(summary?.[1] || "可展开内容");
    const content = exact ? exact[2].trim() : body;
    const editable = Boolean(exact)
      && isSafeDetailsTitle(title)
      && isSafeDetailsBody(content, true);
    return {
      kind: "details",
      title: plainText(title || "可展开内容") || "可展开内容",
      text: plainText(content),
      body: content,
      editable,
      label: "可展开内容",
    };
  }

  const iframe = source.match(/<iframe\b([^>]*)>/i);
  if (iframe) {
    const src = readAttributes(iframe[1]).find(item => item.name.toLowerCase() === "src")?.value || "";
    let host = "";
    try { host = new URL(src).hostname; } catch { host = src ? "相对地址" : "未指定地址"; }
    return { kind: "embed", title: "外部嵌入", host, text: "为安全起见，编辑器不执行嵌入代码。", label: "外部内容嵌入" };
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
    return { kind: "html", title: "特殊版式内容", text: plainText(source), label: detail };
  }

  return { kind: "unknown", title: "特殊内容", text: plainText(source), label: "特殊内容预览" };
}

export function serializeEditableStepTimeline(model, values) {
  const componentName = model?.kind === "timeline" ? "Timeline" : "Steps";
  const childName = componentName === "Timeline" ? "TimelineItem" : "StepItem";
  const items = Array.isArray(values) ? values : [];
  if (!items.length || items.length > 30) throw new Error("请保留 1 到 30 个步骤或时间点。");
  const allowedTypes = new Set(["default", "tip", "note", "important", "warning", "caution"]);
  const allowedIcons = new Set(["", "star", "rocket", "git", "flag", "book", "heart", "zap", "bug", "tag", "calendar", "code", "edit"]);
  const attribute = (name, value) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    if (text.length > 160 || /[<>{}"\r\n]/.test(text)) throw new Error(name + "请使用简短的普通文字，不要加入特殊符号或换行。");
    return " " + name + '="' + text.replace(/&/g, "&amp;") + '"';
  };
  const lines = ["<" + componentName + ">"];
  for (const item of items) {
    const title = String(item.title || "").trim();
    const text = String(item.text || "").trim();
    const type = String(item.type || "default");
    const icon = String(item.icon || "");
    if (!isSafeStructuredText(title, 160)) throw new Error("请为每一项填写标题，使用普通文字即可。");
    if (!isSafeStructuredText(text, 500)) throw new Error("正文不能为空；复杂排版请到高级模式修改，以免格式丢失。");
    if (!allowedTypes.has(type)) throw new Error("请选择一种可用的颜色样式。");
    if (!allowedIcons.has(icon)) throw new Error("图标名称不在可选范围内，请选择其他图标。");
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
  if (model?.kind !== "tabs") throw new Error("当前内容不是可编辑的分组，请重新选择。");
  const items = Array.isArray(values) ? values : [];
  if (!items.length || items.length > 20) throw new Error("分组数量请保持在 1 到 20 个之间。");
  const labels = [];
  const blocks = [];
  let totalLength = 0;
  for (const item of items) {
    const title = String(item.title ?? "").trim();
    const language = String(item.language ?? "").trim();
    const code = String(item.text ?? "").replace(/\r\n/g, "\n");
    if (!isSafeTabGroupLabel(title)) throw new Error("标签名称不能为空；请避免使用引号或换行。");
    if (!/^[A-Za-z0-9+#.-]{0,32}$/.test(language)) throw new Error("代码语言请使用字母、数字或常见符号，最多 32 个字符。");
    if (code.length > 50000 || code.includes("\0")) throw new Error("单个示例内容最多 50000 个字符。");
    totalLength += title.length + language.length + code.length;
    if (totalLength > 150000) throw new Error("所有分组内容合计不能超过 150000 个字符。");
    labels.push(title);
    let longestFence = 0;
    for (const run of code.matchAll(/\x60+/g)) longestFence = Math.max(longestFence, run[0].length);
    const fence = "\x60".repeat(Math.max(3, longestFence + 1));
    blocks.push(fence + language + "\n" + code + "\n" + fence);
  }
  return "<TabGroup labels={" + JSON.stringify(labels) + "}>\n" + blocks.join("\n") + "\n</TabGroup>";
}


/** Serializes only simple text callouts; formatted or nested bodies remain protected. */
export function serializeEditableCallout(model, values) {
  if (model?.kind !== "callout") throw new Error("当前内容不能按提示卡片保存，请重新选择。");
  const type = String(values?.type ?? model.type ?? "").toLowerCase();
  const title = String(values?.title ?? "").trim();
  const body = String(values?.body ?? "").replace(/\r\n/g, "\n").trim();
  if (!SAFE_CALLOUT_TYPES.has(type)) throw new Error("请选择有效的提示样式。");
  if (!isSafeCalloutTitle(title, true)) throw new Error("标题请使用一行普通文字，不要加入特殊格式符号。");
  if (!isSafeCalloutBody(body)) throw new Error("正文必须是纯文本；复杂排版请到高级模式修改，以免格式丢失。");
  return ":::" + type + (title ? "[" + title + "]" : "") + "\n" + body + "\n:::";
}


export function serializeEditableTaskList(values) {
  const items = Array.isArray(values) ? values : [];
  if (!items.length || items.length > 100) throw new Error("待办事项数量请保持在 1 到 100 项之间。");
  let totalLength = 0;
  const lines = items.map(item => {
    const text = String(item?.text ?? "").trim();
    if (!isSafeTaskListText(text)) throw new Error("每一项都需要填写一行纯文字；复杂排版请到高级模式修改。");
    totalLength += text.length;
    if (totalLength > 50000) throw new Error("整份待办清单不能超过 50000 个字符。");
    return "- [" + (item?.checked ? "x" : " ") + "] " + text;
  });
  return lines.join("\n");
}


/** Serializes only a plain-text disclosure block. */
export function serializeEditableDetails(values) {
  const title = String(values?.title ?? "").trim();
  const body = String(values?.body ?? "").replace(/\r\n/g, "\n").trim();
  if (!isSafeDetailsTitle(title)) throw new Error("折叠区标题不能为空，请使用普通文字。");
  if (!isSafeDetailsBody(body, true)) throw new Error("正文需要是纯文本；复杂排版或分段请到高级模式修改，以免格式丢失。");
  return "<details>\n<summary>" + title + "</summary>" + (body ? "\n" + body + "\n" : "\n") + "</details>";
}
