import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [experience, endpoint, styles] = await Promise.all([
  readFile(new URL("src/scripts/space-experience.ts", root), "utf8"),
  readFile(new URL("src/pages/api/space-projects.ts", root), "utf8"),
  readFile(new URL("src/styles/space.css", root), "utf8"),
]);

test("public showcase does not bundle copy for private repositories", () => {
  assert.doesNotMatch(experience, /campus-toolkit|ncwu-qiangke/);
});

test("WordFlow copy describes the shipped offline vocabulary app", () => {
  assert.match(experience, /ANDROID \/ VOCABULARY/);
  assert.match(experience, /SQLite/);
  assert.match(experience, /通知背词/);
  assert.match(experience, /完整 JSON 备份恢复/);
});

test("project copy preserves explicit integration and verification limits", () => {
  assert.match(experience, /服务器已核验进度/);
  assert.match(experience, /私有写回协议仍缺少完整请求与服务器回读证据/);
  assert.match(experience, /在线提交门禁关闭/);
  assert.match(experience, /不是原始 TCP\/IP 抓包镜像/);
});

test("project scenes show repository stars and explicit project stage", () => {
  assert.match(experience, /copy\.status/);
  assert.match(experience, /repo\.stars/);
  assert.match(experience, /GitHub Stars/);
  assert.match(experience, /repo\.url \+ "#readme"/);
});

test("project navigation supports browser history and cancels interrupted swipes", () => {
  assert.match(experience, /history\.pushState/);
  assert.match(experience, /addEventListener\("popstate"/);
  assert.match(experience, /addEventListener\("touchcancel"/);
  assert.match(experience, /target\.closest\("a, button, input/);
});

test("public endpoint fails closed for non-public or foreign repositories", () => {
  assert.match(endpoint, /repo\.private !== false/);
  assert.match(endpoint, /repo\.visibility !== "public"/);
  assert.match(endpoint, /repo\.owner\?\.login/);
  assert.match(endpoint, /HIDDEN_REPOSITORIES/);
  assert.match(endpoint, /public_repositories_unavailable/);
});

test("tablet navigation and reduced-motion layout are covered", () => {
  assert.match(styles, /@media \(max-width:900px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /max-height:720px/);
});

test("site navigation separates the main destinations and identifies the owner's GitHub", async () => {
  const navigation = await readFile(new URL("src/config/navBarConfig.ts", root), "utf8");
  assert.match(navigation, /name: "博客"/);
  assert.match(navigation, /name: "项目档案"/);
  assert.match(navigation, /name: "知识专题"/);
  assert.match(navigation, /name: "我的 GitHub"/);
  assert.match(navigation, /https:\/\/github\.com\/07xh/);
  assert.match(navigation, /Firefly 模板源码/);
});

test("project archive hides its documentation template and includes the real featured projects", async () => {
  const example = await readFile(new URL("src/content/projects/example-project.md", root), "utf8");
  assert.match(example, /draft: true/);
  const projectFiles = [
    "dorm-os.md", "draftai.md", "studyflow.md", "momoflow.md",
    "wordflow.md", "reqable-bridge.md", "kingo-assistant.md",
    "zhidao-assistant.md", "firefly.md",
  ];
  const docs = await Promise.all(projectFiles.map((name) =>
    readFile(new URL("src/content/projects/" + name, root), "utf8")
  ));
  assert.equal(docs.length, 9);
  assert.ok(docs.every((doc) => /title:/.test(doc) && /description:/.test(doc)));
  const site = docs.find((doc) => doc.includes("07xh Space · 个人数字空间"));
  assert.ok(site);
  assert.match(site, /上游模板/);
  assert.match(site, /尚未合并到主分支/);
});

test("homepage exposes the curated project archive separately from the live project index", async () => {
  const homepage = await readFile(new URL("src/pages/index.astro", root), "utf8");
  assert.match(homepage, /data-open-index>项目索引/);
  assert.match(homepage, /href="\/projects\/">项目档案/);
  assert.match(homepage, /index-footer"><a href="\/projects\/">项目档案/);
});

test("blog and project archive pages cross-link the main content areas", async () => {
  const [blogPage, projectPage] = await Promise.all([
    readFile(new URL("src/pages/blog/index.astro", root), "utf8"),
    readFile(new URL("src/pages/projects/index.astro", root), "utf8"),
  ]);
  assert.match(blogPage, /href="\/projects\/"[^>]*>项目档案/);
  assert.match(projectPage, /首页的项目索引/);
  assert.match(projectPage, /href="\/"[^>]*>返回 07xh Space/);
});
