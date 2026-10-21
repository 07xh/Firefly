import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { createD1PrivateDraftStore } = await import("../src/lib/private-draft-d1.ts");
const { copyPrivateDraftWithHistory } = await import("../src/lib/private-draft-migration-copy.ts");
const { privateBackupKey } = await import("../src/lib/private-draft-r2-backup.ts");
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
	assert.ok(source.includes("copyPrivateDraftWithHistory("));
	assert.ok(!source.includes("savePrivateDraft(d1,"));
	assert.ok(!source.includes("legacy.delete("));
});

test("KV-to-D1 transfer retains every historical revision and R2-only orphan",async()=>{
	const source=createD1PrivateDraftStore(mockD1());
	const destination=createD1PrivateDraftStore(mockD1());
	const r2=mockR2();
	const first=await savePrivateDraft(source,{slug:"study",content:VALID},r2);
	const second=await savePrivateDraft(source,{
		slug:"study",content:VALID+"\nSECOND",expectedVersion:first.version,
	},r2);
	const orphan={
		schema:1,slug:"study",version:crypto.randomUUID(),updatedAt:new Date().toISOString(),
		content:VALID+"\nORPHAN_IN_R2_ONLY",extension:"md"
	};
	r2.objects.set(privateBackupKey(orphan.slug,orphan.version),JSON.stringify(orphan));
	const migrated=await copyPrivateDraftWithHistory(source,destination,r2,"study",second.version);
	assert.equal(migrated.historyVersionsCopied,3);
	assert.equal(migrated.kvSourcePreserved,true);
	assert.equal((await getPrivateDraft(source,"study")).version,second.version);
	assert.equal((await getPrivateDraft(destination,"study")).content,VALID+"\nSECOND");
	assert.equal((await getPrivateDraftRevision(destination,"study",first.version)).content,VALID);
	assert.equal((await getPrivateDraftRevision(destination,"study",second.version)).content,VALID+"\nSECOND");
	assert.equal((await getPrivateDraftRevision(destination,"study",orphan.version)).content,orphan.content);
	assert.equal((await listPrivateDraftRevisions(destination,"study")).items.length,4);
	await rejects409(()=>copyPrivateDraftWithHistory(source,destination,r2,"study",second.version));
});

test("KV/R2 history mismatch aborts before creating the D1 live record",async()=>{
	const source=createD1PrivateDraftStore(mockD1());
	const destination=createD1PrivateDraftStore(mockD1());
	const r2=mockR2();
	const one=await savePrivateDraft(source,{slug:"mismatch",content:VALID},r2);
	const key=privateBackupKey("mismatch",one.version);
	const tampered={...JSON.parse(r2.objects.get(key)),content:VALID+"\nCHANGED"};
	r2.objects.set(key,JSON.stringify(tampered));
	await rejects409(()=>copyPrivateDraftWithHistory(source,destination,r2,"mismatch",one.version));
	assert.equal(await destination.get("draft:v1:mismatch","text"),null);
	assert.equal((await getPrivateDraft(source,"mismatch")).version,one.version);
});

test("history-copy failure preserves old KV source and prevents D1 main record",async()=>{
	const source=createD1PrivateDraftStore(mockD1());
	const destination=createD1PrivateDraftStore(mockD1());
	const r2=mockR2();
	const one=await savePrivateDraft(source,{slug:"failure",content:VALID},r2);
	const failDest={
		...destination,
		async put(key,value,options){
			if(key.startsWith("draft-history:"))throw new Error("simulated D1 outage");
			return destination.put(key,value,options);
		},
	};
	await assert.rejects(
		()=>copyPrivateDraftWithHistory(source,failDest,r2,"failure",one.version),
		/simulated D1 outage/,
	);
	assert.equal(await destination.get("draft:v1:failure","text"),null);
	assert.equal((await getPrivateDraft(source,"failure")).content,VALID);
});

