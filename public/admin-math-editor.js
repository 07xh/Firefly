// Data-only, strictly scoped math editing for Firefly protected Markdown blocks.
// The original raw is authoritative; only the one identified TeX expression changes.
const MAX_TEX_LENGTH = 4000;

export function parseEditableMath(raw, reason = "") {
  if (typeof raw !== "string" || raw.length > 12000 || raw.includes("\0")) return null;
  // Whole-block TeX only. Preserve original CRLF and exterior whitespace verbatim.
  const display = raw.match(/^(\$\$\r?\n)([\s\S]*?)(\r?\n\$\$)$/);
  if (display) {
    if (!display[2].trim() || display[2].length > MAX_TEX_LENGTH || display[2].includes("$$")) return null;
    return { kind: "display", prefix: display[1], tex: display[2], suffix: display[3] };
  }
  if (!/latex.*inline math/i.test(String(reason))) return null;
  // Protect only paragraphs with exactly one unescaped $...$ pair. Escaped
  // dollar signs, second formulas and multiline cases keep the raw editor.
  const marks = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "$") continue;
    let escapes = 0;
    for (let j = i - 1; j >= 0 && raw[j] === "\\"; j--) escapes++;
    if (escapes % 2 === 0) marks.push(i);
  }
  if (marks.length !== 2) return null;
  const [start,end] = marks;
  const tex = raw.slice(start + 1,end);
  if (!tex.trim() || tex.length > MAX_TEX_LENGTH || /[\r\n$]/.test(tex)) return null;
  const before = raw.slice(0,start), after = raw.slice(end + 1);
  // TeX parser ambiguity: don't edit a paragraph containing Markdown spans
  // or MDX expressions outside the formula. Preserve those with raw editor.
  if (/[<>{}\x60]/.test(before + after)) return null;
  return { kind: "inline", prefix: before + "$", tex, suffix: "$" + after };
}

export function serializeEditableMath(model, nextTex) {
  if (!model || !["display","inline"].includes(model.kind)) throw new Error("公式类型无效");
  const tex = typeof nextTex === "string" ? nextTex : "";
  if (!tex.trim() || tex.length > MAX_TEX_LENGTH || tex.includes("\0")) throw new Error("公式不能为空或超过 4000 字符");
  if (model.kind === "inline" && /[\r\n$]/.test(tex)) throw new Error("行内公式不允许换行或包含未转义的 $ 符号");
  if (model.kind === "display" && tex.includes("$$")) throw new Error("块级公式内部不能包含 $$ 分隔符");
  if (typeof model.prefix !== "string" || typeof model.suffix !== "string") throw new Error("公式边界无效");
  return model.prefix + tex + model.suffix;
}
