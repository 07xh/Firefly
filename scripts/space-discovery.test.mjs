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
