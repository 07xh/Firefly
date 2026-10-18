/**
 * Preserve unsupported Markdown/MDX as opaque blocks so ordinary paragraphs
 * around them remain visually editable without losing source syntax.
 */
function blankNonNewlines(value) {
  return value.replace(/[^\r\n]/g, " ");
}

function maskFencedCode(source) {
  const parts = source.split(/(?<=\n)/);
  let fence = null;
  return parts.map((part) => {
    const line = part.replace(/\r?\n$/, "");
    if (fence) {
      const close = line.match(/^ {0,3}(\x60+|~+)[ \t]*\r?$/);
      const done = close && close[1][0] === fence.char && close[1].length >= fence.length;
      const masked = blankNonNewlines(part);
      if (done) fence = null;
      return masked;
    }
    const open = line.match(/^ {0,3}(\x60{3,}|~{3,})(.*)$/);
    if (!open || (open[1][0] === "\x60" && open[2].includes("\x60"))) return part;
    fence = { char: open[1][0], length: open[1].length };
    return blankNonNewlines(part);
  }).join("");
}

function isEscapedAt(source, index) {
  let count = 0;
  for (let i = index - 1; i >= 0 && source[i] === "\\"; i -= 1) count += 1;
  return count % 2 === 1;
}

function maskInlineCode(source) {
  const chars = source.split("");
  const tick = "\x60";
  for (let i = 0; i < chars.length;) {
    if (chars[i] !== tick || isEscapedAt(source, i)) {
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < chars.length && chars[end] === tick) end += 1;
    const width = end - i;
    let close = -1;
    for (let j = end; j < chars.length;) {
      if (chars[j] !== tick || isEscapedAt(source, j)) {
        j += 1;
        continue;
      }
      let runEnd = j + 1;
      while (runEnd < chars.length && chars[runEnd] === tick) runEnd += 1;
      if (runEnd - j === width) {
        close = j;
        break;
      }
      j = runEnd;
    }
    if (close < 0) {
      i = end;
      continue;
    }
    const closeEnd = close + width;
    for (let j = i; j < closeEnd; j += 1) {
      if (chars[j] !== "\r" && chars[j] !== "\n") chars[j] = " ";
    }
    i = closeEnd;
  }
  return chars.join("");
}

function blank(line) {
  return !line || line.trim() === "";
}
function listItem(line) {
  return /^[ \t]{0,3}(?:[-+*][ \t]+|\d+[.)][ \t]+)/.test(line);
}
function taskItem(line) {
  return /^[ \t]{0,3}(?:[-+*]|\d+[.)])[ \t]+\[[ xX]\][ \t]+/.test(line);
}
function tableRow(line) {
  return /^[ \t]*\|.*\|[ \t]*$/.test(line);
}
function markupOnly(line) {
  const value = line.trim();
  return value.startsWith("<") && value.endsWith(">");
}
function trimEdges(value) {
  return value.replace(/^(?:[ \t]*\r?\n)+/, "").replace(/(?:\r?\n[ \t]*)+$/, "");
}

