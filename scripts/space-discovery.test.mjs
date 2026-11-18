import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("blog directory renders real published posts with working local filters", async () => {
	const [page, rows] = await Promise.all([
		source("src/pages/posts/index.astro"),
		source("src/components/portfolio/PostRows.astro"),
	]);
	assert.match(page, /getSortedPostsList\(\)/);
	assert.match(page, /data-directory-input/);
	assert.match(page, /data-category-filter/);
	assert.match(page, /data-directory-count/);
	assert.match(page, /item\.hidden = !\(categoryMatches && textMatches\)/);
	assert.match(page, /data-directory-reset-empty/);
	assert.match(rows, /getPostUrlBySlug\(id\)/);
	assert.match(rows, /data-post-item/);
	assert.match(rows, /data-post-search/);
	assert.match(rows, /data\.description/);
	assert.match(rows, /data\.series/);
	assert.match(rows, /data\.tags/);
});

test("topic cards and chapter detail derive content from the same real series", async () => {
	const [index, detail] = await Promise.all([
		source("src/pages/topics/index.astro"),
		source("src/pages/topics/[topic].astro"),
	]);
	assert.match(index, /getSortedPostsList\(\)/);
	assert.match(index, /data\.series === topic\.series/);
	assert.match(index, /chapters\.slice\(0, 3\)/);
	assert.match(detail, /getSortedPostsList\(\)/);
	assert.match(detail, /seriesOrder/);
	assert.match(detail, /getPostUrlBySlug\(first\.id\)/);
	assert.match(detail, /<PostRows posts=\{posts\} showSequence/);
});

test("search uses Pagefind results, not simulated data, and differentiates failures", async () => {
	const [component, page] = await Promise.all([
		source("src/components/pages/AdvancedSearch.svelte"),
		source("src/pages/search.astro"),
	]);
	assert.match(component, /window\.pagefind\.search\(term\)/);
	assert.match(component, /found\.results\.map\(\(result\) => result\.data\(\)\)/);
	assert.match(component, /pagefindloaderror/);
	assert.match(component, /type ResultKind/);
	assert.match(component, /currentPage/);
	assert.match(component, /生产构建后验证搜索结果/);
	assert.doesNotMatch(component, /fakeResult|Dev Mode Search Result/);
	assert.match(page, /await import\(scriptUrl\)/);
	assert.match(page, /new Event\("pagefindloaderror"\)/);
});

test("discovery theme is scoped, responsive and has visible focus states", async () => {
	const css = await source("src/styles/space-discovery.css");
	assert.match(css, /\.space-directory-page \.portfolio-post-row/);
	assert.match(css, /\.space-search-results/);
	assert.match(css, /\.space-topics-grid/);
	assert.match(css, /@media \(max-width: 630px\)/);
	assert.match(css, /focus-visible/);
});

test("archive keeps legacy deep links and filters only published source posts", async () => {
	const [route, panel] = await Promise.all([
		source("src/pages/archive.astro"),
		source("src/components/controls/ArchivePanel.astro"),
	]);
	assert.match(route, /space-library-page/);
	assert.match(panel, /getSortedPostsList\(\)/);
	assert.match(panel, /params\.getAll\("tag"\)/);
	assert.match(panel, /params\.getAll\("category"\)/);
	assert.match(panel, /params\.get\("uncategorized"\)/);
	assert.match(panel, /matchesTags && matchesCategories && matchesUncategorized && matchesQuery/);
	assert.match(panel, /<details/);
	assert.match(panel, /getPostUrlBySlug\(id\)/);
});

test("category and tag links preserve archive filter URLs and published counts", async () => {
	const [categories, tags, search] = await Promise.all([
		source("src/pages/categories/index.astro"),
		source("src/pages/tags/index.astro"),
		source("src/components/portfolio/TaxonomySearch.astro"),
	]);
	for (const page of [categories, tags]) {
		assert.match(page, /getSortedPostsList\(\)/);
		assert.match(page, /<TaxonomySearch/);
		assert.match(page, /data-taxonomy-item/);
	}
	assert.match(categories, /getCategoryUrl\(category \|\| null\)/);
	assert.match(tags, /getTagUrl\(name\)/);
	assert.match(search, /data-taxonomy-search/);
	assert.match(search, /item\.hidden = !matches/);
});

test("series disclosure and about page preserve real published content and editable copy", async () => {
	const [series, about, css] = await Promise.all([
		source("src/pages/series/index.astro"),
		source("src/pages/about.astro"),
		source("src/styles/space-taxonomy.css"),
	]);
	assert.match(series, /getSeriesList\(\)/);
	assert.match(series, /<details/);
	assert.match(series, /getPostUrlBySlug\(post\.id\)/);
	assert.doesNotMatch(series, /window\.__seriesAccordionInit/);
	assert.match(about, /siteSettings\.aboutContent/);
	assert.match(about, /sanitizeHtml/);
	assert.match(about, /<Content\s*\/>/);
	assert.match(about, /siteSettings\.showAboutDonation/);
	assert.match(about, /application\/ld\+json/);
	assert.match(css, /\.space-about-page/);
	assert.match(css, /@media \(max-width: 550px\)/);
});

