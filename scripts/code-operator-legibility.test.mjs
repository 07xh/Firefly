import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const markdownCss = readFileSync(new URL("../src/styles/markdown.css", import.meta.url), "utf8");
const highlightedCss = readFileSync(new URL("../src/styles/expressive-code.css", import.meta.url), "utf8");
const symbolsArticle = readFileSync(new URL("../src/content/posts/Python2.md", import.meta.url), "utf8");

test("inline Markdown code disables ligatures without replacing its font", () => {
  assert.match(markdownCss, /code\s*\{[^}]*font-family:\s*var\(/);
  assert.match(markdownCss, /code\s*\{[^}]*font-variant-ligatures:\s*none\s*;/);
  assert.match(markdownCss, /code\s*\{[^}]*font-feature-settings:\s*"liga" 0,\s*"clig" 0,\s*"calt" 0,\s*"dlig" 0\s*;/);
});

test("highlighted code suppresses contextual operator ligatures", () => {
  assert.match(highlightedCss, /\.expressive-code \.frame pre,\s*\.expressive-code \.frame code,\s*\.expressive-code \.frame \.ec-code\s*\{/);
  assert.match(highlightedCss, /font-variant-ligatures:\s*none\s*;/);
  assert.match(highlightedCss, /font-feature-settings:\s*"liga" 0,\s*"clig" 0,\s*"calt" 0,\s*"dlig" 0\s*;/);
});

test("Python symbol table keeps ASCII source operators", () => {
  const backtick = String.fromCharCode(96);
  for (const symbol of ["==", "!=", ">=", "<="]) {
    assert.ok(symbolsArticle.includes("| " + backtick + symbol + backtick + " |"), "missing exact token " + symbol);
  }
  assert.doesNotMatch(symbolsArticle, /^\| [≠≥≤] \|/m);
});
