import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SLASH_ITEMS, filterSlashItems, validateImageSource } from "../public/admin-editor-commands.js";
import { prepareMarkdownForVisualEditing, restoreProtectedMarkdownStrict } from "../public/admin-markdown-guard.js";

const page = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");
const richEditor = readFileSync(new URL("../public/admin-wysiwyg.js", import.meta.url), "utf8");

test("Pages-style searchable commands are complete, distinct, and work in Chinese or English", () => {
  const ids = SLASH_ITEMS.map(item => item.key);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of ["paragraph", "h1", "h2", "bullet", "ordered", "code", "table", "imagePicker", "imageUrl", "callout", "badge"]) {
    assert.ok(ids.includes(id), id + " command");
  }
  assert.deepEqual(filterSlashItems(SLASH_ITEMS,"表格").map(item=>item.key),["table"]);
  assert.deepEqual(filterSlashItems(SLASH_ITEMS,"  IMAGE  ").map(item=>item.key),["imagePicker","imageUrl"]);
  assert.ok(filterSlashItems(SLASH_ITEMS,"提示").some(item=>item.key==="callout"));
  assert.deepEqual(filterSlashItems(SLASH_ITEMS,"不存在的命令"),[]);
  assert.equal(filterSlashItems(SLASH_ITEMS,"").length,SLASH_ITEMS.length);
});

test("image insert validates HTTPS and internal paths, rejecting unsafe Markdown and URL input", () => {
  assert.equal(validateImageSource("  https://images.example.org/cover.webp?size=small  "),"https://images.example.org/cover.webp?size=small");
  assert.equal(validateImageSource("/assets/engineering-view.png"),"/assets/engineering-view.png");
  for (const unsafe of [
    "javascript:alert(1)", "data:image/svg+xml,<svg>", "http://insecure.example/x.png",
    "//evil.example/x.png", "https://user:password@example.com/image.png",
    "/../private.png", "/%2e%2e/private.png", "https://example.com/a(b).png",
    "https://example.com/pic.png\n<iframe>", "https://example.com/a b.png",
    "https://example.com/x.png\\file", "", "https://example.com/" + "x".repeat(2100),
  ]) {
    assert.equal(validateImageSource(unsafe),null,JSON.stringify(unsafe));
  }
});

test("searching/dismissing the command menu does not synthesize or replace Markdown nodes", () => {
  assert.match(richEditor,/function createSlashPalette\(\)/);
  assert.match(richEditor,/input\.addEventListener\("input",render\)/);
  assert.match(richEditor,/event\.key !== "\/"/);
  assert.match(richEditor,/selection\.\$from\.parent\.type\.name !== "paragraph"/);
  assert.match(richEditor,/editor\.state\.selection\.node\?\.type\.name === "protectedMarkdownBlock"/);
  assert.match(richEditor,/const choose = index =>/);
  assert.match(richEditor,/runAction\(item\.key\)/);
  assert.match(richEditor,/window\.addEventListener\("firefly:source-loaded"/);
});

test("image dialog changes the document only on validated submit and uses existing sync guard", () => {
  assert.match(page,/data-editor-action="imageUrl"/);
  assert.match(richEditor,/case "imageUrl": openImageUrlDialog\(\)/);
  assert.match(richEditor,/const url = validateImageSource\(urlInput\.value\)/);
  assert.match(richEditor,/form\.addEventListener\("submit", event =>/);
  assert.match(richEditor,/setImage\(\{ src: url, alt \}\)\.run\(\)/);
  assert.match(richEditor,/restoreProtectedMarkdownStrict\(markdown, records, requiredProtectedMarkers\)/);
  assert.match(richEditor,/reportVisualLoadFailure\(error\)/);
});

test("protected MDX JSX and mathematical formula survive nearby ordinary visual insertions", () => {
  const raw = [
    "第一段普通内容。",
    "",
    "<TabGroup labels={['基础', '进阶']}>",
    "  <TabItem>Markdown</TabItem>",
    "</TabGroup>",
    "",
    "这是公式 $e^{i\\pi}+1=0$。",
    "",
    "最后一段普通正文。",
  ].join("\n");
  const prepared = prepareMarkdownForVisualEditing(raw);
  assert.ok(prepared.records.length >= 2);
  const required = prepared.records.map(item => item.marker);
  assert.equal(restoreProtectedMarkdownStrict(prepared.markdown,prepared.records,required),raw);
  const inserted = prepared.markdown.replace("第一段普通内容。","第一段普通内容。\n\n![示意图](https://example.com/a.png)");
  const restored = restoreProtectedMarkdownStrict(inserted,prepared.records,required);
  assert.ok(restored.includes("<TabGroup labels={['基础', '进阶']}>"));
  assert.ok(restored.includes("这是公式 $e^{i\\pi}+1=0$。"));
  assert.ok(restored.includes("![示意图](https://example.com/a.png)"));
  assert.throws(() => restoreProtectedMarkdownStrict(inserted.replace(required[0],""),prepared.records,required));
});
