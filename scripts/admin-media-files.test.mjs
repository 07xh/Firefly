import assert from "node:assert/strict";
import test from "node:test";
import { selectAdminMediaItems } from "../src/lib/admin-media-files.ts";

test("indexes only approved public image roots and file types", () => {
	const result = selectAdminMediaItems([
		{ type: "blob", path: "src/assets/images/20261025-a.png", size: 123 },
		{ type: "blob", path: "src/assets/images/logo/main.avif", size: 456 },
		{ type: "blob", path: "public/images/photos/图 片.webp", size: 789 },
		{ type: "blob", path: "public/uploads/sticker.gif", size: 15 },
		{ type: "blob", path: "src/content/posts/draft.md" },
		{ type: "blob", path: "public/images/not-image.txt" },
		{ type: "tree", path: "src/assets/images/directory.jpg" },
		{ type: "blob", path: "src/assets/images/../secrets.jpg" },
		{ type: "blob", path: "src/assets/images/nope\\image.jpg" },
	], "07xh/Firefly", "master");
	assert.equal(result.length, 4);
	assert.ok(result.every((item) => item.url.startsWith("https://raw.githubusercontent.com/07xh/Firefly/master/")));
	assert.equal(result.find((item) => item.name === "图 片.webp")?.url.includes("%E5%9B%BE%20%E7%89%87.webp"), true);
	assert.equal(result.find((item) => item.name === "20261025-a.png")?.size, 123);
});

test("never adds non-images, nested traversal or external locations", () => {
	const result = selectAdminMediaItems([
		{ type: "blob", path: "src/assets/images/../../private.png" },
		{ type: "blob", path: "src/assets/images/readme.md" },
		{ type: "blob", path: "public/file.svg" },
		{ type: "blob", path: "public/images/.hidden.png" },
		{ type: "blob", path: "public/images/a.jpg", size: -7 },
	], "07xh/Firefly", "master");
	assert.deepEqual(result.map((item) => item.path), ["public/images/a.jpg"]);
	assert.equal(result[0].size, null);
});

test("rejects malformed repository and revision paths", () => {
	for (const repo of ["../../other", "notrepo", "owner/bad/another"]) {
		assert.throws(() => selectAdminMediaItems([], repo, "master"));
	}
	for (const ref of ["../master", "", "refs\\branch"]) {
		assert.throws(() => selectAdminMediaItems([], "07xh/Firefly", ref));
	}
});

test("sorts stable paths independent of GitHub tree input order", () => {
	const input = [
		{ type: "blob", path: "src/assets/images/b.webp" },
		{ type: "blob", path: "src/assets/images/a.webp" },
	];
	const original = [...input];
	const output = selectAdminMediaItems(input, "07xh/Firefly", "main");
	assert.deepEqual(output.map((item) => item.name), ["a.webp", "b.webp"]);
	assert.deepEqual(input, original);
});
