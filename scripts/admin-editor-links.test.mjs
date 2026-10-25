import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateEditorLink } from "../public/admin-editor-links.js";
const editor=readFileSync(new URL("../public/admin-wysiwyg.js", import.meta.url),"utf8");

test("ordinary secure web links and mail links pass without normalization",()=>{
  assert.equal(validateEditorLink(" https://example.org/a?b=c#section "),"https://example.org/a?b=c#section");
  assert.equal(validateEditorLink("http://example.org/lesson"),"http://example.org/lesson");
  assert.equal(validateEditorLink("mailto:hello@example.org"),"mailto:hello@example.org");
});
test("malicious or malformed text links are rejected",()=>{
  for(const unsafe of [
    "javascript:alert(1)","data:text/html,<h1>hi</h1>","//another.example.org/",
    "/relative/path","https://user:secret@example.org/", "file:///etc/passwd",
    "https://example.org/a b", "https://example.org/\nscript", "mailto:not-an-email",
    "ftp://example.org","https://example.org/<script>", "", "https://example.org/"+"x".repeat(2050)
  ]) assert.equal(validateEditorLink(unsafe),null,unsafe);
});
test("visual link edit does not apply a mark before explicit validated submit",()=>{
  assert.match(editor,/function openVisualLinkDialog\(\)/);
  assert.match(editor,/case "link": openVisualLinkDialog\(\); return/);
  assert.match(editor,/const originalDoc = editor.state.doc/);
  assert.match(editor,/const href=validateEditorLink\(field.value\)/);
  assert.match(editor,/if\(!editor.state.doc.eq\(originalDoc\)\)/);
  assert.match(editor,/setTextSelection\(\{from,to\}\)/);
  assert.match(editor,/extendMarkRange\("link"\)/);
  assert.match(editor,/setLink\(\{href\}\)/);
  assert.match(editor,/restoreProtectedMarkdownStrict\(markdown, records, requiredProtectedMarkers\)/);
});
