import assert from "node:assert/strict";
import test from "node:test";
import { requirePreviewOrigin, verifyAnonymousPreview } from "./verify-private-preview-auth.mjs";

const PREVIEW = "https://firefly-preview.3267597860.workers.dev/";
function mockFetcher({ statusFor = () => null, headersFor = () => ({}) } = {}) {
	const calls = [];
	const fetcher = async (url, options) => {
		const parsed = new URL(url);
		const path = parsed.pathname;
		calls.push({ path, options });
		const forced = statusFor(path);
		if (path === "/admin/login/") {
			return new Response('<form id="loginForm"></form>', {
				status: forced ?? 200,
				headers: { "content-type": "text/html", ...headersFor(path) },
			});
		}
		if (path === "/admin/" || path === "/admin/system/") {
			return new Response(null, {
				status: forced ?? 302,
				headers: {
					location: "/admin/login/?next=" + path,
					"cache-control": "private, no-store",
					...headersFor(path),
				},
			});
		}
		return new Response(JSON.stringify({ error: "Login required" }), {
			status: forced ?? 401,
			headers: {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "private, no-store",
				...headersFor(path),
			},
		});
	};
	return { fetcher, calls };
}

test("accepts only explicit Cloudflare staging/preview HTTPS hostnames", () => {
	assert.equal(requirePreviewOrigin(PREVIEW), PREVIEW.slice(0, -1));
	for (const value of [
		"", "garbage", "http://firefly-preview.3267597860.workers.dev/",
		"https://0701000.xyz/",
		"https://firefly.3267597860.workers.dev/",
		"https://preview.attacker.example/",
		"https://firefly-preview.3267597860.workers.dev/admin/",
		"https://firefly-preview.3267597860.workers.dev/?token=wrong",
		"https://username:password@firefly-preview.3267597860.workers.dev/",
		"https://firefly-preview.3267597860.workers.dev:8443/",
	]) assert.throws(() => requirePreviewOrigin(value));
});

test("anonymous checks use only GET, never credentials, and deny all protected endpoints", async () => {
	const { fetcher, calls } = mockFetcher();
	const result = await verifyAnonymousPreview(PREVIEW, fetcher);
	assert.equal(result.ok, true);
	assert.equal(result.count, 10);
	assert.equal(calls.length, 10);
	for (const call of calls) {
		assert.equal(call.options.method, "GET");
		assert.equal(call.options.credentials, "omit");
		assert.equal(call.options.redirect, "manual");
		assert.equal(call.options.cache, "no-store");
		assert.equal(call.options.body, undefined);
	}
});

test("unexpected authorized response from private draft endpoint fails closed", async () => {
	const { fetcher } = mockFetcher({
		statusFor: (path) => path === "/api/admin/private-drafts/" ? 200 : null,
	});
	await assert.rejects(() => verifyAnonymousPreview(PREVIEW, fetcher),
		/expected 401, observed 200/);
});

test("redirecting an unauthenticated private API is not mistaken for 401", async () => {
	const { fetcher } = mockFetcher({
		statusFor: (path) => path === "/api/admin/private-draft-backups/" ? 302 : null,
	});
	await assert.rejects(() => verifyAnonymousPreview(PREVIEW, fetcher), /expected 401/);
});

test("missing no-store or redirect to a non-login location fails", async () => {
	const { fetcher } = mockFetcher({
		headersFor: (path) => path === "/admin/system/"
			? { "cache-control": "public, max-age=3600" }
			: {},
	});
	await assert.rejects(() => verifyAnonymousPreview(PREVIEW, fetcher), /no-store response/);
});
