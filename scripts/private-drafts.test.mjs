import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
	PrivateDraftError,
	getPrivateDraft,
	listPrivateDrafts,
	savePrivateDraft,
	deletePrivateDraft,
	listPrivateDraftRevisions,
	getPrivateDraftRevision,
	restorePrivateDraftRevision,
} = await import("../src/lib/private-drafts.ts");

const VALID = [
	"---",
	'title: "测试草稿"',
	"published: 2026-10-20",
	"draft: true",
	"---",
	"",
	"PRIVATE_CONTENT_SHOULD_NOT_BE_SENT_TO_GITHUB",
].join("\n");

function mockKV() {
	const data = new Map();
	const metadata = new Map();
	return {
		data,
		metadata,
		async get(key, type) {
			assert.equal(type, "text");
			return data.get(key) ?? null;
		},
		async put(key, value, options = {}) {
			data.set(key, value);
			metadata.set(key, options.metadata);
		},
		async delete(key) {
			data.delete(key);
			metadata.delete(key);
		},
		async list(options) {
			assert.ok(options.prefix.startsWith("draft:v1:") || options.prefix.startsWith("draft-history:v1:"));
			const matches = [...data.keys()].filter(key => key.startsWith(options.prefix));
			const start = options.cursor ? Number(options.cursor) : 0;
			const page = matches.slice(start, start + (options.limit ?? 100));
			const next = start + page.length;
			return {
				keys: page.map(name => ({ name, metadata: metadata.get(name) })),
				list_complete: next >= matches.length,
				cursor: String(next),
			};
		},
	};
}

async function rejectsStatus(fn, status) {
	await assert.rejects(fn, error => error instanceof PrivateDraftError && error.status === status);
}

test("new draft is stored only in the private KV namespace", async () => {
	const store = mockKV();
	const created = await savePrivateDraft(store, { slug: "study-notes", content: VALID });
	assert.match(created.version, /^[\w-]{36}$/);
	assert.equal(store.data.size, 2);
	assert.ok(store.data.has("draft:v1:study-notes"));
	assert.ok([...store.data.keys()].some(key => key.startsWith("draft-history:v1:study-notes:")));
	const saved = await getPrivateDraft(store, "study-notes");
	assert.equal(saved.content, VALID);
	assert.equal(saved.version, created.version);
	const list = await listPrivateDrafts(store);
	assert.equal(list.items.length, 1);
	assert.equal(list.items[0].slug, "study-notes");
	assert.equal(list.items[0].title, "测试草稿");
	assert.equal(list.items[0].version, created.version);
});

test("prevents new draft from overwriting an existing one", async () => {
	const store = mockKV();
	await savePrivateDraft(store, { slug: "notes", content: VALID });
	await rejectsStatus(() => savePrivateDraft(store, { slug: "notes", content: VALID + "edit" }), 409);
	assert.equal((await getPrivateDraft(store, "notes")).content, VALID);
});

test("requires current version to update and delete a private draft", async () => {
	const store = mockKV();
	const first = await savePrivateDraft(store, { slug: "notes", content: VALID });
	await rejectsStatus(() => savePrivateDraft(store, {
		slug: "notes", content: VALID + "new", expectedVersion: "outdated",
	}), 409);
	const second = await savePrivateDraft(store, {
		slug: "notes", content: VALID + "new", expectedVersion: first.version,
	});
	assert.notEqual(first.version, second.version);
	assert.equal((await getPrivateDraft(store, "notes")).content, VALID + "new");
	await rejectsStatus(() => deletePrivateDraft(store, "notes", first.version), 409);
	await deletePrivateDraft(store, "notes", second.version);
	await rejectsStatus(() => getPrivateDraft(store, "notes"), 404);
});

