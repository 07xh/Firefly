import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { imgBedReleaseDenial } from "../src/lib/imgbed-release-policy.ts";

test("ImgBed stages default to disabled, preserving the existing GitHub uploader", () => {
	for (const action of ["GET", "POST", "DELETE"]) {
		assert.match(imgBedReleaseDenial({}, action), /尚未启用/);
	}
	const editor = readFileSync(new URL("../public/admin-wysiwyg.js", import.meta.url), "utf8");
	assert.ok(editor.includes('fetch("/api/admin/upload/"'), "existing editor upload API must remain unchanged");
	const existing = readFileSync(new URL("../src/pages/api/admin/upload.ts", import.meta.url), "utf8");
	assert.ok(existing.includes("export const POST"), "legacy uploader must remain available");
});

test("browsing alone cannot enable uploads or deletion", () => {
	const flags = { FIREFLY_IMGBED_ENABLED: "true" };
	assert.equal(imgBedReleaseDenial(flags, "GET"), null);
	assert.match(imgBedReleaseDenial(flags, "POST"), /上传/);
	assert.match(imgBedReleaseDenial(flags, "DELETE"), /删除/);
});

test("upload enablement never enables destructive deletion", () => {
	const flags = {
		FIREFLY_IMGBED_ENABLED: "true",
		FIREFLY_IMGBED_UPLOAD_ENABLED: "true",
	};
	assert.equal(imgBedReleaseDenial(flags, "GET"), null);
	assert.equal(imgBedReleaseDenial(flags, "POST"), null);
	assert.match(imgBedReleaseDenial(flags, "DELETE"), /删除/);
});

test("delete unlocks only through its own explicit server flag", () => {
	const flags = {
		FIREFLY_IMGBED_ENABLED: "true",
		FIREFLY_IMGBED_UPLOAD_ENABLED: "true",
		FIREFLY_IMGBED_DELETE_ENABLED: "true",
	};
	for (const method of ["GET", "POST", "DELETE"]) {
		assert.equal(imgBedReleaseDenial(flags, method), null);
	}
	assert.match(
		imgBedReleaseDenial({
			FIREFLY_IMGBED_ENABLED: "TRUE",
			FIREFLY_IMGBED_UPLOAD_ENABLED: "true",
			FIREFLY_IMGBED_DELETE_ENABLED: "true",
		}, "DELETE"),
		/尚未启用/,
	);
});

test("private ImgBed API and image management UI do not replace upload source", () => {
	const route = readFileSync(new URL("../src/pages/api/admin/imgbed.ts", import.meta.url), "utf8");
	const library = readFileSync(new URL("../src/pages/admin/images.astro", import.meta.url), "utf8");
	const main = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");
	assert.equal((route.match(/requireMediaStage\("(?:GET|POST|DELETE)"\)/g) ?? []).length, 3);
	assert.ok(route.includes("assertImageNotReferenced"));
	assert.ok(library.includes("/api/admin/imgbed"));
	assert.ok(!library.includes("/api/admin/upload"));
	assert.ok(main.includes("/admin/images/"));
});

test("ImgBed tokens are restricted to the owned HTTPS origin and upstream messages are sanitized", () => {
	const route = readFileSync(new URL("../src/pages/api/admin/imgbed.ts", import.meta.url), "utf8");
	assert.ok(route.includes('base.hostname !== "tu.0701000.xyz"'));
	assert.ok(route.includes('base.protocol !== "https:"'));
	assert.ok(route.includes("Never echo untrusted upstream error text"));
	assert.ok(!route.includes("message = body.error"));
	assert.ok(!route.includes("message = body.message"));
});
