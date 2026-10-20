/**
 * Conservative checks before deleting public ImgBed media.
 *
 * References are searched in the public source repository and any accessible
 * legacy KV private drafts. If a relevant source cannot be inspected, deletion
 * fails closed. This does not remove the need for a proper image recycle bin.
 */

export interface ImgBedReferenceSource {
	listArticles(): Promise<Array<{ path: string; content: string }>>;
	listPrivateDrafts(): Promise<Array<{ path: string; content: string }>>;
}

export function imageReferenceTokens(baseUrl: string, name: string): string[] {
	const base = new URL(baseUrl);
	const parts = name.split("/").map((part) => encodeURIComponent(part)).join("/");
	const canonical = new URL("file/" + parts, base).toString();
	let decoded = canonical;
	try { decoded = decodeURIComponent(canonical); } catch { /* keep encoded URL */ }
	return [...new Set([canonical, decoded, "/file/" + parts, "/file/" + name])];
}

export function findImageReferences(
	sources: Array<{ path: string; content: string }>,
	baseUrl: string,
	name: string,
): string[] {
	const tokens = imageReferenceTokens(baseUrl, name);
	return sources
		.filter((source) => tokens.some((token) => source.content.includes(token)))
		.map((source) => source.path);
}

export async function assertImageNotReferenced(
	sources: ImgBedReferenceSource,
	baseUrl: string,
	name: string,
): Promise<void> {
	const [articles, drafts] = await Promise.all([
		sources.listArticles(),
		sources.listPrivateDrafts(),
	]);
	const matches = findImageReferences([...articles, ...drafts], baseUrl, name);
	if (matches.length) {
		const suffix = matches.slice(0, 8).join("、");
		throw new Error("图片仍被文章或草稿引用，禁止删除。引用位置：" + suffix);
	}
}
