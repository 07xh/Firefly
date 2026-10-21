import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { assertImageNotReferenced, findImageReferences, imageReferenceTokens } =
	await import("../src/lib/imgbed-reference-guard.ts");
const { createImgBedReferenceSources } =
	await import("../src/lib/imgbed-reference-sources.ts");

const base = "https://tu.0701000.xyz/";
const name = "notes/试卷 A.png";

test("recognize URL-escaped and decoded image references", () => {
	const tokens = imageReferenceTokens(base, name);
	assert.ok(tokens.some(x => x.includes("%E8%AF%95")));
	assert.ok(tokens.some(x => x.includes("试卷")));
	const articles = [
		{path:"src/content/posts/article.md",content:"![图]("+tokens[0]+")"},
		{path:"src/content/posts/other.mdx",content:"<img src=\""+tokens[1]+"\" />"},
		{path:"src/content/posts/unrelated.md",content:"no media here"},
	];
	assert.deepEqual(findImageReferences(articles, base, name), [
		"src/content/posts/article.md","src/content/posts/other.mdx",
	]);
});

test("deletion guard blocks images referenced only by a private draft", async () => {
	await assert.rejects(
		() => assertImageNotReferenced({
			async listArticles() { return [{path:"public",content:"no reference"}]; },
			async listPrivateDrafts() { return [{
				path:"draft:v1:private",
				content:"<Image src=\"https://tu.0701000.xyz/file/notes/试卷 A.png\" />",
			}]; },
		}, base, name),
		/图片仍被文章或草稿引用/,
	);
});

test("deletion guard fails closed when a source cannot be inspected", async () => {
	await assert.rejects(
		() => assertImageNotReferenced({
			async listArticles() { throw new Error("GitHub data unavailable"); },
			async listPrivateDrafts() { return []; },
		}, base, name),
		/GitHub data unavailable/,
	);
});

test("allow deleting a demonstrably unreferenced image", async () => {
	await assert.doesNotReject(() => assertImageNotReferenced({
		async listArticles() { return [{path:"a.md",content:"# Title"}]; },
		async listPrivateDrafts() { return [{path:"b.md",content:"![](https://example.com/other.png)"}]; },
	}, base, name));
});

test("reference source refuses GitHub scans without a server-side token", async () => {
	const source = createImgBedReferenceSources({});
	await assert.rejects(() => source.listArticles(), /缺少服务端 GitHub 令牌/);
});

test("GitHub source reads source bytes and identifies public Markdown references", async () => {
	const source = createImgBedReferenceSources({FIREFLY_CONTENTS_TOKEN:"mock-test-token"});
	const oldFetch = globalThis.fetch;
	let requests=0;
	globalThis.fetch=async url=>{
		requests++;
		if(String(url).includes("/git/trees/")) {
			return new Response(JSON.stringify({
				tree:[{type:"blob",path:"src/content/posts/study.md"}],
				truncated:false,
			}),{status:200});
		}
		if(String(url).includes("/contents/")) {
			const md="# Example\n\n![test](https://tu.0701000.xyz/file/notes/%E8%AF%95%E5%8D%B7%20A.png)";
			return new Response(JSON.stringify({
				content:Buffer.from(md).toString("base64"),encoding:"base64",
			}),{status:200});
		}
		throw new Error("unexpected request");
	};
	try {
		const articles=await source.listArticles();
		assert.equal(articles.length,1);
		assert.equal(requests,2);
		assert.deepEqual(findImageReferences(articles,base,name),["src/content/posts/study.md"]);
	} finally {
		globalThis.fetch=oldFetch;
	}
});

test("protected delete route calls reference scanner before upstream delete", () => {
	const source=readFileSync(new URL("../src/pages/api/admin/upload.ts",import.meta.url),"utf8");
	const checker=source.indexOf("await assertImageNotReferenced(");
	const remove=source.indexOf("const deleteResponse = await upstream(");
	assert.ok(checker>0 && remove>checker);
	assert.ok(source.includes("message.includes(\"仍被文章或草稿引用\") ? 409 : 503"));
});
