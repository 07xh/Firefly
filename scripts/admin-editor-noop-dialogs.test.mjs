import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editor=readFileSync(new URL("../public/admin-wysiwyg.js",import.meta.url),"utf8");

test("canceling any visual insert dialog does not trigger Markdown serialization",()=>{
  const runAction=editor.slice(editor.indexOf("  function runAction(action) {"),editor.indexOf("  // Accessible visual link editing"));
  assert.ok(runAction.startsWith("  function runAction(action) {"));
  assert.match(runAction,/case "link": openVisualLinkDialog\(\); return;/);
  assert.match(runAction,/case "table":\s+openTableInsertDialog\(\);\s+return;/);
  assert.match(runAction,/case "imagePicker": \$\("wysiwygFile"\)\?\.click\(\); return;/);
  assert.match(runAction,/case "imageUrl": openImageUrlDialog\(\); return;/);
  assert.match(runAction,/syncSourceFromEditor\(\);/);
});

test("editor toolbar buttons do not steal the ProseMirror text selection on mousedown",()=>{
  assert.match(editor,/document\.querySelectorAll\("\[data-editor-action\]"\)\.forEach\(button => \{/);
  const tail=editor.slice(editor.lastIndexOf('document.querySelectorAll("[data-editor-action]").forEach(button => {'));
  assert.match(tail,/button\.addEventListener\("mousedown", event => \{\s*\/\/ Pages CMS-style/);
  assert.match(tail,/if \(event\.button === 0\) event\.preventDefault\(\);/);
  assert.match(tail,/button\.addEventListener\("click", \(\) => runAction/);
});

test("visual image and table dialogs apply only after explicit confirm",()=>{
  assert.match(editor,/form\.addEventListener\("submit", event => \{\s*event\.preventDefault\(\);\s*const url = validateImageSource/);
  assert.match(editor,/save\.addEventListener\("click", \(\) => \{/);
  assert.match(editor,/const inserted = editor\.chain\(\)\.focus\(\)\.setImage/);
  assert.match(editor,/const loadedVisually = loadSourceIntoEditor\(\)/);
  assert.match(editor,/restoreProtectedMarkdownStrict\(markdown, records, requiredProtectedMarkers\)/);
});
