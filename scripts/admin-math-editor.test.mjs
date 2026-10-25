import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseEditableMath, serializeEditableMath } from "../public/admin-math-editor.js";
import { prepareMarkdownForVisualEditing, restoreProtectedMarkdownStrict } from "../public/admin-markdown-guard.js";
const editor = readFileSync(new URL("../public/admin-wysiwyg.js",import.meta.url),"utf8");

test("display formulas preserve exact CRLF delimiters and modify only the TeX span", () => {
  const source="$$\r\n\\frac{a}{b}\r\n$$";
  const parsed=parseEditableMath(source,"LaTeX display math");
  assert.equal(parsed.kind,"display");
  assert.equal(serializeEditableMath(parsed, "\\frac{x}{y}"),"$$\r\n\\frac{x}{y}\r\n$$");
  assert.equal(serializeEditableMath(parsed,parsed.tex),source);
});
test("one inline formula can be edited without rewriting nearby prose",()=>{
  const original="欧拉公式 $e^{i\\pi}+1=0$ 是常见例子。";
  const model=parseEditableMath(original,"LaTeX inline math");
  assert.equal(model.kind,"inline");
  assert.equal(serializeEditableMath(model,"x^2 + 1"),"欧拉公式 $x^2 + 1$ 是常见例子。");
  assert.equal(serializeEditableMath(model,model.tex),original);
});
test("reject dynamic MDX/multiple formulas and malformed or oversized TeX",()=>{
  for(const [source,reason] of [
    ["<Component value={2}>$x$</Component>","LaTeX inline math"],
    ["one $x$ two $y$","LaTeX inline math"],
    ["Price $25 is cheap","LaTeX inline math"],
    ["$$\n\n$$","LaTeX display math"],
    ["$$\n$x$$$\n$$","LaTeX display math"],
    ["$$\nX\n$$ and more","LaTeX display math"],
    ["before $x$ after","MDX JS expression"],
  ]) assert.equal(parseEditableMath(source,reason),null,source);
  const inline=parseEditableMath("Before $x$ after","LaTeX inline math");
  assert.throws(()=>serializeEditableMath(inline,"x\ny"),/行内公式/);
  assert.throws(()=>serializeEditableMath(inline,""),/不能为空/);
  assert.throws(()=>serializeEditableMath(inline,"x".repeat(4001)),/4000/);
});
test("math editor remains embedded inside the strict MDX marker restore chain",()=>{
  const source="前言\n\n$$\n\\int_0^1 x^2 dx\n$$\n\n后记\n\n<TabGroup labels={['a']}>\n\n</TabGroup>";
  const p=prepareMarkdownForVisualEditing(source);
  assert.ok(p.records.length>=2);
  const required=p.records.map(x=>x.marker);
  assert.equal(restoreProtectedMarkdownStrict(p.markdown,p.records,required),source);
  const nextRecords=p.records.map(record=>record.raw.startsWith("$$")
    ? {...record,raw:serializeEditableMath(parseEditableMath(record.raw,"LaTeX display math"),"x^2")} : record);
  const restored=restoreProtectedMarkdownStrict(p.markdown,nextRecords,required);
  assert.match(restored,/^\$\$\nx\^2\n\$\$$/m);
  assert.match(restored,/<TabGroup labels=/);
  assert.match(editor,/function openVisualMathEditor/);
  assert.match(editor,/parseEditableMath\(raw, currentNode.attrs.reason/);
  assert.match(editor,/current.attrs.marker!==node.attrs.marker/);
  assert.match(editor,/restoreProtectedMarkdownStrict\(markdown, records, requiredProtectedMarkers\)/);
});
