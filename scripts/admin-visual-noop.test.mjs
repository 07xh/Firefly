import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseEditableMath, serializeEditableMath } from "../public/admin-math-editor.js";
import { validateVisualImageAttributes } from "../public/admin-image-properties.js";

const source=readFileSync(new URL("../public/admin-wysiwyg.js",import.meta.url),"utf8");

test("applying unchanged image properties must skip setNodeMarkup entirely",()=>{
  const start=source.indexOf("function openVisualImageProperties(");
  const end=source.indexOf("const markdownPreviewElement =",start);
  const dialog=source.slice(start,end);
  assert.match(dialog,/checked\.attrs\.src === originalAttrs\.src/);
  assert.match(dialog,/checked\.attrs\.alt === \(originalAttrs\.alt \|\| ""\)/);
  assert.match(dialog,/checked\.attrs\.title === \(originalAttrs\.title \|\| ""\)/);
  assert.ok(dialog.indexOf('status("图片信息未变化') < dialog.indexOf("setNodeMarkup(position"));
  const checked=validateVisualImageAttributes({src:"https://example.com/photo.png",alt:"图片说明",title:""});
  assert.equal(checked.ok,true);
});

test("unchanged TeX roundtrips but editor explicitly avoids dispatching a transaction",()=>{
  for (const [input,reason] of [
    ["$$\n\\frac{a}{b}\n$$","LaTeX display math"],
    ["左边 $x^2$ 右边","LaTeX inline math"],
  ]) {
    const parsed=parseEditableMath(input,reason);
    assert.equal(serializeEditableMath(parsed,parsed.tex),input);
  }
  assert.match(source,/if \(raw === current\.attrs\.raw\) \{\s*close\(\);\s*status\("公式未变化/);
});

test("unchanged link URLs are not rewritten into the document",()=>{
  assert.match(source,/if \(hasExistingLink && href === editor\.getAttributes\("link"\)\.href\)/);
  const a=source.indexOf('if (hasExistingLink && href === editor.getAttributes("link").href)');
  const b=source.indexOf('.setLink({href})',a);
  assert.ok(a>=0 && b>a);
  assert.match(source,/status\("链接未变化，原始 Markdown 保持不变。"\)/);
});

test("all no-op guards run after stale-document checks",()=>{
  const img=source.slice(source.indexOf("function openVisualImageProperties("),source.indexOf("const markdownPreviewElement"));
  assert.ok(img.indexOf("!editor.state.doc.eq(originalDoc)")<img.indexOf("checked.attrs.src === originalAttrs.src"));
  const math=source.slice(source.indexOf("function openVisualMathEditor("),source.indexOf("function visualPreviewElement("));
  assert.ok(math.indexOf('current.attrs.marker!==node.attrs.marker')<math.indexOf('raw === current.attrs.raw'));
});
