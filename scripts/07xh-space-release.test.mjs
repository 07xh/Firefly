import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
async function source(path) {
	return readFile(new URL(path, root), "utf8");
}

test("website identity and branding stay 07xh Space", async () => {
	const [site, layout, settings] = await Promise.all([
		source("src/config/siteConfig.ts"),
		source("src/layouts/PortfolioLayout.astro"),
		source("src/data/settings.json"),
	]);
	assert.match(site, /title: "07xh Space"/);
	assert.match(site, /这里放着我做的软件/);
	assert.doesNotMatch(site, /技术实践、学习专题与开发记录/);
	assert.equal(JSON.parse(settings).bannerSubtitle, "软件项目和学习笔记");
	assert.doesNotMatch(site, /title: "Firefly Blog"/);
	assert.match(site, /\/brand\/07xh-mark\.svg/);
	assert.equal(JSON.parse(settings).bannerTitle, "07xh Space");
	assert.match(layout, /\{siteConfig.title\}/);
	assert.match(layout, /data-theme-toggle/);
	assert.match(layout, /data-menu-toggle/);
	assert.match(layout, /path: "\/topics\/",\s*icon:/);
});

test("the first visit and Projects entry both render the actual first project", async () => {
	const [home, projects, landing, config] = await Promise.all([
		source("src/pages/index.astro"),
		source("src/pages/projects/index.astro"),
		source("src/components/portfolio/ProjectLanding.astro"),
		source("src/config/portfolioConfig.ts"),
	]);
	assert.match(home, /<ProjectLanding\s*\/>/);
	assert.match(projects, /<ProjectLanding\s*\/>/);
	assert.match(landing, /<ProjectShowcase /);
	assert.match(landing, /getPortfolioScenes\(\)/);
	assert.match(config, /"dorm-os"/);
	assert.match(landing, /postCoverImage=\{cover\}/);
	assert.doesNotMatch(home, /space-home-hero/);
	assert.doesNotMatch(projects, /portfolio-project-grid/);
});

test("project listing is retained separately with public repository filtering", async () => {
	const [all, showcase] = await Promise.all([
		source("src/pages/projects/all.astro"),
		source("src/components/portfolio/ProjectShowcase.astro"),
	]);
	assert.match(all, /<h1>全部项目<\/h1>/);
	assert.match(all, /portfolio-project-grid/);
	assert.match(all, /PublicRepositories/);
	assert.match(showcase, /url\("\/projects\/all\/"\)/);
});

test("project scenes are shared, with cycling arrows and native vertical details", async () => {
	const [scene, route, showcase, css] = await Promise.all([
		source("src/utils/portfolio-scenes.ts"),
		source("src/pages/projects/[slug].astro"),
		source("src/components/portfolio/ProjectShowcase.astro"),
		source("src/styles/space-project-showcase.css"),
	]);
	assert.match(scene, /featuredProjectIds\.flatMap/);
	assert.match(scene, /index - 1 \+ ordered\.length/);
	assert.match(scene, /index \+ 1/);
	assert.match(route, /getPortfolioScenes\(\)/);
	assert.match(route, /<ProjectShowcase /);
	assert.match(showcase, /data-previous/);
	assert.match(showcase, /data-next/);
	assert.match(showcase, /space-project-hero/);
	assert.match(showcase, /space-project-image-wrap/);
	assert.match(showcase, /space-project-placeholder/);
	assert.match(showcase, /id="project-details"/);
	assert.match(showcase, /data-pagefind-body/);
	assert.match(showcase, /addEventListener\("pointerdown"/);
	assert.match(showcase, /addEventListener\("wheel"/);
	assert.match(showcase, /ArrowRight/);
	assert.match(css, /\.space-project-switch\s*\{\s*position: fixed;/);
	assert.match(css, /inset: 50% 0 auto/);
	assert.match(css, /grid-template-columns: minmax\(0, 0\.88fr\) minmax\(0, 1\.12fr\)/);
	assert.match(css, /@media \(max-width: 760px\)/);
});

test("single project-first navigation replaces duplicate home and projects tabs", async () => {
	const [layout, css] = await Promise.all([
		source("src/layouts/PortfolioLayout.astro"),
		source("src/styles/space-project-showcase.css"),
	]);
	assert.match(layout, /label: "项目",\s*path: "\/"/);
	assert.doesNotMatch(layout, /label: "首页"/);
	assert.match(layout, /pathname === "\/projects"/);
	assert.match(layout, /pathname !== "\/projects\/all"/);
	assert.match(layout, /portfolio--project-scene/);
	assert.match(css, /\.portfolio--project-scene/);
	assert.match(css, /\.space-project-image-wrap \.portfolio-project-screenshot img \{\s*display: block;\s*width: 100% !important;/);
});

test("site artwork and its responsive rules remain available", async () => {
	const [mark, craft, css, layout] = await Promise.all([
		source("public/brand/07xh-mark.svg"),
		source("public/brand/07xh-ship-refined.svg"),
		source("src/styles/space-airy.css"),
		source("src/layouts/PortfolioLayout.astro"),
	]);
	assert.match(mark, /<svg/);
	assert.match(mark, /07xh Space 飞船标识/);
	assert.match(craft, /轻盈飞船/);
	assert.match(craft, /比例修正版/);
	assert.match(css, /--pf-accent: #2b61df/);
	assert.match(css, /@media \(max-width:720px\)/);
	assert.match(layout, /styles\/space-project-showcase\.css/);
});
