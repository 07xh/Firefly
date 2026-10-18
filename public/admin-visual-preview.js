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
    });
  }
  return result;
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
    return { kind: "math", title: "数学公式", text: source.replace(/^\s*\$\$?|\$\$?\s*$/g, "").trim(), display: true, label: "公式预览" };
  }
  if (/latex.*inline math/i.test(detail) || /^\s*[^$\n]*\$[^$\n]+\$[^$\n]*\s*$/.test(source)) {
    return { kind: "math", title: "行内公式", text: source.trim(), display: false, label: "公式预览" };
  }

  const badgePattern = /<Badge\b([^>]*)>([\s\S]*?)<\/Badge\s*>/g;
  if (badgePattern.test(source)) {
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

  const root = source.match(/<\s*(Steps|Timeline|TabGroup|StepItem|TimelineItem)\b([^>]*)>([\s\S]*?)<\/\s*\1\s*>/);
  if (root) {
    const name = root[1];
    const attrs = readAttributes(root[2]);
    if (name === "Steps" || name === "Timeline") {
      const childName = name === "Steps" ? "StepItem" : "TimelineItem";
      return {
        kind: name === "Steps" ? "steps" : "timeline",
        title: name === "Steps" ? "步骤流程" : "时间线",
        label: "Firefly 组件 · " + name,
        items: matchingComponentItems(root[3], childName),
      };
    }
    if (name === "TabGroup") {
      const labelsAttr = root[2].match(/\blabels\s*=\s*\{\s*\[([\s\S]*?)\]\s*\}/);
      const labels = labelsAttr ? [...labelsAttr[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1]) : [];
      const codeBlocks = [...root[3].matchAll(/\x60{3,}([^\n]*)\n([\s\S]*?)\x60{3,}/g)].map(match => ({ language: (match[1] || "").trim(), text: match[2].trim() }));
      const panels = codeBlocks.length ? codeBlocks : root[3].split(/\n\s*\n/).filter(Boolean).map(text => ({ language: "", text: text.trim() }));
      const items = panels.map((item, index) => ({ title: labels[index] || "内容 " + (index + 1), language: item.language, text: item.text }));
      return { kind: "tabs", title: "标签页分组", label: "Firefly 组件 · TabGroup", items };
    }
    return { kind: "component", title: name, label: "Firefly 组件 · " + name, attributes: attrs, text: plainText(root[3]) };
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