test("migration refuses over-limit history instead of silently dropping old versions",async()=>{
	const source=createD1PrivateDraftStore(mockD1());
	const destination=createD1PrivateDraftStore(mockD1());
	const r2=mockR2();
	let current=await savePrivateDraft(source,{slug:"longhistory",content:VALID},r2);
	for(let i=1;i<41;i++){
		current=await savePrivateDraft(source,{
			slug:"longhistory",
			content:VALID+"\nHISTORY_"+i,
			expectedVersion:current.version,
		},r2);
	}
	await assert.rejects(
		()=>copyPrivateDraftWithHistory(source,destination,r2,"longhistory",current.version),
		err=>err instanceof PrivateDraftError && err.status===413,
	);
	assert.equal(await destination.get("draft:v1:longhistory","text"),null);
	assert.equal((await getPrivateDraft(source,"longhistory")).version,current.version);
});

test("KV to D1 migration refuses malformed R2 filenames without changing the source", async () => {
	const source = createD1PrivateDraftStore(mockD1());
	const destination = createD1PrivateDraftStore(mockD1());
	const backup = mockR2();
	const original = await savePrivateDraft(source, { slug: "unknown-backup", content: VALID }, backup);
	backup.objects.set(
		"private-draft-backups/v1/unknown-backup/INVALID_REVISION.json",
		"{}",
	);
	await assert.rejects(
		() => copyPrivateDraftWithHistory(source, destination, backup, "unknown-backup", original.version),
		(error) => error instanceof PrivateDraftError && error.status === 503,
	);
	assert.equal(await destination.get("draft:v1:unknown-backup", "text"), null);
	assert.equal((await getPrivateDraft(source, "unknown-backup")).version, original.version);
});

test("migration refuses an incomplete legacy KV history page and preserves both stores", async () => {
	const legacy = createD1PrivateDraftStore(mockD1());
	const destination = createD1PrivateDraftStore(mockD1());
	const backup = mockR2();
	const original = await savePrivateDraft(legacy, { slug: "truncated-kv", content: VALID }, backup);
	const source = {
		...legacy,
		async list(options) {
			if (options.prefix === "draft-history:v1:truncated-kv:") {
				return { keys: [], list_complete: false };
			}
			return legacy.list(options);
		},
	};
	await assert.rejects(
		() => copyPrivateDraftWithHistory(source, destination, backup, "truncated-kv", original.version),
		(error) => error instanceof PrivateDraftError && error.status === 503,
	);
	assert.equal(await destination.get("draft:v1:truncated-kv", "text"), null);
	assert.equal((await getPrivateDraft(legacy, "truncated-kv")).version, original.version);
});

test("D1 rejects inconsistent indexed metadata and unmarked draft records without touching rows", async () => {
	const db = mockD1();
	const store = createD1PrivateDraftStore(db);
	const version = crypto.randomUUID();
	const record = {
		schema: 1, slug: "metadata", version, extension: "mdx",
		updatedAt: "2026-10-21T00:00:00.000Z", content: VALID,
	};
	const metadata = {
		version, extension: "mdx", updatedAt: record.updatedAt, title: "原稿",
	};
	const cases = [
		{ record: { ...record, extension: "md" }, metadata },
		{ record, metadata: { ...metadata, extension: "md" } },
		{ record: { ...record, updatedAt: "2026-10-20T00:00:00.000Z" }, metadata },
		{ record, metadata: { ...metadata, updatedAt: "2026-10-22T00:00:00.000Z" } },
		{ record: { ...record, schema: 2 }, metadata },
		{ record: { ...record, content: VALID.replace("draft: true", "draft: false") }, metadata },
		{ record: { ...record, content: VALID + "x".repeat(501_000) }, metadata },
		{ record: { ...record, version: "not-a-uuid" }, metadata },
		{ record, metadata: { ...metadata, version: crypto.randomUUID() } },
	];
	for (const [index, variation] of cases.entries()) {
		const key = "draft:v1:metadata";
		await assert.rejects(
			() => store.put(key, JSON.stringify(variation.record), {
				metadata: variation.metadata,
				expectedVersion: null,
			}),
			(error) => error instanceof PrivateDraftError && error.status === 400,
			"invalid current case " + index,
		);
		assert.equal(await store.get(key, "text"), null);
		await assert.rejects(
			() => store.put("draft-history:v1:metadata:" + version,
				JSON.stringify(variation.record), { metadata: variation.metadata }),
			(error) => error instanceof PrivateDraftError && error.status === 400,
			"invalid history case " + index,
		);
		assert.equal(
			await store.get("draft-history:v1:metadata:" + version, "text"),
			null,
		);
	}
});