test("public utility pages all use the 07xh Space layout, not legacy MainGrid", async () => {
	const routes = [
		"src/pages/404.astro",
		"src/pages/booknav.astro",
		"src/pages/friends.astro",
		"src/pages/guestbook.astro",
		"src/pages/gallery/index.astro",
		"src/pages/gallery/[album].astro",
		"src/pages/sponsor.astro",
	];
	for (const route of routes) {
		const code = await source(route);
		assert.match(code, /PortfolioLayout/);
		assert.match(code, /space-utility\.css/);
		assert.doesNotMatch(code, /MainGridLayout/);
	}
});

test("gallery keeps photo behavior while excluding inherited demo albums from public routes", async () => {
	const [index, detail, galleryConfig] = await Promise.all([
		source("src/pages/gallery/index.astro"),
		source("src/pages/gallery/[album].astro"),
		source("src/config/galleryConfig.ts"),
	]);
	assert.match(index, /getPublicGalleryAlbums\(\)\.map/);
	assert.match(index, /scanAlbumPhotos\(album\.id\)/);
	assert.match(index, /data-album/);
	assert.doesNotMatch(index, /demoIds\.has|原主题示例/);
	assert.match(detail, /getPublicGalleryAlbums\(\)\.map/);
	assert.match(detail, /getPublicGalleryAlbums\(\)\.find/);
	assert.match(detail, /<EncryptedContent password=/);
	assert.match(detail, /<PhotoCard src=/);
	assert.match(galleryConfig, /new Set\(\["firefly-2026", "encrypted-test"\]\)/);
	assert.match(galleryConfig, /!legacyThemeAlbumIds\.has\(id\)/);
});

test("bookmarks and friends preserve real configured links and search by actual data", async () => {
	const [links, friends] = await Promise.all([
		source("src/pages/booknav.astro"),
		source("src/pages/friends.astro"),
	]);
	assert.match(links, /getEnabledBooknavGroups\(\)/);
	assert.match(links, /resolveBooknavIcon/);
	assert.match(links, /data-group-target/);
	assert.match(links, /data-search-text/);
	assert.match(links, /handleIconError|onIconError/);
	assert.match(friends, /getEnabledFriends\(\)/);
	assert.match(friends, /friend\.siteurl/);
	assert.match(friends, /data-tags=\{JSON\.stringify/);
	assert.match(friends, /friendsPageConfig\.showCustomContent/);
	assert.match(friends, /<Comment post=\{entry\}/);
});

test("guestbook does not pretend comments work and theme donor payment examples are disabled", async () => {
	const [guestbook, support, config] = await Promise.all([
		source("src/pages/guestbook.astro"),
		source("src/pages/sponsor.astro"),
		source("src/config/sponsorConfig.ts"),
	]);
	assert.match(guestbook, /commentsEnabled \?/);
	assert.match(guestbook, /留言暂未开放/);
	assert.match(support, /methods\.length > 0/);
	assert.match(support, /暂未配置支持方式/);
	assert.match(config, /showButtonInPost: false/);
	assert.match(config, /sponsors: \[\]/);
	assert.doesNotMatch(config, /enabled: true/);
});

test("theme author defaults are not exposed as this site's friends or bookmarks", async () => {
	const [friends, bookmarks, friendText, aboutFallback] = await Promise.all([
		source("src/config/friendsConfig.ts"),
		source("src/config/booknavConfig.ts"),
		source("src/content/spec/friends.mdx"),
		source("src/content/spec/about.md"),
	]);
	for (const name of ["夏夜流萤", "Firefly Docs", "Astro"]) {
		assert.match(friends, new RegExp(`title: "${name}"[\\s\\S]*?enabled: false`));
	}
	for (const name of ["Firefly", "Firefly Docs", "夏夜流萤"]) {
		assert.match(bookmarks, new RegExp(`title: "${name}"[\\s\\S]*?enabled: false`));
	}
	assert.match(bookmarks, /title: "MDN Web Docs"/);
	assert.match(bookmarks, /title: "GitHub"/);
	assert.doesNotMatch(friendText, /cuteleaf\.cn|xiaye@msn\.com|weavatar\.com/i);
	assert.doesNotMatch(aboutFallback, /夏叶|CuteLeaf|firefly\.cuteleaf\.cn/i);
});

test("portfolio footer shows real utility sections but hides demo-only galleries and friends", async () => {
	const [layout, gallery, friends] = await Promise.all([
		source("src/layouts/PortfolioLayout.astro"),
		source("src/config/galleryConfig.ts"),
		source("src/config/friendsConfig.ts"),
	]);
	assert.match(layout, /hasPublicAlbums = siteConfig\.pages\.gallery && getPublicGalleryAlbums\(\)\.length > 0/);
	assert.match(layout, /hasPublicFriends = siteConfig\.pages\.friends && getEnabledFriends\(\)\.length > 0/);
	assert.match(layout, /siteConfig\.pages\.booknav && <a href=/);
	assert.match(layout, /hasPublicAlbums && <a href=/);
	assert.match(layout, /hasPublicFriends && <a href=/);
	assert.match(gallery, /getPublicGalleryAlbums\(\)/);
	assert.match(friends, /getEnabledFriends/);
});
