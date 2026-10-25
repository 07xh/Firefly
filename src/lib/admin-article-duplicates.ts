export type ExistingArticle = { path: string; title?: string };

const ROOT = "src/content/posts/";

export function duplicateArticle(posts: ExistingArticle[], slug: string, title: string): "slug" | "title" | null {
	const normalizedSlug = slug.trim().toLocaleLowerCase();
	const normalizedTitle = title.trim().toLocaleLowerCase();
	if (posts.some((post) => {
		if (!post.path.startsWith(ROOT)) return false;
		const stem = post.path.slice(ROOT.length).replace(/\.mdx?$/i, "");
		return !stem.includes("/") && stem.toLocaleLowerCase() === normalizedSlug;
	})) return "slug";
	if (normalizedTitle && posts.some((post) => post.title?.trim().toLocaleLowerCase() === normalizedTitle)) return "title";
	return null;
}

export function isGitHubPathConflict(payload: unknown): boolean {
	if (!payload || typeof payload !== "object") return false;
	const data = payload as { message?: unknown; errors?: unknown };
	if (typeof data.message === "string" && /(?:file|path).*(?:already exists|exists at this path)/i.test(data.message)) return true;
	return Array.isArray(data.errors) && data.errors.some((error) => {
		if (!error || typeof error !== "object") return false;
		const item = error as { field?: unknown; code?: unknown; message?: unknown };
		return item.field === "path" && (item.code === "already_exists" || typeof item.message === "string" && /already exists|exists at this path/i.test(item.message));
	});
}

export function safeGitHubMessage(value: unknown): string {
	if (typeof value !== "string") return "";
	return value.replace(/https?:\/\/\S+/gi, "[链接已隐藏]")
		.replace(/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]+/g, "[凭据已隐藏]")
		.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}