test("two simultaneously editing sessions cannot both overwrite the same D1 version", async () => {
	const actual = createD1PrivateDraftStore(mockD1());
	const backup = mockR2();
	const initial = await savePrivateDraft(actual, {
		slug: "race", content: VALID, extension: "mdx",
	}, backup);
	const original = await getPrivateDraft(actual, "race");
	let reads = 0;
	let releaseBoth;
	const bothRead = new Promise((resolve) => { releaseBoth = resolve; });
	const racingStore = {
		...actual,
		async get(key, type) {
			const result = await actual.get(key, type);
			if (key === "draft:v1:race") {
				reads++;
				if (reads === 2) releaseBoth();
				await bothRead;
			}
			return result;
		},
	};
	const outcomes = await Promise.allSettled([
		savePrivateDraft(racingStore, {
			slug: "race", content: VALID + "\nWRITER_A", extension: "mdx",
			expectedVersion: initial.version,
		}, backup),
		savePrivateDraft(racingStore, {
			slug: "race", content: VALID + "\nWRITER_B", extension: "mdx",
			expectedVersion: initial.version,
		}, backup),
	]);
	assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
	const failed = outcomes.find((x) => x.status === "rejected");
	assert.ok(failed.reason instanceof PrivateDraftError);
	assert.equal(failed.reason.status, 409);
	const current = await getPrivateDraft(actual, "race");
	assert.equal(current.extension, "mdx");
	assert.notEqual(current.version, initial.version);
	assert.ok([VALID + "\nWRITER_A", VALID + "\nWRITER_B"].includes(current.content));
	assert.equal((await getPrivateDraftRevision(actual, "race", initial.version)).content, original.content);
	assert.equal(backup.objects.get(privateBackupKey("race", initial.version)), JSON.stringify(original));
	assert.equal(backup.objects.size, 3, "losing writer may leave an immutable R2 snapshot");
});

test("D1 outage after independent R2 backup leaves existing current MDX unchanged", async () => {
	const actual = createD1PrivateDraftStore(mockD1());
	const backup = mockR2();
	const first = await savePrivateDraft(actual, { slug: "outage", content: VALID, extension: "mdx" }, backup);
	const prior = await getPrivateDraft(actual, "outage");
	const unavailableStore = {
		...actual,
		async put(key, value, options) {
			if (key === "draft:v1:outage") throw new Error("simulated D1 outage");
			return actual.put(key, value, options);
		},
	};
	await assert.rejects(
		() => savePrivateDraft(unavailableStore, {
			slug: "outage", content: VALID + "\nUNSAVED_MD_X",
			extension: "mdx", expectedVersion: first.version,
		}, backup),
		/simulated D1 outage/,
	);
	assert.deepEqual(await getPrivateDraft(actual, "outage"), prior);
	assert.equal(backup.objects.get(privateBackupKey("outage", first.version)), JSON.stringify(prior));
	assert.equal(backup.objects.size, 2, "new failed-at-CAS copy may remain in R2 for manual recovery");
});

