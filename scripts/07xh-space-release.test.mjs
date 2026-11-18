import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const paths = ["src/config/siteConfig.ts", "src/pages/index.astro", "src/pages/projects/[slug].astro", "src/layouts/PortfolioLayout.astro", "src/data/settings.json"];
const [site, home, project, layout, settings] = await Promise.all(paths.map(p => readFile(new URL(p, root), "utf8")));

test("website identity is 07xh Space, not the former blog template", () => {
  assert.match(site, /title: "07xh Space"/);
  assert.match(site, /subtitle: "小慌的个人数字空间"/);
  assert.doesNotMatch(site, /title: "Firefly Blog"/);
  assert.match(site, /favicon\/07xh-space-64\.png/);
  assert.equal(JSON.parse(settings).bannerTitle, "07xh Space");
  assert.match(layout, /\{siteConfig.title\}/);
});
test("homepage introduces only the site and supports horizontal gesture into the first project", () => {
  assert.match(home, /<h1 id="home-title">07xh Space<\/h1>/);
  assert.match(home, /data-next-project/);
  assert.match(home, /addEventListener\("pointerdown"/);
  assert.match(home, /addEventListener\("pointercancel"/);
  assert.match(home, /addEventListener\("wheel"/);
  assert.match(home, /ArrowRight/);
  assert.match(home, /Math.abs\(dx\) > Math.abs\(dy\)/);
});
test("first project can swipe back to the site introduction and other project pages remain connected", () => {
  assert.match(project, /position === 1/);
  assert.match(project, /data-previous rel="prev" aria-label="返回 07xh Space"/);
  assert.match(project, /data-next rel="next"/);
});
