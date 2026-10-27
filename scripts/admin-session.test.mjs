import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";

// Support Node test environments that do not expose Web Crypto globally.
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
	createSessionToken,
	storeAdminSession,
	validateAdminSession,
	sessionStorageKey,
	getSessionToken,
	sessionCookie,
	clearAdminSession,
	SESSION_TTL_SECONDS,
} = await import("../src/lib/admin-session.ts");

function createMemoryStore() {
	const entries = new Map();
	return {
		entries,
		async get(key, type) {
			assert.equal(type, "text");
			return entries.get(key) ?? null;
		},
		async put(key, value, options) {
			assert.ok(options?.expirationTtl === undefined || options.expirationTtl > 0);
			entries.set(key, value);
		},
		async delete(key) {
			entries.delete(key);
		},
	};
}

const PASSWORD = "unit-test-admin-secret-123456";
const ROTATED_PASSWORD = "unit-test-admin-secret-rotated-456";

test("valid admin session requires the password used at login", async () => {
	const store = createMemoryStore();
	const token = createSessionToken();
	assert.match(token, /^[A-Za-z0-9_-]{40,50}$/);
	await storeAdminSession(store, token, PASSWORD);
	assert.equal(await validateAdminSession(store, token, PASSWORD), true);
	assert.equal(SESSION_TTL_SECONDS, 8 * 60 * 60);

	const raw = store.entries.get(await sessionStorageKey(token));
	assert.equal(typeof raw, "string");
	assert.equal(raw.includes(PASSWORD), false);
	assert.equal(raw.includes(token), false);
	assert.match(JSON.parse(raw).authTag, /^[A-Za-z0-9_-]{43}$/);
});

test("rotating the admin password revokes old sessions without exposing a verifier", async () => {
	const store = createMemoryStore();
	const oldToken = createSessionToken();
	await storeAdminSession(store, oldToken, PASSWORD);

	assert.equal(await validateAdminSession(store, oldToken, ROTATED_PASSWORD), false);
	assert.equal(store.entries.has(await sessionStorageKey(oldToken)), false);

	const newToken = createSessionToken();
	await storeAdminSession(store, newToken, ROTATED_PASSWORD);
	assert.equal(await validateAdminSession(store, newToken, ROTATED_PASSWORD), true);
});

test("legacy sessions without password-bound proof are rejected", async () => {
	const store = createMemoryStore();
	const token = createSessionToken();
	await store.put(
		await sessionStorageKey(token),
		JSON.stringify({
			kind: "firefly-admin-session",
			createdAt: Date.now(),
			expiresAt: Date.now() + 60000,
		}),
	);
	assert.equal(await validateAdminSession(store, token, PASSWORD), false);
	assert.equal(store.entries.size, 0);
});

test("expired or tampered sessions are rejected and removed", async () => {
	const store = createMemoryStore();
	const token = createSessionToken();
	await storeAdminSession(store, token, PASSWORD);
	const key = await sessionStorageKey(token);
	const expired = JSON.parse(store.entries.get(key));
	expired.expiresAt = Date.now() - 1;
	await store.put(key, JSON.stringify(expired));
	assert.equal(await validateAdminSession(store, token, PASSWORD), false);
	assert.equal(store.entries.has(key), false);

	await storeAdminSession(store, token, PASSWORD);
	const tampered = JSON.parse(store.entries.get(key));
	tampered.authTag = "A".repeat(43);
	await store.put(key, JSON.stringify(tampered));
	assert.equal(await validateAdminSession(store, token, PASSWORD), false);
	assert.equal(store.entries.has(key), false);
});

test("session cookies use secure host-only attributes and parse correctly", () => {
	const token = createSessionToken();
	const cookie = sessionCookie(token);
	assert.match(cookie, /^__Host-firefly_session=/);
	assert.match(cookie, /; Path=\//);
	assert.match(cookie, /; HttpOnly/);
	assert.match(cookie, /; Secure/);
	assert.match(cookie, /; SameSite=Strict/);
	const request = new Request("https://example.test/admin/", {
		headers: { Cookie: cookie },
	});
	assert.equal(getSessionToken(request), token);
	const invalidRequest = new Request("https://example.test/admin/", {
		headers: { Cookie: "__Host-firefly_session=invalid" },
	});
	assert.equal(getSessionToken(invalidRequest), null);
});

test("logout removes session from storage", async () => {
	const store = createMemoryStore();
	const token = createSessionToken();
	await storeAdminSession(store, token, PASSWORD);
	await clearAdminSession(store, token);
	assert.equal(await validateAdminSession(store, token, PASSWORD), false);
});
