import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { auditPrivateDraftBackups } = await import(
	"../src/lib/private-draft-backup-audit.ts"
);
const { privateBackupKey } = await import(
	"../src/lib/private-draft-r2-backup.ts"
);
const {
	savePrivateDraft,
	deletePrivateDraft,
} = await import("../src/lib/private-drafts.ts");

const MARKDOWN = '---\ntitle: "保密笔记"\npublished: 2026-10-21\ndraft: true\n---\n\n<Badge>Private MDX</Badge>';

function mockKV() {
	const records = new Map();
	const metadata = new Map();
	return {
		records,
		metadata,
		async get(key) { return records.get(key) ?? null; },
		async put(key, value, options) {
			records.set(key, value);
			if (options?.metadata) metadata.set(key, options.metadata);
		},
		async delete(key) { records.delete(key); metadata.delete(key); },
		async list({ prefix, cursor, limit = 100 }) {
			const items = [...records.keys()].filter((key) => key.startsWith(prefix)).sort();
			const offset = Number(cursor || 0);
			const page = items.slice(offset, offset + limit);
			return {
				keys: page.map((name) => ({ name, metadata: metadata.get(name) })),
				list_complete: offset + page.length >= items.length,
				cursor: offset + page.length < items.length ? String(offset + page.length) : undefined,
			};
		},
	};
}
function mockR2() {
	const records = new Map();
	return {
		records,
		async get(key) {
			if (!records.has(key)) return null;
			return { async text() { return records.get(key); } };
		},
		async put(key, value, options) {
			assert.equal(options?.onlyIf?.etagDoesNotMatch, "*");
			if (records.has(key)) return null;
			records.set(key, value);
			return { key };
		},
		async list({ prefix, cursor, limit = 100 }) {
			const all = [...records.keys()].filter((key) => key.startsWith(prefix)).sort();
			const start = Number(cursor || 0);
			const objects = all.slice(start, start + limit).map((key) => ({ key }));
			return {
				objects,
				truncated: start + objects.length < all.length,
				cursor: String(start + objects.length),
			};
		},
	};
}

test("valid current MDX and saved history are read-only verified without showing content", async () => {
	const store = mockKV(), backup = mockR2();
	const first = await savePrivateDraft(store, { slug: "study", content: MARKDOWN, extension: "mdx" }, backup);
	await savePrivateDraft(store, {
		slug: "study", content: MARKDOWN + "\nnew",
		extension: "mdx", expectedVersion: first.version,
	}, backup);
	const before = [...store.records.entries()];
	const audit = await auditPrivateDraftBackups(store, backup, "study");
	assert.equal(audit.status, "verified");
	assert.equal(audit.versionsChecked, 2);
	assert.equal(audit.issues.length, 0);
	assert.equal(audit.recoverableR2OnlyVersions, 0);
	assert.deepEqual([...store.records.entries()], before);
	assert.ok(!JSON.stringify(audit).includes("Private MDX"));
	assert.ok(!JSON.stringify(audit).includes(MARKDOWN));
});

test("missing or corrupted R2 snapshots are reported, never repaired by the audit", async () => {
	const store = mockKV(), backup = mockR2();
	const first = await savePrivateDraft(store, { slug: "missing", content: MARKDOWN }, backup);
	const key = privateBackupKey("missing", first.version);
	backup.records.delete(key);
	const firstAudit = await auditPrivateDraftBackups(store, backup, "missing");
	assert.equal(firstAudit.status, "attention");
	assert.ok(firstAudit.issues.some((item) => item.code === "missing_r2"));
	assert.equal(backup.records.has(key), false);
	backup.records.set(key, "{bad json");
	const secondAudit = await auditPrivateDraftBackups(store, backup, "missing");
	assert.equal(secondAudit.status, "attention");
	assert.ok(secondAudit.issues.some((item) => item.code === "r2_corrupt"));
	assert.equal(backup.records.get(key), "{bad json");
});

