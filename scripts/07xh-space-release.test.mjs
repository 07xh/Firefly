import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const paths = ["src/config/siteConfig.ts", "src/pages/index.astro", "src/pages/projects/[slug].astro", "src/layouts/PortfolioLayout.astro", "src/data/settings.json"];
const [site, home, project, layout, settings] = await Promise.all(paths.map(p => readFile(new URL(p, root), "utf8")));

test("website identity is 07xh Space, not the former blog template", () => {
  assert.match(site, /title: "07xh Space"/);
  assert.match(site, /07xh Space 是小慌的个人数字空间/);
  assert.doesNotMatch(site, /title: "Firefly Blog"/);
  assert.match(site, /\/brand\/07xh-mark\.svg/);
  assert.equal(JSON.parse(settings).bannerTitle, "07xh Space");
  assert.match(layout, /\{siteConfig.title\}/);
});
test("homepage introduces only the site and supports horizontal gesture into the first project", () => {
  assert.match(home, /<h1 id="home-title" class="space-home-title"><span>07xh<\/span> <em>Space<\/em>/);
  assert.match(home, /class="space-home-lead"/);
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

test("site uses a single coherent rocket mark and a light spaceship illustration", async () => {
  const [mark, craft, css] = await Promise.all([
    readFile(new URL("public/brand/07xh-mark.svg", root), "utf8"),
    readFile(new URL("public/brand/07xh-ship.svg", root), "utf8"),
    readFile(new URL("src/styles/space-airy.css", root), "utf8"),
  ]);
  assert.match(mark, /<svg/);
  assert.match(mark, /07xh Space 飞船标识/);
  assert.match(craft, /轻盈飞船/);
  assert.match(craft, /<path/);
  assert.match(home, /src=\{url\("\/brand\/07xh-ship\.svg"\)\}/);
  assert.match(layout, /src=\{url\("\/brand\/07xh-mark\.svg"\)\}/);
  assert.match(layout, /styles\/space-airy\.css/);
  assert.match(css, /--pf-accent: #2b61df/);
  assert.match(css, /\.portfolio--space-home/);
  assert.match(css, /@media \(max-width:720px\)/);
});
test("navigation and links remain real and independent", () => {
  assert.match(home, /href=\{url\("\/posts\/"\)\}/);
  assert.match(home, /https:\/\/github\.com\/07xh/);
  assert.match(layout, /path: "\/topics\/",\s*icon:/);
  assert.match(layout, /data-theme-toggle/);
  assert.match(layout, /data-menu-toggle/);
});
