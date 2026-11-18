<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";

export let title = i18n(I18nKey.search);
export let description = "";

type ResultKind = "all" | "posts" | "projects" | "topics";
const kinds: { value: ResultKind; label: string }[] = [
	{ value: "all", label: "全部" },
	{ value: "posts", label: "文章" },
	{ value: "projects", label: "项目" },
	{ value: "topics", label: "专题" },
];
const limit = 8;

let keyword = "";
let results: SearchResult[] = [];
let indexState: "loading" | "ready" | "unavailable" | "preview" = "loading";
let isSearching = false;
let failed = false;
let activeKind: ResultKind = "all";
let currentPage = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
let requestId = 0;

function kindOf(result: SearchResult): ResultKind | "other" {
	let pathname = "";
	try {
		pathname = new URL(result.url, window.location.href).pathname;
	} catch {
		return "other";
	}
	if (pathname.includes("/posts/")) return "posts";
	if (pathname.includes("/projects/") || pathname === "/") return "projects";
	if (pathname.includes("/topics/")) return "topics";
	return "other";
}

$: visibleResults =
	activeKind === "all"
		? results
		: results.filter((result) => kindOf(result) === activeKind);
$: pages = Math.max(1, Math.ceil(visibleResults.length / limit));
$: pageResults = visibleResults.slice(
	(currentPage - 1) * limit,
	currentPage * limit,
);

function countOf(kind: ResultKind): number {
	return kind === "all"
		? results.length
		: results.filter((result) => kindOf(result) === kind).length;
}

function chooseKind(kind: ResultKind) {
	activeKind = kind;
	currentPage = 1;
}

function changePage(next: number) {
	currentPage = Math.max(1, Math.min(next, pages));
	document.querySelector(".space-search-result-heading")?.scrollIntoView({
		block: "start",
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
			? "auto"
			: "smooth",
	});
}

async function search() {
	const term = keyword.trim();
	const id = ++requestId;
	activeKind = "all";
	currentPage = 1;
	failed = false;
	if (!term) {
		results = [];
		isSearching = false;
		return;
	}
	if (indexState !== "ready" || !window.pagefind) return;
	isSearching = true;
	try {
		const found = await window.pagefind.search(term);
		const items = await Promise.all(
			found.results.map((result) => result.data()),
		);
		if (id !== requestId) return;
		results = items;
	} catch (error) {
		if (id !== requestId) return;
		console.error("Search request failed:", error);
		results = [];
		failed = true;
	} finally {
		if (id === requestId) isSearching = false;
	}
}

function handleInput() {
	const target = new URL(window.location.href);
	if (keyword.trim()) target.searchParams.set("q", keyword.trim());
	else target.searchParams.delete("q");
	window.history.replaceState(window.history.state, "", target);
	window.clearTimeout(timer);
	if (!keyword.trim()) {
		void search();
		return;
	}
	timer = window.setTimeout(() => {
		void search();
	}, 260);
}

function clearSearch() {
	keyword = "";
	void handleInput();
}

onMount(() => {
	keyword = new URLSearchParams(window.location.search).get("q") ?? "";
	if (import.meta.env.DEV) {
		indexState = "preview";
		return;
	}
	const onReady = () => {
		indexState = "ready";
		if (keyword.trim()) void search();
	};
	const onFailure = () => {
		if (window.pagefind) return;
		indexState = "unavailable";
		isSearching = false;
	};
	document.addEventListener("pagefindready", onReady);
	document.addEventListener("pagefindloaderror", onFailure);
	if (window.pagefind) {
		onReady();
	} else {
		void window.__loadPagefind?.();
	}
	return () => {
		window.clearTimeout(timer);
		requestId++;
		document.removeEventListener("pagefindready", onReady);
		document.removeEventListener("pagefindloaderror", onFailure);
	};
});
</script>

