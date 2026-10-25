/**
 * An admin settings editor must only write the exact GitHub blob it loaded.
 * An explicit "missing" sentinel is used when settings.json does not exist yet.
 * Do not accept wildcard/weak ETags or unquoted revisions.
 */
export type RevisionCheck =
	| { ok: true }
	| { ok: false; status: 428 | 400 | 412; error: string };

const SHA = /^[0-9a-f]{40}$/i;

export function formatSettingsRevision(sha: string | null): string {
	if (sha === null) return '"missing"';
	if (!SHA.test(sha)) throw new Error("Invalid GitHub settings blob SHA");
	return '"' + sha.toLowerCase() + '"';
}

export function checkSettingsRevision(
	ifMatch: string | null,
	currentSha: string | null,
): RevisionCheck {
	if (!ifMatch) {
		return {
			ok: false,
			status: 428,
			error: "缺少配置版本，请刷新后台配置后再保存，避免覆盖其他设备的更改。",
		};
	}
	if (!/^"(?:[0-9a-f]{40}|missing)"$/i.test(ifMatch)) {
		return { ok: false, status: 400, error: "配置版本格式不正确，请重新加载配置。" };
	}
	const expected = formatSettingsRevision(currentSha);
	if (ifMatch.toLowerCase() !== expected) {
		return {
			ok: false,
			status: 412,
			error: "全局配置已在其他设备或标签页发生变化。当前编辑内容未提交，请先备份修改并重新加载最新配置。",
		};
	}
	return { ok: true };
}
