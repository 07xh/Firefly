/** Read-only projection of approved repository image files for the admin media panel. */
export type MediaTreeEntry = {
	path: string;
	type: string;
	sha?: string;
	size?: number;
};

export type AdminMediaItem = {
	name: string;
	path: string;
	size: number | null;
	url: string;
};

const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const SAFE_IMAGE_PATH = /^(?:src\/assets\/images|public\/(?:images|uploads))\/[^\0]+$/;
const LIMIT = 2000;

export function selectAdminMediaItems(
	tree: readonly MediaTreeEntry[],
	repository: string,
	revision: string,
): AdminMediaItem[] {
	if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
		throw new Error("Invalid media repository");
	}
	if (!/^[\w./-]+$/.test(revision) || revision.includes("..")) {
		throw new Error("Invalid repository revision");
	}
	const [owner, name] = repository.split("/");
	const items: AdminMediaItem[] = [];
	for (const entry of tree) {
		if (entry.type !== "blob" || !SAFE_IMAGE_PATH.test(entry.path)) continue;
		if (entry.path.includes("..") || entry.path.includes("\\") || !IMAGE_EXTENSION.test(entry.path)) continue;
		const filename = entry.path.split("/").pop() ?? "";
		if (!filename || filename.startsWith(".")) continue;
		items.push({
			name: filename,
			path: entry.path,
			size: typeof entry.size === "number" && Number.isSafeInteger(entry.size) && entry.size >= 0 ? entry.size : null,
			url: [
				"https://raw.githubusercontent.com",
				encodeURIComponent(owner),
				encodeURIComponent(name),
				encodeURIComponent(revision),
				...entry.path.split("/").map(encodeURIComponent),
			].join("/"),
		});
		if (items.length > LIMIT) throw new Error("图片文件数量超过安全上限，已停止不完整列表");
	}
	return items.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
}