<section class="space-search-page" aria-label="站内搜索">
	<div class="space-search-header">
		<h1>{title}</h1>
		<p>{description || "查找文章、项目与学习专题。"}</p>
	</div>
	<div class="space-search-field">
		<Icon icon="material-symbols:search-rounded" class="space-search-icon" />
		<label class="sr-only" for="space-global-search">输入搜索关键词</label>
		<input
			id="space-global-search"
			type="search"
			autocomplete="off"
			placeholder="搜索文章、项目或关键词"
			bind:value={keyword}
			on:input={handleInput}
		/>
		{#if keyword}
			<button type="button" class="space-search-clear" on:click={clearSearch} aria-label="清除搜索">
				<Icon icon="material-symbols:close-rounded" />
			</button>
		{/if}
	</div>

	{#if indexState === "loading"}
		<div class="space-search-status" role="status">
			<Icon icon="svg-spinners:ring-resize" class="space-search-spinner" />
			<span>正在载入搜索索引…</span>
		</div>
	{:else if indexState === "unavailable"}
		<div class="space-search-status" role="alert">
			<p>搜索索引暂时无法载入，请检查网络后刷新页面。</p>
			<button type="button" on:click={() => window.location.reload()}>重新加载</button>
		</div>
	{:else if indexState === "preview"}
		<div class="space-search-status" role="status">本地开发预览未生成搜索索引；请在生产构建后验证搜索结果。</div>
	{:else if !keyword.trim()}
		<div class="space-search-status" role="status">输入关键词后，即可查找站内内容。</div>
	{:else}
		<div class="space-search-tabs" role="group" aria-label="搜索结果类型">
			{#each kinds as kind}
				<button
					type="button"
					aria-pressed={activeKind === kind.value}
					on:click={() => chooseKind(kind.value)}
				>
					{kind.label}
					<span>{countOf(kind.value)}</span>
				</button>
			{/each}
		</div>

		<div class="space-search-result-heading">
			<h2>搜索结果</h2>
			<span aria-live="polite">{isSearching ? "正在搜索…" : `共 ${visibleResults.length} 条`}</span>
		</div>
		{#if isSearching}
			<div class="space-search-status" role="status">
				<Icon icon="svg-spinners:ring-resize" class="space-search-spinner" />
				<span>正在搜索…</span>
			</div>
		{:else if failed}
			<div class="space-search-status" role="alert">
				<p>搜索失败，请重新尝试。</p>
				<button type="button" on:click={() => void search()}>重试</button>
			</div>
		{:else if visibleResults.length > 0}
			<ol class="space-search-results">
				{#each pageResults as result, index (result.url + index)}
					<li>
						<a href={result.url}>
							<div class="space-search-result-meta">
								<span>{kindOf(result) === "posts" ? "文章" : kindOf(result) === "projects" ? "项目" : kindOf(result) === "topics" ? "专题" : "站内页面"}</span>
								<Icon icon="material-symbols:arrow-outward-rounded" />
							</div>
							<h3>{result.meta.title}</h3>
							{#if result.excerpt}
								<p>{@html result.excerpt}</p>
							{/if}
						</a>
					</li>
				{/each}
			</ol>
			{#if pages > 1}
				<nav class="space-search-pagination" aria-label="搜索结果分页">
					<button type="button" on:click={() => changePage(currentPage - 1)} disabled={currentPage === 1}>上一页</button>
					<span>第 {currentPage} / {pages} 页</span>
					<button type="button" on:click={() => changePage(currentPage + 1)} disabled={currentPage === pages}>下一页</button>
				</nav>
			{/if}
		{:else}
			<div class="space-search-status" role="status">
				<p>{activeKind === "all" ? i18n(I18nKey.searchNoResults) : "这一类没有匹配的结果。"}</p>
				{#if activeKind !== "all"}
					<button type="button" on:click={() => chooseKind("all")}>查看全部结果</button>
				{/if}
			</div>
		{/if}
	{/if}
</section>
