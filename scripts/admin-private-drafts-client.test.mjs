import assert from "node:assert/strict";
import test from "node:test";

const {
  buildPrivateDraftContent,
  stripArticleFrontmatter,
  assertPublishablePrivateDraft,
  draftListEntry,
  editorSlugForArticle,
} = await import("../src/lib/admin-private-drafts-client.js");

const metadata = {
  title: "私人笔记",
  published: "2026-10-21",
  description: "新的摘要",
  category: "学习",
  tags: ["Python", "数学"],
  password: "",
  passwordHint: "",
};

test("new draft gets draft true and retains literal Markdown/MDX source", () => {
  const body = 'import Badge from "./badge"\n\n<Badge type="tip">中文</Badge>\n\n\\(x^2\\)';
  const result = buildPrivateDraftContent(body, metadata);
  assert.match(result, /^---\ntitle: "私人笔记"/);
  assert.match(result, /^draft: true$/m);
  assert.equal(stripArticleFrontmatter(result).trimStart(), body.trimStart());
  assert.match(result, /^tags: \["Python","数学"\]$/m);
});

test("editing a draft preserves unknown metadata and MDX body without conversion", () => {
  const body = '\n# Hello\n\n<Steps><Step title="One">Text</Step></Steps>\n';
  const initial = [
    "---",
    'title: "旧标题"',
    "published: 2026-10-20",
    "draft: false",
    "custom: keep-this",
    "tags: []",
    "---",
  ].join("\n") + body;
  const updated = buildPrivateDraftContent(initial, metadata);
  assert.match(updated, /^custom: keep-this$/m);
  assert.match(updated, /^draft: true$/m);
  assert.equal(updated.slice(updated.indexOf("---", 4) + 3), body);
  assert.equal(stripArticleFrontmatter(updated), body.replace(/^\n/, ""));
});

test("CRLF source stays CRLF and preserves protected body", () => {
  const source = "---\r\ntitle: old\r\npublished: 2026-10-20\r\ndraft: true\r\n---\r\n\r\n<Badge text=\"ok\" />\r\n";
  const result = buildPrivateDraftContent(source, metadata);
  assert.ok(result.includes("\r\n"));
  assert.ok(result.endsWith("\r\n\r\n<Badge text=\"ok\" />\r\n"));
  assert.match(result, /draft: true/);
});

test("publishing private content demands explicit metadata with no password", () => {
  const safe = buildPrivateDraftContent("公开内容", metadata);
  assert.doesNotThrow(() => assertPublishablePrivateDraft(safe, { ...metadata, slug: "example" }));
  assert.throws(() => assertPublishablePrivateDraft(safe, { ...metadata, slug: "example", password: "secret" }), /密码/);
  assert.throws(() => assertPublishablePrivateDraft(safe, { ...metadata, slug: "example", passwordHint: "hint" }), /密码/);
  assert.throws(() => assertPublishablePrivateDraft(safe.replace("draft: true", "unknown: hidden\ndraft: true"), { ...metadata, slug: "example" }), /额外元信息/);
  assert.throws(() => assertPublishablePrivateDraft(safe.replace("draft: true", 'password: "secret"\ndraft: true'), { ...metadata, slug: "example" }), /密码/);
});

test("private draft summaries do not carry plaintext body", () => {
  const item = draftListEntry({ slug: "note", title: "草稿", extension: "mdx", version: "uuid", content: "SECRET" });
  assert.equal(item.isPrivate, true);
  assert.equal(item.content, null);
  assert.equal(item.path, "private:note");
  assert.equal(item.extension, "mdx");
  assert.equal(item.sha, "uuid");
});

test("editor receives the original slug, never private: prefix", () => {
  const privateEntry = draftListEntry({
    slug: "我的笔记", title: "测试", extension: "mdx", version: "v1",
  });
  assert.equal(editorSlugForArticle(privateEntry), "我的笔记");
  assert.equal(editorSlugForArticle({path:"src/content/posts/notes.mdx"}), "notes");
  assert.equal(editorSlugForArticle({path:"src/content/posts/guide.md"}), "guide");
});