test("version mismatch and malformed historical KV record trigger attention", async () => {
	const store = mockKV(), backup = mockR2();
	const first = await savePrivateDraft(store, { slug: "mismatch", content: MARKDOWN }, backup);
	const key = privateBackupKey("mismatch", first.version);
	const r2 = JSON.parse(backup.records.get(key));
	backup.records.set(key, JSON.stringify({ ...r2, content: MARKDOWN + "\nchanged" }));
	const mismatch = await auditPrivateDraftBackups(store, backup, "mismatch");
	assert.equal(mismatch.status, "attention");
	assert.ok(mismatch.issues.some((item) => item.code === "version_mismatch"));
	backup.records.set(key, JSON.stringify(r2));
	store.records.set("draft-history:v1:mismatch:" + first.version, "{broken json");
	const invalid = await auditPrivateDraftBackups(store, backup, "mismatch");
	assert.equal(invalid.status, "attention");
	assert.ok(invalid.issues.some((item) => item.code === "kv_history_corrupt"));
});

test("deleted current draft can still be audited against retained R2 history", async () => {
	const store = mockKV(), backup = mockR2();
	const first = await savePrivateDraft(store, { slug: "deleted", content: MARKDOWN }, backup);
	await deletePrivateDraft(store, "deleted", first.version, backup);
	const report = await auditPrivateDraftBackups(store, backup, "deleted");
	assert.equal(report.currentPresent, false);
	assert.equal(report.status, "verified");
	assert.equal(report.versionsChecked, 1);
});

test("R2-only orphan is counted as recoverable rather than silently discarded", async () => {
	const store = mockKV(), backup = mockR2();
	const record = {
		schema: 1, slug: "orphan", version: crypto.randomUUID(),
		updatedAt: new Date().toISOString(), content: MARKDOWN, extension: "md",
	};
	backup.records.set(privateBackupKey("orphan", record.version), JSON.stringify(record));
	const report = await auditPrivateDraftBackups(store, backup, "orphan");
	assert.equal(report.status, "verified");
	assert.equal(report.recoverableR2OnlyVersions, 1);
	assert.equal(report.currentPresent, false);
});

test("too many versions return incomplete without claiming backup integrity", async () => {
	const store = mockKV(), backup = mockR2();
	for (let i = 0; i < 13; i++) {
		const id = "00000000-0000-4000-8000-" + String(i).padStart(12, "0");
		store.records.set("draft-history:v1:large:" + id, "{}");
	}
	const report = await auditPrivateDraftBackups(store, backup, "large");
	assert.equal(report.status, "incomplete");
	assert.equal(report.versionsChecked, 0);
	assert.ok(report.notice.includes("上限"));
});

test("audit detects a concurrent modification of the current record", async () => {
	const store = mockKV(), backup = mockR2();
	const first = await savePrivateDraft(store, { slug: "race", content: MARKDOWN }, backup);
	let reads = 0;
	const original = store.get.bind(store);
	store.get = async (key, type) => {
		if (key === "draft:v1:race" && ++reads === 2) {
			const row = JSON.parse(store.records.get(key));
			store.records.set(key, JSON.stringify({ ...row, content: MARKDOWN + "\nchanged" }));
		}
		return original(key, type);
	};
	const report = await auditPrivateDraftBackups(store, backup, "race");
	assert.equal(report.status, "incomplete");
	assert.ok(report.issues.some((item) => item.code === "current_changed"));
	assert.equal(first.version.length, 36);
});

test("audit endpoint stays authenticated, read-only, and never exposes stored content", () => {
	const route = readFileSync(new URL("../src/pages/api/admin/private-draft-audit.ts", import.meta.url), "utf8");
	const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
	assert.ok(route.includes("export const GET: APIRoute"));
	assert.ok(!route.includes("export const POST"));
	assert.ok(!route.includes("ensurePrivateR2Backup"));
	assert.ok(middleware.includes('pathname.startsWith("/api/admin/")'));
});
