import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
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

test("protected ImgBed delete route checks stage and references before upstream deletion", () => {
	// The legacy upload.ts route uploads to GitHub and does not handle ImgBed deletion.
	const source = readFileSync(
		new URL("../src/pages/api/admin/imgbed.ts", import.meta.url),
		"utf8",
	);
	const route = source.slice(source.indexOf("export const DELETE:"));
	assert.ok(route.startsWith("export const DELETE:"));
	const stage = route.indexOf('requireMediaStage("DELETE")');
	const checker = route.indexOf("await assertImageNotReferenced(");
	const remove = route.indexOf("const deleteResponse = await upstream(");
	assert.ok(stage >= 0, "deletion must be gated by its own server-side flag");
	assert.ok(checker > stage, "reference scan must run after the release gate");
	assert.ok(remove > checker, "upstream delete must run only after reference scan");
	assert.ok(
		route.includes('message.includes("仍被文章或草稿引用") ? 409 : 503'),
		"unverified references must block deletion",
	);
});

function d1ImageTestDatabase() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec([
		"CREATE TABLE private_drafts (slug TEXT,version TEXT,record TEXT)",
		"CREATE TABLE private_draft_revisions (slug TEXT,version TEXT,record TEXT)",
	].join(";"));
	const db = {
		prepare(query) {
			return {
				bind(...args) {
					return {
						async all() { return {results:sqlite.prepare(query).all(...args)}; },
					};
				},
			};
		},
	};
	return {sqlite, db};
}

function emptyPrivateArchive() {
	return {
		async list() { return {objects:[],truncated:false}; },
		async get() { return null; },
	};
}

test("D1-backed active private draft image references prevent deletion",async()=>{
	const {sqlite,db}=d1ImageTestDatabase();
	const content='<img src="https://tu.0701000.xyz/file/notes/试卷 A.png" />';
	sqlite.prepare("INSERT INTO private_drafts VALUES (?,?,?)").run(
		"current","v1",JSON.stringify({slug:"current",version:"v1",content}),
	);
	const sources=createImgBedReferenceSources({
		FIREFLY_PRIVATE_DRAFT_BACKEND:"d1",
		FIREFLY_PRIVATE_DRAFT_DB:db,
		FIREFLY_PRIVATE_DRAFT_BACKUPS:emptyPrivateArchive(),
	});
	const docs=await sources.listPrivateDrafts();
	assert.equal(docs.length,1);
	assert.deepEqual(findImageReferences(docs,base,name),["d1:private_drafts:current:v1"]);
});

test("D1 historical revisions also keep images protected",async()=>{
	const {sqlite,db}=d1ImageTestDatabase();
	const content='![old](https://tu.0701000.xyz/file/notes/试卷 A.png)';
	sqlite.prepare("INSERT INTO private_draft_revisions VALUES (?,?,?)").run(
		"deleted","prior",JSON.stringify({slug:"deleted",version:"prior",content}),
	);
	const docs=await createImgBedReferenceSources({
		FIREFLY_PRIVATE_DRAFT_BACKEND:"d1",
		FIREFLY_PRIVATE_DRAFT_DB:db,
		FIREFLY_PRIVATE_DRAFT_BACKUPS:emptyPrivateArchive(),
	}).listPrivateDrafts();
	assert.deepEqual(findImageReferences(docs,base,name),[
		"d1:private_draft_revisions:deleted:prior",
	]);
});

test("missing D1, KV, or R2 bindings fail closed before ImgBed deletion",async()=>{
	for(const flags of [
		{FIREFLY_PRIVATE_DRAFT_BACKEND:"d1",FIREFLY_PRIVATE_DRAFT_BACKUPS:emptyPrivateArchive()},
		{FIREFLY_PRIVATE_DRAFT_BACKEND:"kv",FIREFLY_PRIVATE_DRAFT_BACKUPS:emptyPrivateArchive()},
		{FIREFLY_PRIVATE_DRAFT_BACKEND:"d1",FIREFLY_PRIVATE_DRAFT_DB:d1ImageTestDatabase().db},
	]){
		await assert.rejects(
			()=>createImgBedReferenceSources(flags).listPrivateDrafts(),
			/未绑定/,
		);
	}
});

test("unreadable or malformed D1 draft rows never allow image deletion",async()=>{
	const {sqlite,db}=d1ImageTestDatabase();
	sqlite.prepare("INSERT INTO private_draft_revisions VALUES (?,?,?)").run(
		"note","v1",JSON.stringify({slug:"note",version:"wrong",content:"safe"}),
	);
	await assert.rejects(
		()=>createImgBedReferenceSources({
			FIREFLY_PRIVATE_DRAFT_BACKEND:"d1",
			FIREFLY_PRIVATE_DRAFT_DB:db,
			FIREFLY_PRIVATE_DRAFT_BACKUPS:emptyPrivateArchive(),
		}).listPrivateDrafts(),
		/版本校验失败/,
	);
});
