import assert from "node:assert/strict";
import test from "node:test";
import { duplicateArticle, isGitHubPathConflict, safeGitHubMessage } from "../src/lib/admin-article-duplicates.ts";

test("checks actual markdown and MDX paths and normalized titles", () => {
	const posts = [
		{ path: "src/content/posts/guide.mdx", title: "Guide" },
		{ path: "src/content/posts/other.md", title: " Python 符号 " },
	];
	assert.equal(duplicateArticle(posts, "guide", "New"), "slug");
	assert.equal(duplicateArticle(posts, "fresh", " python 符号 "), "title");
	assert.equal(duplicateArticle(posts, "fresh", "Unique"), null);
	assert.equal(duplicateArticle(posts, "nested", "Unique"), null);
});

test("only an explicit GitHub path conflict is called a duplicate", () => {
	assert.equal(isGitHubPathConflict({ message: "Validation Failed", errors: [{ resource: "Commit", field: "path", code: "already_exists" }] }), true);
	assert.equal(isGitHubPathConflict({ message: "Validation Failed", errors: [{ resource: "Commit", field: "content", code: "invalid" }] }), false);
	assert.equal(isGitHubPathConflict({ message: "Invalid request" }), false);
});

test("GitHub details are bounded and scrubbed before display", () => {
	assert.equal(safeGitHubMessage("Bad request\nhttps://api.github.com/private?token=secret"), "Bad request [链接已隐藏]");
});