test("corrupted existing D1 column indexes are rejected on read without changing stored MDX", async () => {
	const database = mockD1();
	const store = createD1PrivateDraftStore(database);
	const backup = mockR2();
	const first = await savePrivateDraft(store, {
		slug: "damaged-index", content: VALID, extension: "mdx",
	}, backup);
	const key = "draft:v1:damaged-index";
	const rawBefore = (await database.prepare(
		"SELECT record FROM private_drafts WHERE slug = ?",
	).bind("damaged-index").first()).record;
	await database.prepare(
		"UPDATE private_drafts SET extension = ? WHERE slug = ?",
	).bind("md", "damaged-index").run();
	await assert.rejects(
		() => getPrivateDraft(store, "damaged-index"),
		(error) => error instanceof PrivateDraftError && error.status === 500,
	);
	assert.equal(
		(await database.prepare("SELECT record FROM private_drafts WHERE slug = ?")
			.bind("damaged-index").first()).record,
		rawBefore,
		"failed D1 read must not repair or alter original content",
	);
	await assert.rejects(
		() => savePrivateDraft(store, {
			slug: "damaged-index", content: VALID + "\nedit",
			extension: "md", expectedVersion: first.version,
		}, backup),
		(error) => error instanceof PrivateDraftError && error.status === 500,
	);
	await database.prepare(
		"UPDATE private_drafts SET extension = ?, updated_at = ? WHERE slug = ?",
	).bind("mdx", "wrong-date", "damaged-index").run();
	await assert.rejects(
		() => getPrivateDraft(store, "damaged-index"),
		(error) => error instanceof PrivateDraftError && error.status === 500,
	);
	await database.prepare(
		"UPDATE private_drafts SET updated_at = ? WHERE slug = ?",
	).bind(JSON.parse(rawBefore).updatedAt, "damaged-index").run();
	assert.equal((await getPrivateDraft(store, "damaged-index")).content, VALID);
	await database.prepare(
		"UPDATE private_draft_revisions SET extension = ? WHERE slug = ? AND version = ?",
	).bind("md", "damaged-index", first.version).run();
	await assert.rejects(
		() => getPrivateDraftRevision(store, "damaged-index", first.version),
		(error) => error instanceof PrivateDraftError && error.status === 500,
	);
	assert.equal(await store.get(key, "text"), rawBefore);
});

test("migration rejects overlapping KV history pages without creating D1 current record", async () => {
	const legacy = createD1PrivateDraftStore(mockD1());
	const destination = createD1PrivateDraftStore(mockD1());
	const backup = mockR2();
	const first = await savePrivateDraft(legacy, {
		slug: "kv-overlap", content: VALID, extension: "mdx",
	}, backup);
	const source = {
		...legacy,
		async list(options) {
			if (options.prefix !== "draft-history:v1:kv-overlap:") {
				return legacy.list(options);
			}
			const result = await legacy.list({ ...options, cursor: undefined });
			// Different valid cursors can still deliver the SAME history key.
			return {
				keys: result.keys,
				list_complete: options.cursor === "next",
				cursor: options.cursor ? undefined : "next",
			};
		},
	};
	await assert.rejects(
		() => copyPrivateDraftWithHistory(
			source, destination, backup, "kv-overlap", first.version,
		),
		(error) => error instanceof PrivateDraftError && error.status === 503,
	);
	assert.equal(await destination.get("draft:v1:kv-overlap", "text"), null);
	assert.equal((await getPrivateDraft(legacy, "kv-overlap")).version, first.version);
	assert.equal((await getPrivateDraft(legacy, "kv-overlap")).content, VALID);
});

test("migration rejects repeated R2 versions across pages without modifying KV or D1", async () => {
	const source = createD1PrivateDraftStore(mockD1());
	const destination = createD1PrivateDraftStore(mockD1());
	const backup = mockR2();
	const first = await savePrivateDraft(source, {
		slug: "r2-overlap", content: VALID, extension: "mdx",
	}, backup);
	const original = await getPrivateDraft(source, "r2-overlap");
	const snapshot = new Map(backup.objects);
	const key = privateBackupKey("r2-overlap", first.version);
	backup.list = async ({ prefix, cursor }) => ({
		objects: key.startsWith(prefix) ? [{ key }] : [],
		truncated: !cursor,
		cursor: cursor ? undefined : "next",
	});
	await assert.rejects(
		() => copyPrivateDraftWithHistory(
			source, destination, backup, "r2-overlap", first.version,
		),
		(error) => error instanceof PrivateDraftError && error.status === 503,
	);
	assert.equal(await destination.get("draft:v1:r2-overlap", "text"), null);
	assert.deepEqual(await getPrivateDraft(source, "r2-overlap"), original);
	assert.deepEqual(backup.objects, snapshot);
});
