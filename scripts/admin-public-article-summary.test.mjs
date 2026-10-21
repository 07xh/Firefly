import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("public article listing keeps backward compatibility but supports summary responses",()=>{
 const source=read("../src/pages/api/admin/articles.ts");
 assert.ok(source.includes('const summariesOnly = url.searchParams.get("summary") === "1"'));
 assert.ok(source.includes("...(summariesOnly ? {} : { content: post.content })"));
 assert.ok(source.includes('requestedPath = url.searchParams.get("path")'));
 assert.ok(source.includes("return json(await readPost(requestedPath, config))"));
 assert.ok(source.includes("requestedPath.startsWith(ROOT)"));
});

test("admin list requests summaries without passing a forbidden GET body",()=>{
 const source=read("../src/pages/admin/index.astro");
 assert.ok(source.includes('api("GET",{summaries:true})'));
 assert.ok(source.includes('...(method!=="GET"&&data?{body:JSON.stringify(data)}:{})'));
 assert.ok(source.includes('api("GET",{path:a.path})'));
});

test("MDX source is fetched only after selection and version is rechecked",()=>{
 const source=read("../src/pages/admin/index.astro");
 const readIndex=source.indexOf('if(!a.isPrivate && typeof a.content!=="string")');
 const loadIndex=source.indexOf('const loaded=await api("GET",{path:a.path});',readIndex);
 const checkIndex=source.indexOf('if(loaded.sha!==a.sha||typeof loaded.content!=="string")',loadIndex);
 const chooseIndex=source.indexOf('selected=a;',checkIndex);
 assert.ok(readIndex>0&&loadIndex>readIndex&&checkIndex>loadIndex&&chooseIndex>checkIndex);
 assert.ok(source.includes("if(openSequence!==articleOpenSequence)return;"));
 assert.ok(source.includes('a.content=loaded.content;'));
});

test("public body edits still submit full Markdown/MDX and source version on PUT",()=>{
 const source=read("../src/pages/admin/index.astro");
 assert.ok(source.includes('rawContent'));
 assert.ok(source.includes('sha:'));
 const backend=read("../src/pages/api/admin/articles.ts");
 assert.ok(backend.includes("input.sha !== current.sha"));
});
