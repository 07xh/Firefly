import assert from "node:assert/strict";
import test from "node:test";
import {
	checkSettingsRevision,
	formatSettingsRevision,
} from "../src/lib/admin-settings-revision.ts";

const older = "a".repeat(40);
const newer = "b".repeat(40);

test("strong ETag quotes the exact GitHub settings blob SHA", () => {
	assert.equal(formatSettingsRevision(older), '"' + older + '"');
	assert.equal(formatSettingsRevision(null), '"missing"');
	assert.throws(() => formatSettingsRevision("invalid"), /Invalid GitHub/);
});

test("same version allows save, another browser's later change refuses save", () => {
	assert.deepEqual(checkSettingsRevision('"' + older + '"', older), { ok: true });
	assert.deepEqual(checkSettingsRevision('"' + older + '"', newer), {
		ok: false,
		status: 412,
		error: "全局配置已在其他设备或标签页发生变化。当前编辑内容未提交，请先备份修改并重新加载最新配置。",
	});
});

test("no revision is a safe precondition failure", () => {
	const result = checkSettingsRevision(null, older);
	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.status, 428);
});

test("weak, wildcard and unquoted version headers are rejected", () => {
	for (const invalid of ["*", "W/" + '"' + older + '"', older, '"bad"', '"missing", "' + older + '"']) {
		const result = checkSettingsRevision(invalid, older);
		assert.equal(result.ok, false);
		if (!result.ok) assert.equal(result.status, 400);
	}
});

test("first creation only succeeds when client loaded a missing settings file", () => {
	assert.deepEqual(checkSettingsRevision('"missing"', null), { ok: true });
	const result = checkSettingsRevision('"missing"', older);
	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.status, 412);
});

test("revisions are case-insensitive hex strings but response is canonical", () => {
	assert.equal(formatSettingsRevision("A".repeat(40)), '"' + older + '"');
	assert.deepEqual(checkSettingsRevision('"' + "A".repeat(40) + '"', older), { ok: true });
});