test("rejects path traversal, public content, invalid frontmatter and oversize content", async () => {
	const store = mockKV();
	await rejectsStatus(() => savePrivateDraft(store, { slug: "../master", content: VALID }), 400);
	await rejectsStatus(() => savePrivateDraft(store, { slug: "foo/bar", content: VALID }), 400);
	await rejectsStatus(() => savePrivateDraft(store, { slug: "public", content: VALID.replace("draft: true", "draft: false") }), 400);
	await rejectsStatus(() => savePrivateDraft(store, { slug: "bad", content: "plain markdown" }), 400);
	await rejectsStatus(() => savePrivateDraft(store, { slug: "huge", content: VALID + "x".repeat(501_000) }), 413);
	assert.equal(store.data.size, 0);
});

test("rejects corrupt data without overwriting or deleting it", async () => {
	const store = mockKV();
	store.data.set("draft:v1:damaged", "{bad json");
	await rejectsStatus(() => getPrivateDraft(store, "damaged"), 500);
	await rejectsStatus(() => savePrivateDraft(store, {
		slug: "damaged", content: VALID, expectedVersion: "anything",
	}), 500);
	assert.equal(store.data.get("draft:v1:damaged"), "{bad json");
});

test("draft list pagination returns a continuation cursor", async () => {
	const store = mockKV();
	for (let i = 0; i < 102; i++) {
		const slug = "n" + i;
		store.data.set("draft:v1:" + slug, JSON.stringify({ content: VALID }));
		store.metadata.set("draft:v1:" + slug, { version: String(i), title: slug, updatedAt: "" });
	}
	const first = await listPrivateDrafts(store);
	assert.equal(first.items.length, 100);
	assert.ok(first.cursor);
	const second = await listPrivateDrafts(store, first.cursor);
	assert.equal(second.items.length, 2);
	assert.equal(second.cursor, null);
});

test("stores mdx format and keeps it on subsequent edits", async () => {
	const store = mockKV();
	const first = await savePrivateDraft(store, { slug: "mdx-notes", content: VALID, extension: "mdx" });
	assert.equal(first.extension, "mdx");
	assert.equal((await getPrivateDraft(store, "mdx-notes")).extension, "mdx");
	assert.equal((await listPrivateDrafts(store)).items[0].extension, "mdx");
	const next = await savePrivateDraft(store, { slug: "mdx-notes", content: VALID + " update", expectedVersion: first.version });
	assert.equal(next.extension, "mdx");
	await rejectsStatus(() => savePrivateDraft(store, { slug: "bad-extension", content: VALID, extension: "html" }), 400);
});

test("each save creates immutable revision snapshots before replacing current", async () => {
	const store = mockKV();
	const first = await savePrivateDraft(store, {slug:"history-test", content:VALID});
	const next = await savePrivateDraft(store, {slug:"history-test", content:VALID+"-second", expectedVersion:first.version});
	const revisions = await listPrivateDraftRevisions(store, "history-test");
	assert.equal(revisions.items.length, 2);
	const old = await getPrivateDraftRevision(store, "history-test", first.version);
	assert.equal(old.content, VALID);
	assert.equal((await getPrivateDraftRevision(store,"history-test",next.version)).content, VALID+"-second");
	assert.equal((await getPrivateDraft(store,"history-test")).content, VALID+"-second");
	assert.ok(store.data.has("draft-history:v1:history-test:"+first.version));
	assert.ok(store.data.has("draft-history:v1:history-test:"+next.version));
});

test("delete keeps history; restore deleted draft makes a new revision", async () => {
	const store = mockKV();
	const original = await savePrivateDraft(store, {slug:"recover", content:VALID, extension:"mdx"});
	await deletePrivateDraft(store, "recover", original.version);
	await rejectsStatus(() => getPrivateDraft(store,"recover"),404);
	assert.equal((await getPrivateDraftRevision(store,"recover",original.version)).content,VALID);
	const recovery = await restorePrivateDraftRevision(store, {slug:"recover",revision:original.version});
	assert.notEqual(recovery.version, original.version);
	assert.equal(recovery.extension,"mdx");
	assert.equal((await getPrivateDraft(store,"recover")).content,VALID);
});

