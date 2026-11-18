import assert from "node:assert/strict";
import { test } from "node:test";

const repo = (name, props = {}) => ({
	name,
	owner: { login: "07xh" },
	private: false,
	visibility: "public",
	...props,
});

test("retries the public GitHub search after primary rate limiting and filters listings", async (t) => {
	const requests = [];
	t.mock.method(globalThis, "fetch", async (url, options) => {
		requests.push(new URL(url));
		assert.equal(options.headers.Authorization, undefined);
		if (requests.length === 1) return new Response(null, { status: 403 });
		assert.equal(
			requests.at(-1).searchParams.get("q"),
			"user:07xh is:public fork:true",
		);
		return requests.length === 2
			? Response.json(
					{
						incomplete_results: false,
						items: [
							repo("public-project"),
							repo("secret", { private: true, visibility: "private" }),
							repo("internal", { visibility: "internal" }),
							repo("someone-elses", { owner: { login: "other" } }),
						],
					},
					{
						headers: {
							Link: '<https://api.github.com/search/repositories?page=2>; rel="next"',
						},
					},
				)
			: Response.json({
					incomplete_results: false,
					items: [repo("second-project")],
				});
	});

	const { GET } = await import(
		"../src/pages/api/portfolio/repositories.json.ts"
	);
	const results = await Promise.all([GET({}), GET({})]);
	for (const result of results) {
		assert.equal(result.status, 200);
		const body = await result.json();
		assert.equal(body.source, "github-search");
		assert.deepEqual(
			body.repositories.map(({ name }) => name),
			["public-project", "second-project"],
		);
	}
	assert.deepEqual(
		requests.map(({ pathname }) => pathname),
		["/users/07xh/repos", "/search/repositories", "/search/repositories"],
	);
	await GET({});
	assert.equal(requests.length, 3);
});

test("avoids caching an incomplete search result as a public inventory", async (t) => {
	t.mock.method(globalThis, "fetch", async (url) => {
		if (new URL(url).pathname === "/users/07xh/repos")
			return new Response(null, { status: 429 });
		return Response.json({
			incomplete_results: true,
			items: [repo("some-project")],
		});
	});
	const { GET } = await import(
		"../src/pages/api/portfolio/repositories.json.ts?incomplete"
	);
	const result = await GET({});
	assert.equal(result.status, 503);
	assert.equal(result.headers.get("cache-control"), "no-store");
});