function getProtectedRanges(source) {
  const masked = maskInlineCode(maskFencedCode(source));
  const originalLines = source.split("\n");
  const lines = masked.split("\n");
  const ranges = [];
  const add = (start, end, reason, strategy = "line") => {
    ranges.push({ start, end, reason, strategy });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || "";
    if (blank(line)) continue;

    if (/^[ \t]*\$\$[ \t]*\r?$/.test(line)) {
      let close = i + 1;
      while (close < lines.length && !/^[ \t]*\$\$[ \t]*\r?$/.test(lines[close] || "")) close += 1;
      add(i, Math.min(close, lines.length - 1), "LaTeX display math", "block");
      i = Math.min(close, lines.length - 1);
      continue;
    }

    // Keep module declarations only when they look like real module syntax.
    if (/^[ \t]*import\b/.test(line) && (/\bfrom\b/.test(line) || /["'][^"']+["']/.test(line))) {
      let end = i;
      if (!/["'][^"']+["']/.test(line)) {
        while (end + 1 < lines.length && !blank(lines[end + 1])) {
          end += 1;
          if (/\bfrom\b/.test(lines[end]) && /["'][^"']+["']/.test(lines[end])) break;
        }
      }
      add(i, end, "MDX import/export", "block");
      i = end;
      continue;
    }
    if (/^[ \t]*export[ \t]+(?:default\b|\*|\{|const\b|let\b|var\b|function\b|class\b|async\b)/.test(line)) {
      add(i, i, "MDX import/export", "block");
      continue;
    }

    if (/^[ \t]*:{3,}/.test(line)) {
      add(i, i, "Theme directive", "block");
      continue;
    }

    if (/^[ \t]*(?:[-+*]|\d+\.)[ \t]+\[[ xX]\][ \t]+/.test(line)) {
      add(i, i, "Task list", "list");
      continue;
    }

    if (/^[ \t]*\[\^[^\]]+\]:/.test(line)) {
      add(i, i, "Footnote definition", "paragraph");
      continue;
    }

    if (/\$[^$\n]*(?:\\[a-zA-Z]+|[=+*/^_<>≤≥±×÷])[^$\n]*\$/.test(line)) {
      add(i, i, "LaTeX inline math", "paragraph");
      continue;
    }

    if (/\[\[[^\]\n]+\]\]/.test(line)) {
      add(i, i, "Wiki link", "paragraph");
      continue;
    }

    if (/\{\s*(?:\/\*|[A-Za-z_$][\w$.]*\s*(?:\(|\?\.|\.|\[))/.test(line)) {
      add(i, i, "MDX expression", "paragraph");
      continue;
    }

    const hasComponent = /<\/?[A-Z][A-Za-z0-9_.:-]*(?:\s|\/?>)/.test(line);
    const hasHtml = /<\/?(?:script|style|iframe|video|audio|div|section|details|summary|table|kbd|sup|sub|span|u|figure|figcaption)\b/i.test(line);
    if (hasComponent || hasHtml) {
      const trimmed = (originalLines[i] || "").trim();
      if (markupOnly(trimmed)) {
        let end = i;
        if (trimmed.startsWith("<") && !trimmed.includes(">")) {
          while (end + 1 < lines.length && !(originalLines[end] || "").includes(">")) end += 1;
        }
        add(i, end, hasComponent ? "MDX component" : "HTML or theme tag", "block");
        i = end;
      } else {
        add(i, i, hasComponent ? "MDX component" : "HTML or theme tag", "paragraph");
      }
    }
  }

  function expandParagraph(start, end) {
    let first = start;
    let last = end;
    while (first > 0 && !blank(lines[first - 1]) && !blank(originalLines[first - 1])) first -= 1;
    while (last + 1 < lines.length && !blank(lines[last + 1]) && !blank(originalLines[last + 1])) last += 1;
    return { start: first, end: last };
  }

  function expandListOrTable(start, end, isTable) {
    let first = start;
    let last = end;
    if (isTable) {
      while (first > 0 && tableRow(lines[first - 1])) first -= 1;
      while (last + 1 < lines.length && tableRow(lines[last + 1])) last += 1;
      return { start: first, end: last };
    }
    const isListLike = (line) => listItem(line) || taskItem(line) || /^[ \t]{2,}\S/.test(line);
    while (first > 0) {
      let prior = first - 1;
      while (prior >= 0 && blank(lines[prior])) prior -= 1;
      if (prior >= 0 && isListLike(lines[prior])) first = prior;
      else break;
    }
    while (last + 1 < lines.length) {
      let next = last + 1;
      while (next < lines.length && blank(lines[next])) next += 1;
      if (next < lines.length && isListLike(lines[next])) last = next;
      else break;
    }
    return { start: first, end: last };
  }

  const expanded = ranges.map((range) => {
    let value = { start: range.start, end: range.end };
    if (range.strategy === "paragraph") {
      value = expandParagraph(value.start, value.end);
      if (tableRow(lines[range.start])) value = expandListOrTable(value.start, value.end, true);
      else if (listItem(lines[range.start]) || taskItem(lines[range.start])) value = expandListOrTable(value.start, value.end, false);
    } else if (range.strategy === "list") {
      value = expandListOrTable(value.start, value.end, false);
    }
    return { ...value, reason: range.reason };
  }).sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const range of expanded) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      previous.reasons.add(range.reason);
    } else {
      merged.push({ start: range.start, end: range.end, reasons: new Set([range.reason]) });
    }
  }
  return merged.map((range) => ({
    start: range.start,
    end: range.end,
    reason: [...range.reasons].join("、"),
  }));
}

export function prepareMarkdownForVisualEditing(markdown) {
  const source = typeof markdown === "string" ? markdown : "";
  const ranges = getProtectedRanges(source);
  if (!ranges.length) return { markdown: source, records: [] };

  const lines = source.split("\n");
  const records = [];
  let output = "";
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    const before = trimEdges(lines.slice(cursor, range.start).join("\n"));
    if (before) output += (output ? "\n\n" : "") + before;
    const raw = lines.slice(range.start, range.end + 1).join("\n");
    let marker = "FIREFLYRAWBLOCK" + records.length + "END";
    while (source.includes(marker) || records.some((record) => record.marker === marker)) marker = "X" + marker + "X";
    records.push({
      marker,
      raw,
      reason: range.reason,
      startLine: range.start + 1,
      endLine: range.end + 1,
    });
    output += (output ? "\n\n" : "") + marker;
    cursor = range.end + 1;
  }
  const after = trimEdges(lines.slice(cursor).join("\n"));
  if (after) output += (output ? "\n\n" : "") + after;
  return { markdown: output, records };
}

export function restoreProtectedMarkdown(markdown, records) {
  let output = typeof markdown === "string" ? markdown : "";
  for (const record of records || []) {
    if (record && typeof record.marker === "string" && typeof record.raw === "string") {
      output = output.split(record.marker).join(record.raw);
    }
  }
  return output;
}
