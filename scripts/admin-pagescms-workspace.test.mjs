import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { appendTag, categoryFromArticle, historyUrl, tagsFromArticle, validArticlePath } from "../public/admin-pagescms-workspace.js";

const root = new URL("../", import.meta.url);
const page = readFileSync(new URL("src/pages/admin/index.astro", root),"utf8");
const api = readFileSync(new URL("src/pages/api/admin/articles.ts", root),"utf8");
const editor = readFileSync(new URL("public/admin-wysiwyg.js", root),"utf8");
const legacy = readFileSync(new URL("public/admin/articles.html", root),"utf8");
const newEntry = readFileSync(new URL("src/pages/admin/new.astro", root),"utf8");
const config = readFileSync(new URL(".pages.yml", root),"utf8");

test("Pages CMS-inspired collection metadata accepts JSON list and plain legacy tags", () => {
  assert.deepEqual(tagsFromArticle({content:'---\ntags: ["Python", "工程制图"]\n---\n'}), ["Python","工程制图"]);
  assert.deepEqual(tagsFromArticle({content:'tags: Python, 工程制图'}),["Python","工程制图"]);
  assert.deepEqual(tagsFromArticle({tags:[" A ","B"]}),["A","B"]);
  assert.equal(categoryFromArticle({content:'category: "Python"'}),"Python");
  assert.equal(categoryFromArticle({category:" 工程制图 "}),"工程制图");
});

test("tag helper deduplicates and never exceeds 20 metadata entries", () => {
  assert.equal(appendTag("Python, 技术", "python"),"Python, 技术");
  assert.equal(appendTag("Python", "数学"),"Python, 数学");
  assert.equal(appendTag(Array.from({length:20},(_,i)=>"tag"+i).join(","), "extra").split(",").length,20);
});

test("history link uses a validated repository article path", () => {
  assert.ok(validArticlePath("src/content/posts/工程制图.md"));
  assert.equal(validArticlePath("src/content/posts/../secret.md"),false);
  assert.equal(historyUrl("/etc/passwd"),"");
  assert.equal(historyUrl("src/content/posts/x.md"),"https://github.com/07xh/Firefly/commits/master/src/content/posts/x.md");
});

test("canonical admin owns the editor, metadata and article actions", () => {
  assert.match(page,/id="image"/);
  assert.match(page,/image: \$\("image"\)\.value\.trim\(\)/);
  assert.match(page,/window\.FireflyAdminContent/);
  assert.match(page,/firefly:articles-refreshed/);
  assert.match(page,/admin-pagescms-workspace\.js/);
  assert.match(legacy,/\/admin\/\?view=articles/);
  assert.match(newEntry,/Astro\.redirect\("\/admin\/\?view=new"/);
  assert.match(api,/function isSafeCoverImage/);
  assert.match(api,/content = image \? updateFrontmatterField\(content, "image"/);
});

test("slash palette retains existing protected syntax serialization", () => {
  assert.match(editor,/function createSlashPalette\(\)/);
  assert.match(editor,/event\.key !== "\/"/);
  assert.match(editor,/createSlashPalette\(\);/);
  assert.match(editor,/restoreProtectedMarkdownStrict/);
});

test("Pages CMS pilot defaults are non-destructive and preserve unknown frontmatter keys", () => {
  assert.match(config,/path: src\/content\/posts/);
  assert.match(config,/merge: true/);
  assert.match(config,/rename: false/);
  assert.match(config,/delete: false/);
  assert.match(config,/type: code/);
});
