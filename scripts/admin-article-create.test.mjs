import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const routeUrl = new URL("../src/pages/api/admin/articles.ts", import.meta.url);
const helperUrl = new URL("../src/lib/admin-article-duplicates.ts", import.meta.url);
const source = stripTypeScriptTypes(readFileSync(routeUrl, "utf8"))
	.replace('import { env as workerEnv } from "cloudflare:workers";', 'const workerEnv = globalThis.__articleTestEnv;')
	.replace('from "../../../lib/admin-article-duplicates"', `from "${helperUrl.href}"`);
globalThis.__articleTestEnv = { FIREFLY_CONTENTS_TOKEN: "test-token" };
const { POST } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

function request() {
	return { request: new Request("http://localhost/api/admin/articles/", {
		method: "POST", headers: { "content-type": "application/json" },
		body: JSON.stringify({ title: "New", slug: "guide", published: "2026-10-25", body: "Hello" }),
	}) };
}

test("existing MDX path blocks creation before GitHub PUT", async () => {
	const original = globalThis.fetch;
	let writes = 0;
	globalThis.fetch = async (url, init) => {
		if (init?.method === "PUT") writes++;
		if (String(url).includes("git/trees/")) return Response.json({ tree: [{ type: "blob", path: "src/content/posts/guide.mdx", sha: "old" }] });
		return Response.json({ path: "src/content/posts/guide.mdx", sha: "old", encoding: "base64", content: btoa("---\ntitle: Old\n---\n") });
	};
	try {
		const response = await POST(request());
		assert.equal(response.status, 409);
		assert.equal((await response.json()).field, "slug");
		assert.equal(writes, 0);
	} finally { globalThis.fetch = original; }
});

test("an existing title blocks creation before GitHub PUT", async () => {
	const original = globalThis.fetch;
	let writes = 0;
	globalThis.fetch = async (url, init) => {
		if (init?.method === "PUT") writes++;
		if (String(url).includes("git/trees/")) return Response.json({ tree: [{ type: "blob", path: "src/content/posts/other.md", sha: "old" }] });
		return Response.json({ path: "src/content/posts/other.md", sha: "old", encoding: "base64", content: btoa("---\ntitle: New\n---\n") });
	};
	try {
		const response = await POST(request());
		assert.equal(response.status, 409);
		assert.equal((await response.json()).field, "title");
		assert.equal(writes, 0);
	} finally { globalThis.fetch = original; }
});

test("unrelated GitHub 422 retains safe details instead of claiming duplicate", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		if (String(url).includes("git/trees/")) return Response.json({ tree: [] });
		if (init?.method === "PUT") return Response.json({ message: "Validation Failed", errors: [{ field: "content", code: "invalid" }] }, { status: 422 });
		throw new Error("unexpected fetch");
	};
	try {
		const response = await POST(request());
		assert.equal(response.status, 502);
		assert.match((await response.json()).error, /GitHub 写入失败 \(422\)：Validation Failed（content \/ invalid）/);
	} finally { globalThis.fetch = original; }
});

test("explicit GitHub path conflict is reported as duplicate after a race", async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async (url, init) => {
		if (String(url).includes("git/trees/")) return Response.json({ tree: [] });
		if (init?.method === "PUT") return Response.json({ message: "Validation Failed", errors: [{ field: "path", code: "already_exists" }] }, { status: 422 });
		throw new Error("unexpected fetch");
	};
	try {
		const response = await POST(request());
		assert.equal(response.status, 409);
		assert.equal((await response.json()).field, "slug");
	} finally { globalThis.fetch = original; }
});

test("admin form has red duplicate feedback and blocks submit", () => {
	const html = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");
	assert.match(html, /id="articleDuplicateError"[^>]*color:#b42318/);
	assert.match(html, /const duplicateField=validateArticleDuplicate\(\);/);
	assert.match(html, /if\(duplicateField\)\{say\(\$\("articleDuplicateError"\)\.textContent,true\);/);
});
