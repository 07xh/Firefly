import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { createD1PrivateDraftStore } = await import("../src/lib/private-draft-d1.ts");
const { resolvePrivateDraftStore } = await import("../src/lib/private-draft-storage-binding.ts");
const {
	savePrivateDraft,
	getPrivateDraft,
	deletePrivateDraft,
	getPrivateDraftRevision,
	listPrivateDraftRevisions,
	PrivateDraftError,
} = await import("../src/lib/private-drafts.ts");

const migration = readFileSync(
	new URL("../migrations/0001_private_drafts_d1.sql", import.meta.url), "utf8",
);
const VALID = "---\ntitle: \"原稿\"\npublished: 2026-10-21\ndraft: true\n---\n\n<Badge>测试 MDX</Badge>\n";

function mockD1() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec(migration);
	return {
		prepare(query) {
			return {
				bind(...args) {
					const stmt = sqlite.prepare(query);
					return {
						async first() { return stmt.get(...args) ?? null; },
						async run() {
							const result = stmt.run(...args);
							return { success:true, meta:{changes:Number(result.changes)} };
						},
						async all() { return { results:stmt.all(...args) }; },
					};
				},
			};
		},
	};
}
function mockR2() {
	const objects=new Map();
	return {
		objects,
		async get(key) { return objects.has(key) ? { async text() { return objects.get(key); } } : null; },
		async put(key,value,options) {
			assert.equal(options?.onlyIf?.etagDoesNotMatch,"*");
			if(objects.has(key))return null;
			objects.set(key,value);
			return {key};
		},
		async list({prefix,cursor,limit=100}) {
			const all=[...objects.keys()].filter(k=>k.startsWith(prefix));
			const start=Number(cursor||0),page=all.slice(start,start+limit);
			return {objects:page.map(key=>({key})),truncated:start+page.length<all.length,cursor:String(start+page.length)};
		},
	};
}
async function rejects409(fn) {
	await assert.rejects(fn, err=>err instanceof PrivateDraftError && err.status===409);
}

test("D1 creates and reads a private MDX draft with a verified R2 revision",async()=>{
	const store=createD1PrivateDraftStore(mockD1()),r2=mockR2();
	const created=await savePrivateDraft(store,{slug:"我的草稿",content:VALID,extension:"mdx"},r2);
	assert.ok(created.version);
	assert.equal((await getPrivateDraft(store,"我的草稿")).content,VALID);
	assert.equal((await getPrivateDraft(store,"我的草稿")).extension,"mdx");
	assert.equal((await listPrivateDraftRevisions(store,"我的草稿")).items.length,1);
	assert.equal(r2.objects.size,1);
});

test("atomic SQL UPDATE rejects a stale expectedVersion and preserves current source",async()=>{
	const store=createD1PrivateDraftStore(mockD1()),r2=mockR2();
	const first=await savePrivateDraft(store,{slug:"conflict",content:VALID},r2);
	const second=await savePrivateDraft(store,{slug:"conflict",content:VALID+"new",expectedVersion:first.version},r2);
	const oldContent=await getPrivateDraft(store,"conflict");
	assert.equal(oldContent.version,second.version);
	// Simulate a simultaneous writer whose SELECT happened before the first update.
	const record={schema:1,slug:"conflict",version:crypto.randomUUID(),content:VALID+"stale",extension:"md",updatedAt:new Date().toISOString()};
	await rejects409(()=>store.put("draft:v1:conflict",JSON.stringify(record),{
		expectedVersion:first.version,
		metadata:{version:record.version,title:"旧草稿",updatedAt:record.updatedAt,extension:"md"},
	}));
	assert.equal((await getPrivateDraft(store,"conflict")).content,oldContent.content);
});

test("atomic SQL DELETE cannot delete a newer version",async()=>{
	const store=createD1PrivateDraftStore(mockD1()),r2=mockR2();
	const first=await savePrivateDraft(store,{slug:"delete-safe",content:VALID},r2);
	const second=await savePrivateDraft(store,{slug:"delete-safe",content:VALID+"new",expectedVersion:first.version},r2);
	await rejects409(()=>store.delete("draft:v1:delete-safe",{expectedVersion:first.version}));
	assert.equal((await getPrivateDraft(store,"delete-safe")).version,second.version);
	await deletePrivateDraft(store,"delete-safe",second.version,r2);
	await assert.rejects(()=>getPrivateDraft(store,"delete-safe"),err=>err.status===404);
	const older=await getPrivateDraftRevision(store,"delete-safe",first.version);
	assert.equal(older.content,VALID);
});

test("D1 current records and immutable history expose independent paginated lists",async()=>{
	const store=createD1PrivateDraftStore(mockD1()),r2=mockR2();
	for(let i=0;i<104;i++){
		await savePrivateDraft(store,{slug:"n"+i,content:VALID},r2);
	}
	const first=await store.list({prefix:"draft:v1:",limit:100});
	assert.equal(first.keys.length,100);
	assert.equal(first.list_complete,false);
	const next=await store.list({prefix:"draft:v1:",cursor:first.cursor,limit:100});
	assert.equal(next.keys.length,4);
	assert.equal(next.list_complete,true);
	await assert.rejects(()=>store.list({prefix:"draft:v1:",cursor:"bad"}),err=>err.status===400);
});

test("D1 does not activate unless explicitly selected; legacy KV remains default",()=>{
	const kv={get(){},put(){},delete(){},list(){}};
	assert.equal(resolvePrivateDraftStore({FIREFLY_PRIVATE_DRAFTS:kv}),kv);
	const db=mockD1();
	assert.notEqual(resolvePrivateDraftStore({FIREFLY_PRIVATE_DRAFTS:kv,FIREFLY_PRIVATE_DRAFT_DB:db,FIREFLY_PRIVATE_DRAFT_BACKEND:"d1"}),kv);
	assert.throws(
		()=>resolvePrivateDraftStore({FIREFLY_PRIVATE_DRAFTS:kv,FIREFLY_PRIVATE_DRAFT_BACKEND:"d1"}),
		err=>err.status===503,
	);
});

test("migration is guarded and never deletes original KV records",()=>{
	const source=readFileSync(new URL("../src/pages/api/admin/private-draft-migration.ts",import.meta.url),"utf8");
	assert.ok(source.includes('FIREFLY_PRIVATE_DRAFT_MIGRATION_MODE !== "true"'));
	assert.ok(source.includes("source.version !== details.version"));
	assert.ok(source.includes("await ensurePrivateR2Backup(r2, source)"));
	assert.ok(!source.includes("legacy.delete("));
});
