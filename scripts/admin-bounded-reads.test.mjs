import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mapWithConcurrency } from "../src/lib/admin-bounded-reads.ts";

test("GitHub fetch mapper never exceeds the requested concurrency limit", async () => {
	const values = Array.from({ length: 60 }, (_, i) => i);
	let active = 0;
	let peak = 0;
	const results = await mapWithConcurrency(values, 5, async (value) => {
		active++;
		peak = Math.max(peak, active);
		await Promise.resolve();
		await Promise.resolve();
		active--;
		return value * 3;
	});
	assert.equal(peak, 5);
	assert.equal(active, 0);
	assert.deepEqual(results, values.map((v) => v * 3));
});

test("mapper output stays in article order even when requests finish out of order", async () => {
	const resolveByIndex = new Map();
	const pending = mapWithConcurrency([0, 1, 2], 3, async (value) => {
		return await new Promise((resolve) => resolveByIndex.set(value, resolve));
	});
	for (const index of [2, 0, 1]) {
		resolveByIndex.get(index)("content-" + index);
	}
	assert.deepEqual(await pending, ["content-0", "content-1", "content-2"]);
});

test("empty lists and rejected mapper errors are handled predictably", async () => {
	assert.deepEqual(await mapWithConcurrency([], 5, async () => "unreachable"), []);
	await assert.rejects(
		() => mapWithConcurrency([0, 1], 2, async () => { throw new Error("GitHub unavailable"); }),
		/GitHub unavailable/,
	);
	for (const value of [0, -1, 1.5, 33, Infinity]) {
		await assert.rejects(() => mapWithConcurrency([1], value, async (x) => x), RangeError);
	}
});

test("article API uses bounded concurrency without removing summary or MDX retrieval", () => {
	const source = readFileSync(new URL("../src/pages/api/admin/articles.ts", import.meta.url), "utf8");
	assert.ok(source.includes("mapWithConcurrency(files, 5, async (file) => {"));
	assert.ok(source.includes('url.searchParams.get("summary") === "1"'));
	assert.ok(source.includes("return json(await readPost(requestedPath, config))"));
	assert.ok(source.includes("posts.sort("));
});
