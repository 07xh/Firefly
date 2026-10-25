import assert from "node:assert/strict";
import test from "node:test";
import { readAdminArticleMetadata } from "../src/lib/admin-article-metadata.ts";

test("supports existing Firefly unquoted YAML frontmatter and inline tags", () => {
  const meta = readAdminArticleMetadata(`---
title: Firefly 工程笔记
published: 2026-10-20
category: 文章示例
tags: [Markdown, Firefly, 博客, 主题]
draft: false
---
# Markdown Body`, "fallback.md");
  assert.deepEqual(meta, {
    title: "Firefly 工程笔记",
    published: "2026-10-20",
    date: "",
    category: "文章示例",
    tags: ["Markdown", "Firefly", "博客", "主题"],
    draft: false,
  });
});

test("supports YAML indented tag lists, quoted values, and de-duplicates tags", () => {
  const meta = readAdminArticleMetadata(`---
title: "Python \\"列表\\""
published: 2026-10-25
category: '编程''语言'
tags:
  - "AI, ML"
  - Python
  - Python
draft: true
date: "2026-10-26T08:00:00+08:00"
---
content`, "backup.mdx");
  assert.equal(meta.title, 'Python "列表"');
  assert.equal(meta.category, "编程'语言");
  assert.deepEqual(meta.tags, ["AI, ML", "Python"]);
  assert.equal(meta.draft, true);
  assert.equal(meta.date, "2026-10-26T08:00:00+08:00");
});

test("does not parse forged metadata inside Markdown body", () => {
  const meta = readAdminArticleMetadata(`---
title: Correct header
published: 2026-10-20
tags: [original]
draft: false
---
## Example source
title: Forged body
published: 2099-01-01
tags: [forged]
draft: true`, "fallback.md");
  assert.equal(meta.title, "Correct header");
  assert.deepEqual(meta.tags, ["original"]);
  assert.equal(meta.draft, false);
  assert.equal(meta.published, "2026-10-20");
});

test("preserves literal commas inside quoted inline tags", () => {
  const meta = readAdminArticleMetadata(`---
title: Tags
tags: ["AI, ML", "Python", '学习, 笔记', Python]
---
Hi`, "x.md");
  assert.deepEqual(meta.tags, ["AI, ML", "Python", "学习, 笔记"]);
});

test("does not invent published metadata when frontmatter is missing", () => {
  assert.throws(
    () => readAdminArticleMetadata("# Example\ndraft: false", "example.md"),
    /Frontmatter/,
  );
});

test("supports Windows CRLF frontmatter and never reads body metadata", () => {
  const source = "---\r\ntitle: CRLF example\r\ntags: [Windows, Markdown]\r\ndraft: false\r\n---\r\ndraft: true";
  const meta = readAdminArticleMetadata(source, "fallback.md");
  assert.equal(meta.title, "CRLF example");
  assert.deepEqual(meta.tags, ["Windows", "Markdown"]);
  assert.equal(meta.draft, false);
});

test("rejects malformed quoted tag lists rather than fabricating tags", () => {
  assert.throws(
    () => readAdminArticleMetadata("---\ntitle: Broken tags\ntags: [\"unfinished, good]\n---\n", "fallback.md"),
    /未闭合的引号/,
  );
});
