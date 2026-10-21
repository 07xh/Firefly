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
			assert.equal(options.prefix, "draft:v1:");
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
	assert.equal(store.data.size, 1);
	assert.ok([...store.data.keys()][0].startsWith("draft:v1:"));
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
