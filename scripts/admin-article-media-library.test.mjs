import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectArticleMedia, filterArticleMedia } from "../public/admin-article-media-library.js";

const page = readFileSync(new URL("../src/pages/admin/index.astro",import.meta.url),"utf8");
const library = readFileSync(new URL("../public/admin-article-media-library.js",import.meta.url),"utf8");

test("article image gallery deduplicates cover, Markdown and literal HTML images",()=>{
  const first = [
    "---",
    'image: "https://cdn.example.org/cover.webp"',
    "---",
    "# Article one",
    "![平面三视图](https://cdn.example.org/diagram.png)",
    '<img src="/assets/images/figure.png" alt="立体图" />',
  ].join("\n");
  const second=[
    "---",
    "title: Second",
    "---",
    "![重用](https://cdn.example.org/diagram.png)",
    "![重复](https://cdn.example.org/diagram.png)",
  ].join("\n");
  const got=collectArticleMedia([
    {path:"src/content/posts/one.md",title:"第一篇",content:first},
    {path:"src/content/posts/two.md",title:"第二篇",content:second},
  ]);
  assert.equal(got.length,3);
  assert.deepEqual(got.map(item=>item.kind),["cover","markdown","html"]);
  const shared=got.find(item=>item.src==="https://cdn.example.org/diagram.png");
  assert.equal(shared.alt,"平面三视图");
  assert.deepEqual(shared.sources.map(x=>x.title),["第一篇","第二篇"]);
  assert.equal(filterArticleMedia(got,"第二篇").length,1);
  assert.equal(filterArticleMedia(got,"  立体图 ").length,1);
  assert.equal(filterArticleMedia(got,"none").length,0);
});

test("gallery ignores backtick samples, fenced code and unsafe image URLs",()=>{
  const raw=[
    "---",
    "image: javascript:alert(1)",
    "---",
    "请看示例： \x60![示例](https://cdn.example.org/inline-code.png)\x60",
    "",
    "\x60\x60\x60md",
    "![示例](https://cdn.example.org/fenced-code.png)",
    '<img src="https://cdn.example.org/fenced-html.png">',
    "\x60\x60\x60",
    "",
    "\\![转义示例](https://cdn.example.org/escaped.png)",
    "![危险](http://insecure.example.org/p.png)",
    "![危险2](//external.test/p.png)",
    "![有效](/uploads/real.png)",
    "<img src={dynamicUrl} alt='dynamic'/>",
  ].join("\n");
  const got=collectArticleMedia([{path:"src/content/posts/learn.md",title:"教程",content:raw}]);
  assert.deepEqual(got.map(item=>item.src),["/uploads/real.png"]);
});

test("gallery uses data-only rendering, existing admin article state, and no direct image deletion",()=>{
  assert.match(page,/id="adminMediaLibrary"/);
  assert.match(page,/admin-article-media-library\.js\?v=20261026-article-gallery/);
  assert.match(library,/const state=window\.FireflyAdminContent/);
  assert.match(library,/window\.addEventListener\("firefly:articles-refreshed",refresh\)/);
  assert.match(library,/copyUrl\(item\.src\)/);
  assert.match(library,/input\.dispatchEvent\(new Event\("input",\{bubbles:true\}\)\)/);
  assert.match(library,/document\.getElementById\("tabEditor"\)\?\.click\(\)/);
  assert.doesNotMatch(library,/\bfetch\s*\(/);
  assert.doesNotMatch(library,/\/api\/admin\/delete/);
  assert.match(library,/textContent=item\.alt/);
});

test("media extraction handles empty and malformed articles conservatively",()=>{
  assert.deepEqual(collectArticleMedia(null),[]);
  assert.deepEqual(collectArticleMedia([{title:"missing content"}]),[]);
  assert.deepEqual(filterArticleMedia([], "a"),[]);
});
