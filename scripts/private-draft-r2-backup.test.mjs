import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
	ensurePrivateR2Backup,
	getPrivateR2Backup,
	listPrivateR2Backups,
	privateBackupKey,
	PrivateBackupError,
} = await import("../src/lib/private-draft-r2-backup.ts");
const {
	savePrivateDraft,
	deletePrivateDraft,
	getPrivateDraft,
	PrivateDraftError,
} = await import("../src/lib/private-drafts.ts");

const VALID = [
	"---",
	'title: "私人示例"',
	"published: 2026-10-21",
	"draft: true",
	"---",
	"",
	"THE_BACKUP_MUST_STAY_PRIVATE",
].join("\n");

function mockKV() {
	const entries = new Map();
	return {
		entries,
		async get(key) { return entries.get(key) ?? null; },
		async put(key, value) { entries.set(key, value); },
		async delete(key) { entries.delete(key); },
		async list() { return { keys: [], list_complete: true }; },
	};
}
function mockR2() {
	const objects = new Map();
	return {
		objects,
		async get(key) {
			if (!objects.has(key)) return null;
			return { async text() { return objects.get(key); } };
		},
		async put(key, value) {
			objects.set(key, value);
			return { key };
		},
		async list({ prefix, cursor, limit = 100 }) {
			const matches = [...objects.keys()].filter(key => key.startsWith(prefix));
			const offset = cursor ? Number(cursor) : 0;
			return {
				objects: matches.slice(offset, offset + limit).map(key => ({ key, uploaded: new Date("2026-10-21T00:00:00Z") })),
				truncated: offset + limit < matches.length,
				cursor: String(offset + limit),
			};
		},
	};
}

test("new private draft writes and verifies R2 backup before its KV current record", async () => {
	const kv = mockKV();
	const r2 = mockR2();
	const result = await savePrivateDraft(kv, { slug: "中文笔记", content: VALID, extension: "mdx" }, r2);
	const key = privateBackupKey("中文笔记", result.version);
	assert.ok(r2.objects.has(key));
	const current = await getPrivateDraft(kv, "中文笔记");
	assert.equal(current.content, VALID);
	assert.equal(current.extension, "mdx");
	const backup = await getPrivateR2Backup(r2, "中文笔记", result.version);
	assert.equal(backup.content, VALID);
	assert.equal(backup.extension, "mdx");
	const listing = await listPrivateR2Backups(r2, "中文笔记");
	assert.equal(listing.items.length, 1);
	assert.equal(listing.items[0].version, result.version);
});

test("updating a draft backs up both previous and new records without modifying old backup", async () => {
	const kv=mockKV(),r2=mockR2();
	const first=await savePrivateDraft(kv,{slug:"test",content:VALID},r2);
	const originalKey=privateBackupKey("test",first.version);
	const originalBackup=r2.objects.get(originalKey);
	const next=await savePrivateDraft(kv,{slug:"test",content:VALID+"\nedit",expectedVersion:first.version},r2);
	assert.equal(r2.objects.size,2);
	assert.equal(r2.objects.get(originalKey),originalBackup);
	assert.equal((await getPrivateR2Backup(r2,"test",next.version)).content,VALID+"\nedit");
});

test("failure in R2 write leaves the current KV draft untouched",async()=>{
	const kv=mockKV(),r2=mockR2();
	const first=await savePrivateDraft(kv,{slug:"safe",content:VALID},r2);
	const before=kv.entries.get("draft:v1:safe");
	r2.put=async()=>{throw new Error("simulated independent R2 outage")};
	await assert.rejects(
		()=>savePrivateDraft(kv,{slug:"safe",content:VALID+"changed",expectedVersion:first.version},r2),
		/simulated/,
	);
	assert.equal(kv.entries.get("draft:v1:safe"),before);
	await assert.rejects(()=>deletePrivateDraft(kv,"safe",first.version,r2),/simulated|R2/);
	assert.equal(kv.entries.get("draft:v1:safe"),before);
});

test("silent R2 corruption or missing confirmation prevents KV writes",async()=>{
	const kv=mockKV(),r2=mockR2();
	r2.put=async()=>({key:"accepted-but-not-persisted"});
	await assert.rejects(
		()=>savePrivateDraft(kv,{slug:"missing",content:VALID},r2),
		error=>error instanceof PrivateBackupError && error.status===503,
	);
	assert.equal(kv.entries.size,0);
});

test("conflicting already-stored R2 revision is never overwritten",async()=>{
	const r2=mockR2();
	const record={schema:1,slug:"immutable",version:"00000000-0000-4000-8000-000000000001",extension:"md",updatedAt:"2026-10-21T00:00:00Z",content:VALID};
	await ensurePrivateR2Backup(r2,record);
	const key=privateBackupKey(record.slug,record.version);
	r2.objects.set(key,JSON.stringify({...record,content:VALID+" unexpected"}));
	await assert.rejects(
		()=>ensurePrivateR2Backup(r2,record),
		error=>error instanceof PrivateBackupError && error.status===409,
	);
	assert.match(r2.objects.get(key),/unexpected/);
});

test("R2 backup can restore a deleted record with the same private draft APIs",async()=>{
	const kv=mockKV(),r2=mockR2();
	const prior=await savePrivateDraft(kv,{slug:"recover",content:VALID,extension:"mdx"},r2);
	await deletePrivateDraft(kv,"recover",prior.version,r2);
	await assert.rejects(
		()=>getPrivateDraft(kv,"recover"),
		error=>error instanceof PrivateDraftError && error.status===404,
	);
	const record=await getPrivateR2Backup(r2,"recover",prior.version);
	const result=await savePrivateDraft(kv,{slug:"recover",content:record.content,extension:record.extension},r2);
	assert.notEqual(result.version,prior.version);
	assert.equal((await getPrivateDraft(kv,"recover")).content,VALID);
});

test("R2 backups and current draft remain inaccessible without backend authorization",()=>{
	const main=readFileSync(new URL("../src/pages/api/admin/private-drafts.ts",import.meta.url),"utf8");
	const recovery=readFileSync(new URL("../src/pages/api/admin/private-draft-backups.ts",import.meta.url),"utf8");
	assert.ok(main.includes('FIREFLY_PRIVATE_DRAFT_BACKUPS'));
	assert.ok(main.includes('const backup = backupStore()'));
	assert.ok(recovery.includes('const bound = bindings()'));
	const middleware=readFileSync(new URL("../src/middleware.ts",import.meta.url),"utf8");
	assert.ok(middleware.includes('pathname.startsWith("/api/admin/")'));
});
