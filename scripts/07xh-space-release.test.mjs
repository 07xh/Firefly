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

test("homepage and project entry keep the real portfolio reachable", async () => {
	const [home, projects, landing, config] = await Promise.all([
		source("src/pages/index.astro"),
		source("src/pages/projects/index.astro"),
		source("src/components/portfolio/ProjectLanding.astro"),
		source("src/config/portfolioConfig.ts"),
	]);
	assert.match(projects, /<ProjectLanding\s*\/>/);
	assert.match(landing, /<ProjectShowcase /);
	assert.match(landing, /getPortfolioScenes\(\)/);
	assert.match(config, /"dorm-os"/);
	assert.match(landing, /postCoverImage=\{cover\}/);
	assert.ok(
		home.includes("<ProjectLanding />") || home.includes("space-home-hero"),
		"homepage must either show the real first project or introduce the site",
	);
	if (home.includes("space-home-hero")) {
		assert.match(home, /url\("\/projects\/"\)/);
	}
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

test("navigation preserves a project entry and separates public reading routes", async () => {
	const [layout, css] = await Promise.all([
		source("src/layouts/PortfolioLayout.astro"),
		source("src/styles/space-project-showcase.css"),
	]);
	assert.match(layout, /label: "项目"/);
	assert.match(layout, /path: "\/projects\/"/);
	assert.match(layout, /path: "\/posts\/"/);
	assert.match(layout, /path: "\/topics\/"/);
	assert.match(layout, /pathname === "\/projects"/);
	assert.match(layout, /pathname !== "\/projects\/all"/);
	assert.match(css, /\.portfolio--project-scene/);
	assert.match(css, /\.space-project-image-wrap \.portfolio-project-screenshot img \{\s*display: block;\s*width: 100% !important;/);
});

test("showcase switches authentic project screenshots without distorting images", async () => {
	const [page, css] = await Promise.all([
		source("src/components/portfolio/ProjectShowcase.astro"),
		source("src/styles/space-project-showcase.css"),
	]);
	assert.match(page, /hasPhonePreview/);
	assert.match(page, /dorm-os-home\.webp/);
	assert.match(page, /data-preview-pane="main"/);
	assert.match(page, /data-preview-pane="phone" hidden/);
	assert.match(page, /data-preview-target="main" aria-pressed="true"/);
	assert.match(page, /data-preview-target="phone" aria-pressed="false"/);
	assert.match(page, /onPreviewClick/);
	assert.match(page, /pane\.hidden = pane\.dataset\.previewPane !== selection/);
	assert.match(css, /\.space-project-image-space\[hidden\] \{ display: none !important; \}/);
	assert.match(css, /\.space-project-phone-image \{/);
	assert.match(css, /object-fit: contain/);
	assert.match(css, /\.space-project-preview-controls button\[aria-pressed="true"\]/);
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

test("featured projects show concrete, verified or explicitly unverified functions", async () => {
	const names = [
		"dorm-os", "engineering-drawing-study", "studyflow", "momoflow",
		"wordflow", "reqable-bridge", "kingo-assistant", "zhidao-assistant",
	];
	const docs = await Promise.all(names.map(name => source("src/content/projects/" + name + ".md")));
	for (let i = 0; i < names.length; i++) {
		const content = docs[i];
		assert.match(content, /^highlights:\s*$/m, names[i] + " needs structured capabilities");
		assert.equal((content.match(/^\s+- title:/gm) || []).length, 3, names[i] + " needs three concrete capabilities");
		assert.equal((content.match(/^\s+state: "(implemented|verifying|planned)"/gm) || []).length, 3, names[i] + " needs a state per capability");
		assert.match(content, /^## .+$/m, names[i] + " needs a real detail section");
		assert.ok(content.length > 900, names[i] + " description should cover use cases, not one tagline");
	}
	assert.match(docs[0], /数据连接/);
	assert.match(docs[1], /三面投影/);
	assert.match(docs[2], /课程与章节/);
	assert.match(docs[3], /官方记录/);
	assert.match(docs[4], /TXT、CSV/);
	assert.match(docs[5], /HTTP 会话/);
	assert.match(docs[6], /0\/4/);
	assert.match(docs[7], /课程总览/);
});
test("project highlights are typed and displayed on the hero and searchable in directory", async () => {
	const [schema, showcase, listing, css] = await Promise.all([
		source("src/content.config.ts"),
		source("src/components/portfolio/ProjectShowcase.astro"),
		source("src/pages/projects/all.astro"),
		source("src/styles/space-project-showcase.css"),
	]);
	assert.match(schema, /highlights: z\.array\(z\.object/);
	assert.match(schema, /"implemented", "verifying", "planned"/);
	assert.match(showcase, /它可以做什么/);
	assert.match(showcase, /highlights\.map/);
	assert.match(showcase, /highlightStates\[state\]/);
	assert.match(listing, /project\.data\.highlights\.slice\(0, 2\)/);
	assert.match(listing, /project\.data\.highlights\.flatMap/);
	assert.match(css, /space-project-capabilities/);
	assert.match(css, /max-width:760px/);
});
