import matter from "gray-matter";

/**
 * Reject publishing any Markdown/MDX source that is marked as a draft.
 * The public GitHub repository is not private storage.
 */
export function isPublicGitHubDraft(content: string): boolean {
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/);
	if (!fm) return false;
	// Fail closed on recognizable YAML booleans if the parser rejects malformed
	// or duplicated frontmatter fields; do not permit an accidental draft leak.
	if (/^draft:\s*(?:true|yes|on|1)(?:\s+#.*)?\s*$/im.test(fm[1])) return true;
	try {
		const parsed = matter(content).data;
		return parsed.draft === true;
	} catch {
		return false;
	}
}
