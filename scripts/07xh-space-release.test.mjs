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
test("project showcase uses cyclic scene navigation and full-screen preview", async () => {
  const css = await readFile(new URL("src/styles/space-project-showcase.css", root), "utf8");
  assert.match(project, /ordered\[\(index - 1 \+ ordered\.length\) % ordered\.length\]/);
  assert.match(project, /ordered\[\(index \+ 1\) % ordered\.length\]/);
  assert.match(project, /data-previous/);
  assert.match(project, /data-next/);
  assert.match(project, /space-project-hero/);
  assert.match(project, /space-project-image-wrap/);
  assert.match(project, /space-project-placeholder/);
  assert.match(project, /id="project-details"/);
  assert.match(project, /data-pagefind-body/);
  assert.match(css, /\.space-project-switch\s*\{\s*position: fixed;/);
  assert.match(css, /inset: 50% 0 auto/);
  assert.match(css, /grid-template-columns: minmax\(0, 0\.88fr\) minmax\(0, 1\.12fr\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("site uses a single coherent rocket mark and a light spaceship illustration", async () => {
  const [mark, craft, css] = await Promise.all([
    readFile(new URL("public/brand/07xh-mark.svg", root), "utf8"),
    readFile(new URL("public/brand/07xh-ship-refined.svg", root), "utf8"),
    readFile(new URL("src/styles/space-airy.css", root), "utf8"),
  ]);
  assert.match(mark, /<svg/);
  assert.match(mark, /07xh Space 飞船标识/);
  assert.match(craft, /轻盈飞船/);
  assert.match(craft, /<path/);
  assert.match(home, /src=\{url\("\/brand\/07xh-ship-refined\.svg"\)\}/);
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

test("hero art is bounded at desktop, tablet and mobile sizes", async () => {
  const style = await readFile(new URL("src/styles/space-airy.css", root), "utf8");
  const ship = await readFile(new URL("public/brand/07xh-ship-refined.svg", root), "utf8");
  assert.match(style, /width:min\(100%,570px\); max-width:570px/);
  assert.match(style, /\.space-home-art img \{\s*display:block; width:100%; max-width:100%/);
  assert.doesNotMatch(style, /width:120%;/);
  assert.doesNotMatch(style, /width:min\(111%/);
  assert.match(style, /space-home-hero::after \{ display:none; \}/);
  assert.match(ship, /比例修正版/);
  assert.match(ship, /rx="296" ry="104"/);
});
