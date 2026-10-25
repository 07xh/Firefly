import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateVisualImageAttributes, matchesOriginalImage } from "../public/admin-image-properties.js";
import { prepareMarkdownForVisualEditing, restoreProtectedMarkdownStrict } from "../public/admin-markdown-guard.js";

const editor=readFileSync(new URL("../public/admin-wysiwyg.js",import.meta.url),"utf8");

test("existing image metadata supports safe image host and alt/title fields",()=>{
  const result=validateVisualImageAttributes({
    src:"  https://tu.0701000.xyz/posts/scheme.webp ",
    alt:"三视图对应关系",
    title:"第一角法",
  });
  assert.deepEqual(result,{
    ok:true,attrs:{src:"https://tu.0701000.xyz/posts/scheme.webp",alt:"三视图对应关系",title:"第一角法"},
  });
  assert.equal(validateVisualImageAttributes({src:"/assets/images/a.png",alt:"",title:""}).ok,true);
});
test("existing image metadata rejects Markdown-ambiguous and unsafe input",()=>{
  for(const src of ["javascript:alert(1)","http://unsafe.example/a.png","//malicious.test/x.png","../secret.png","https://example.com/a(b).png"]) {
    assert.equal(validateVisualImageAttributes({src}).ok,false,src);
  }
  for(const alt of ["a\nb","[link]","a\\b","\0","z".repeat(161)]) {
    assert.equal(validateVisualImageAttributes({src:"/safe.png",alt}).ok,false,alt);
  }
  for(const title of ['my" title',"unsafe\\title","unsafe\nline","a".repeat(161)]) {
    assert.equal(validateVisualImageAttributes({src:"/safe.png",title}).ok,false,title);
  }
});
test("image edit is bound to the original image node and position",()=>{
  const original={src:"https://example.com/a.webp",alt:"alt",title:"title"};
  const node={type:{name:"image"},attrs:original};
  assert.equal(matchesOriginalImage(node,original),true);
  assert.equal(matchesOriginalImage({type:{name:"image"},attrs:{...original,alt:"changed"}},original),false);
  assert.equal(matchesOriginalImage({type:{name:"paragraph"},attrs:original},original),false);
  assert.equal(matchesOriginalImage(null,original),false);
});
test("image preview exposes edit action only for editor images and applies changes on confirmation",()=>{
  assert.match(editor,/function openImagePreview\(src, alt = "", title = "", imagePosition = null\)/);
  assert.match(editor,/const node = Number\.isInteger\(imagePosition\)/);
  assert.match(editor,/edit\.hidden = !snapshot/);
  assert.match(editor,/openVisualImageProperties\(imagePosition, snapshot, originalDoc\)/);
  assert.match(editor,/function openVisualImageProperties\(position, originalAttrs, originalDoc\)/);
  assert.match(editor,/form\.addEventListener\("submit",event =>/);
  assert.match(editor,/!editor\.state\.doc\.eq\(originalDoc\) \|\| !matchesOriginalImage\(current, originalAttrs\)/);
  assert.match(editor,/setNodeMarkup\(position, undefined, \{\.\.\.current\.attrs,\.\.\.checked\.attrs\}\)/);
  assert.match(editor,/restoreProtectedMarkdownStrict\(markdown, records, requiredProtectedMarkers\)/);
});
test("protected MDX formulas survive adjacent image metadata work unchanged",()=>{
  const raw=["正文。","","![旧说明](https://example.com/a.png)","","$e^{i\\pi}+1=0$","","<Tabs data={foo} />"].join("\n");
  const prep=prepareMarkdownForVisualEditing(raw);
  assert.ok(prep.records.length>=2);
  assert.equal(restoreProtectedMarkdownStrict(prep.markdown,prep.records,prep.records.map(x=>x.marker)),raw);
});
