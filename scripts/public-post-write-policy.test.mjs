import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { isPublicGitHubDraft } = await import("../src/lib/public-post-write-policy.ts");

const md = fm => "---\n"+fm+"\n---\n\n# Example\n";
test("block draft-marked Markdown/MDX before public GitHub writes",()=>{
  assert.equal(isPublicGitHubDraft(md("draft: true")),true);
  assert.equal(isPublicGitHubDraft(md("draft: TRUE # hidden")),true);
  assert.equal(isPublicGitHubDraft(md("draft: !!bool true")),true);
  assert.equal(isPublicGitHubDraft(md('title: "A"\ndraft: true')),true);
  assert.equal(isPublicGitHubDraft(md("draft: false")),false);
  assert.equal(isPublicGitHubDraft(md("title: Public\ndraft: false")),false);
  assert.equal(isPublicGitHubDraft(md("title: Public")),false);
});
test("reject an invalid frontmatter with a visible draft flag",()=>{
  assert.equal(isPublicGitHubDraft(md("draft: true\ndraft: false")),true);
  assert.equal(isPublicGitHubDraft(md("draft: [not valid")),true);
  assert.equal(isPublicGitHubDraft("# Body\ndraft: true"),false);
});
test("public articles API checks both create and update before GitHub writes",()=>{
  const source=readFileSync(new URL("../src/pages/api/admin/articles.ts",import.meta.url),"utf8");
  const occurrences=source.match(/isPublicGitHubDraft\(content\)/g)??[];
  assert.equal(occurrences.length,2,"both POST and PUT must enforce public draft policy");
});
test("legacy admin new-page draft submit uses private API, public only for publish",()=>{
  const source=readFileSync(new URL("../src/pages/admin/new.astro",import.meta.url),"utf8");
  assert.ok(source.includes('if(mode==="draft"){'));
  assert.ok(source.includes('fetch("/api/admin/private-drafts/"'));
  assert.ok(source.includes('api("POST",{...details,draft:false})'));
});
