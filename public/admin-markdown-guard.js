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
    ranges.push({
      start: Math.max(0, start),
      end: Math.min(lines.length - 1, Math.max(start, end)),
      reason,
      strategy,
    });
  };

  // Recognize supported callouts as editable editor nodes; opaque-protect other
  // directives and any callout that contains unknown nested directive syntax.
  const editableCalloutTypes = new Set([
    "tip", "warning", "danger", "info", "success", "note", "important", "caution",
  ]);
  const calloutRanges = [];
  const directiveOpening = /^[ \t]{0,3}:{3,}[ \t]*([A-Za-z][A-Za-z0-9_-]*)(?:\[[^\]\r\n]*\]|[ \t]+[^\r\n]*)?[ \t]*$/;
  const directiveClosing = /^[ \t]{0,3}:{3,}[ \t]*$/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || "";
    const opening = line.match(directiveOpening);
    if (!opening || directiveClosing.test(line)) continue;

    let depth = 1;
    let close = i + 1;
    let unsupportedNested = false;

    for (; close < lines.length; close += 1) {
      const candidate = lines[close] || "";
      if (directiveClosing.test(candidate)) {
        depth -= 1;
        if (depth === 0) break;
      } else {
        const nested = candidate.match(directiveOpening);
        if (nested && !directiveClosing.test(candidate)) {
          depth += 1;
          if (!editableCalloutTypes.has(nested[1].toLowerCase())) {
            unsupportedNested = true;
          }
        }
      }
    }

    const end = close < lines.length ? close : lines.length - 1;
    const isEditableCallout = editableCalloutTypes.has(opening[1].toLowerCase())
      && close < lines.length
      && !unsupportedNested;

    if (isEditableCallout) {
      calloutRanges.push({ start: i, end });
    } else {
      add(i, end, "Theme directive", "block");
    }
    i = end;
  }

  // Keep paired display-math delimiters and the source between them.
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^[ \t]*\$\$[ \t]*\r?$/.test(lines[i] || "")) continue;
    let close = i + 1;
    while (close < lines.length && !/^[ \t]*\$\$[ \t]*\r?$/.test(lines[close] || "")) close += 1;
    const end = close < lines.length ? close : lines.length - 1;
    add(i, end, "LaTeX display math", "block");
    i = end;
  }

  // Preserve complete module declarations, including multiline imports/exports.
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || "";
    if (/^[ \t]*import\b/.test(line)) {
      let end = i;
      while (end + 1 < lines.length && !blank(lines[end + 1])) {
        end += 1;
        const declaration = lines.slice(i, end + 1).join("\n");
        if (/\bfrom[ \t]+["'][^"']+["']/.test(declaration)) break;
      }
      const declaration = lines.slice(i, end + 1).join("\n");
      const realImport = /^[ \t]*import[ \t]+[\s\S]*?\bfrom[ \t]+["'][^"']+["']/.test(declaration)
        || /^[ \t]*import[ \t]+["'][^"']+["']/.test(declaration);
      if (realImport) {
        add(i, end, "MDX import/export", "block");
        i = end;
        continue;
      }
    }
    if (/^[ \t]*export[ \t]+(?:default\b|\*|\{|const\b|let\b|var\b|function\b|class\b|async\b)/.test(line)) {
      let end = i;
      while (end + 1 < lines.length && !blank(lines[end + 1])) end += 1;
      add(i, end, "MDX import/export", "block");
      i = end;
    }
  }

  const lineStarts = [0];
  for (let i = 0; i < masked.length; i += 1) if (masked[i] === "\n") lineStarts.push(i + 1);
  const lineAt = (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= offset) low = mid + 1;
      else high = mid - 1;
    }
    return Math.max(0, high);
  };

  // Recognize complete HTML/MDX elements, including nested instances of the same tag.
  const tagRegex = /<(\/)?([A-Za-z][A-Za-z0-9_.:-]*)\b([^>]*?)>/gs;
  const tags = [];
  for (const match of masked.matchAll(tagRegex)) {
    tags.push({
      closing: Boolean(match[1]),
      name: match[2],
      nameLower: match[2].toLowerCase(),
      selfClosing: !match[1] && /\/[ \t]*$/.test(match[3] || ""),
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      text: match[0],
    });
  }
  const pairedClosing = new Set();
  const voidTags = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  const protectedHtmlTags = new Set(["a","abbr","address","article","aside","audio","b","blockquote","body","br","button","canvas","caption","cite","code","col","colgroup","dd","del","details","dfn","div","dl","dt","em","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","head","header","hr","html","i","iframe","img","input","ins","kbd","label","legend","li","main","map","mark","menu","meter","nav","object","ol","optgroup","option","output","p","picture","pre","progress","q","s","samp","script","section","select","small","source","span","strong","style","sub","summary","sup","svg","path","circle","ellipse","line","polyline","polygon","rect","g","text","table","tbody","td","template","textarea","tfoot","th","thead","time","title","tr","track","u","ul","var","video","wbr"]);
  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    const protectedTag = /^[A-Z]/.test(tag.name) || tag.nameLower.includes("-") || protectedHtmlTags.has(tag.nameLower);
    if (!protectedTag) continue;

    if (tag.closing) {
      if (pairedClosing.has(i)) continue;
      const startLine = lineAt(tag.startOffset);
      const endLine = lineAt(tag.endOffset - 1);
      const inline = startLine === endLine && !markupOnly((originalLines[startLine] || "").trim());
      add(startLine, endLine, /^[A-Z]/.test(tag.name) ? "MDX component" : "HTML or theme tag", inline ? "paragraph" : "block");
      continue;
    }

    let matchedClose = -1;
    if (!tag.selfClosing && !voidTags.has(tag.nameLower)) {
      let depth = 1;
      for (let j = i + 1; j < tags.length; j += 1) {
        if (tags[j].nameLower !== tag.nameLower) continue;
        if (tags[j].closing) depth -= 1;
        else if (!tags[j].selfClosing) depth += 1;
        if (depth === 0) {
          matchedClose = j;
          pairedClosing.add(j);
          break;
        }
      }
    }

    const endTag = matchedClose >= 0 ? tags[matchedClose] : tag;
    const startLine = lineAt(tag.startOffset);
    const endLine = lineAt(endTag.endOffset - 1);
    const inline = startLine === endLine && !markupOnly((originalLines[startLine] || "").trim());
    const reason = /^[A-Z]/.test(tag.name) ? "MDX component" : "HTML or theme tag";
    add(startLine, endLine, reason, inline ? "paragraph" : "block");
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || "";
    if (blank(line)) continue;
    if (/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+\[[ xX]\][ \t]+/.test(line)) {
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

  }

  // MDX evaluates curly-brace expressions even when they contain only a variable.
  // Hide recognized math first so TeX braces are not mistaken for MDX expressions.
  const expressionSource = masked
    .replace(/^[ \t]*\$\$[ \t]*\r?\n[\s\S]*?^[ \t]*\$\$[ \t]*$/gm, match => blankNonNewlines(match))
    .replace(/\$[^$\n]*(?:\\[a-zA-Z]+|[=+*/^_<>≤≥±×÷])[^$\n]*\$/g, match => blankNonNewlines(match));
  // Parse balanced braces outside common string/comment forms and preserve each
  // expression instead of allowing the Markdown parser to interpret its contents.
  for (let i = 0; i < expressionSource.length; i += 1) {
    if (expressionSource[i] !== "{" || isEscapedAt(expressionSource, i)) continue;
    let depth = 1;
    let quote = "";
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    let close = -1;

    for (let j = i + 1; j < expressionSource.length; j += 1) {
      const ch = expressionSource[j];
      const next = expressionSource[j + 1];

      if (lineComment) {
        if (ch === "\n") lineComment = false;
        continue;
      }
      if (blockComment) {
        if (ch === "*" && next === "/") {
          blockComment = false;
          j += 1;
        }
        continue;
      }
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === quote) quote = "";
        continue;
      }
      if (ch === "/" && next === "/") {
        lineComment = true;
        j += 1;
        continue;
      }
      if (ch === "/" && next === "*") {
        blockComment = true;
        j += 1;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === "\x60") {
        quote = ch;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          close = j;
          break;
        }
      }
    }

    if (close < 0) continue;
    const expression = expressionSource.slice(i + 1, close).trim();
    if (!expression) continue;
    const startLine = lineAt(i);
    const endLine = lineAt(close);
    add(startLine, endLine, "MDX expression", startLine === endLine ? "paragraph" : "block");
    i = close;
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

  // If a supported callout contains other Markdown/MDX syntax that the visual
  // editor protects as an opaque block, keep the entire callout opaque too.
  // This avoids relocating markers outside their container or changing nesting.
  for (const callout of calloutRanges) {
    const containsProtectedSyntax = ranges.some((range) =>
      range.start <= callout.end && range.end >= callout.start
    );
    if (containsProtectedSyntax) {
      add(callout.start, callout.end, "Callout with extended Markdown/MDX", "block");
    }
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
