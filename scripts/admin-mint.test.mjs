import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("src/pages/admin/index.astro",root),"utf8");
const css=readFileSync(new URL("public/admin-mint.css",root),"utf8");
const views=["overview","articles","editor","media","appearance","site","ai","system"];
const ids=["tabOverview","tabArticles","tabEditor","tabMedia","tabAppearance","tabSite","tabAiProviders","tabSystem"];
test("eight management views have real navigation buttons",()=>{
 for(const id of ids)assert.match(html,new RegExp('id="'+id+'"'));
 for(const view of views)assert.ok(html.includes('["'+view+'",'));
 for(const panel of ["overviewTabPanel","articlesTabPanel","appearanceTabPanel","aiProvidersTabPanel","mediaTabPanel","systemTabPanel"])assert.match(html,new RegExp('id="'+panel+'"'));
 assert.match(html,/function setAdminTab\(tab\)/);
 assert.match(html,/setAdminTab\("overview"\)/);
 assert.match(html,/setAdminTab\("editor"\)/);
});
test("existing article editor and forms are not replaced",()=>{
 for(const id of ["editor","body","new","list","refresh","saveDraft","publish","delete","settingsForm","saveSettings","aiProviderForm","aiProviderSave","wysiwygPane"])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/isArticleDirty\(\)/);
 assert.match(html,/function updateDashboard\(\)/);
 assert.match(html,/articles=await api\("GET"\);render\(\);updateDashboard\(\)/);
});
test("settings share a single form but show appropriate groups",()=>{
 assert.equal((html.match(/data-admin-group="appearance"/g)||[]).length,3);
 assert.equal((html.match(/data-admin-group="site"/g)||[]).length,3);
 assert.match(css,/data-admin-view="appearance"/);
 assert.match(css,/data-admin-view="site"/);
});
test("media and system views disclose incomplete integrations",()=>{
 assert.match(html,/图床图片库的搜索、删除和后台直连仍需单独验收/);
 assert.match(html,/实时运行状态尚未接入监控 API/);
});
test("mint design is admin only and offers persisted color choices",()=>{
 assert.match(html,/href="\/admin-mint\.css\?v=/);
 for(const theme of ["mint","sky","lavender","custom"])assert.match(html,new RegExp('value="'+theme+'"'));
 assert.match(html,/adminThemeStorageKey/);
 assert.match(css,/data-admin-theme="sky"/);
 assert.match(css,/data-admin-theme="lavender"/);
 assert.match(css,/--admin-current-accent/);
 const selectors=css.split("\n").filter(line=>line.trim().endsWith("{")&&!line.trim().startsWith("@")&&!line.trim().startsWith("/*"));
 for(const selector of selectors)assert.ok(selector.includes(".admin-workspace")||selector.includes("body.admin-workspace"),selector);
});

test("recent article preview safely delegates to existing editor and handles missing data", () => {
 assert.match(html, /id="dashboardRecentList"/);
 assert.match(html, /function openRecentArticle\(path\)/);
 assert.match(html, /row\.dataset\.adminArticlePath=a\.path/);
 assert.match(html, /button\.click\(\)/);
 assert.match(html, /isArticleDirty\(\)/);
 assert.match(html, /recent\.replaceChildren\(\)/);
 assert.match(html, /title\.textContent=article\.title/);
 assert.match(html, /articles\.slice\(0,5\)/);
 assert.match(css, /\.admin-workspace \.admin-recent-button/);
});

test("read-only system status regression suite runs in existing admin CI", () => {
 const result=spawnSync(process.execPath, [
  "--experimental-strip-types", "--test", "scripts/admin-system-health.test.mjs",
 ], { cwd:fileURLToPath(root),encoding:"utf8" });
 assert.equal(result.status,0,(result.stdout||"")+(result.stderr||""));
});