test("restoring existing draft needs the latest version and retains previous current history",async()=>{
	const store=mockKV();
	const first=await savePrivateDraft(store,{slug:"changes",content:VALID});
	const second=await savePrivateDraft(store,{slug:"changes",content:VALID+"-edited",expectedVersion:first.version});
	await rejectsStatus(()=>restorePrivateDraftRevision(store,{slug:"changes",revision:first.version}),409);
	await rejectsStatus(()=>restorePrivateDraftRevision(store,{slug:"changes",revision:first.version,expectedVersion:first.version}),409);
	assert.equal((await getPrivateDraft(store,"changes")).content,VALID+"-edited");
	const restore=await restorePrivateDraftRevision(store,{slug:"changes",revision:first.version,expectedVersion:second.version});
	assert.notEqual(restore.version,second.version);
	assert.equal((await getPrivateDraft(store,"changes")).content,VALID);
	assert.equal((await getPrivateDraftRevision(store,"changes",second.version)).content,VALID+"-edited");
});

test("failure to write history cannot overwrite or delete a current draft",async()=>{
	const store=mockKV();
	const original=await savePrivateDraft(store,{slug:"failsafe",content:VALID});
	const dataBefore=store.data.get("draft:v1:failsafe");
	const put=store.put.bind(store);
	store.put=async (key,value,options)=>{
		if(key.startsWith("draft-history:"))throw new Error("simulated history disk fault");
		return put(key,value,options);
	};
	await assert.rejects(
		()=>savePrivateDraft(store,{slug:"failsafe",content:VALID+" changed",expectedVersion:original.version}),
		/simulated/,
	);
	assert.equal(store.data.get("draft:v1:failsafe"),dataBefore);
	const historicalKey="draft-history:v1:failsafe:"+original.version;
	store.data.set(historicalKey,"CORRUPTED ARCHIVE");
	await rejectsStatus(()=>deletePrivateDraft(store,"failsafe",original.version),409);
	assert.equal(store.data.get("draft:v1:failsafe"),dataBefore);
});

test("history revisions cannot be silently overwritten and invalid versions fail",async()=>{
	const store=mockKV();
	const first=await savePrivateDraft(store,{slug:"intact",content:VALID});
	const key="draft-history:v1:intact:"+first.version;
	store.data.set(key,JSON.stringify({...JSON.parse(store.data.get(key)),content:"TAMPERED"}));
	await rejectsStatus(()=>savePrivateDraft(store,{slug:"intact",content:VALID+"x",expectedVersion:first.version}),409);
	assert.equal((await getPrivateDraft(store,"intact")).content,VALID);
	await rejectsStatus(()=>getPrivateDraftRevision(store,"intact","../../../../bad"),400);
	await rejectsStatus(()=>restorePrivateDraftRevision(store,{slug:"intact",revision:"not-a-version",expectedVersion:first.version}),400);
});

test("revision cursor pagination is independent from live draft pagination",async()=>{
	const store=mockKV();
	for(let i=0;i<105;i++){
		const version="00000000-0000-4000-8000-"+String(i).padStart(12,"0");
		const key="draft-history:v1:pagination:"+version;
		store.data.set(key,JSON.stringify({schema:1,slug:"pagination",version,content:VALID,updatedAt:"2026-10-21",extension:"md"}));
		store.metadata.set(key,{version,title:"Old draft",extension:"md",updatedAt:"2026-10-21"});
	}
	const first=await listPrivateDraftRevisions(store,"pagination");
	assert.equal(first.items.length,100);
	assert.ok(first.cursor);
	const second=await listPrivateDraftRevisions(store,"pagination",first.cursor);
	assert.equal(second.items.length,5);
	assert.equal(second.cursor,null);
});
