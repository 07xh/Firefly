import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = join(root, "src/content/posts");
const figuresDir = join(root, "public/assets/images/engineering-lessons");
const fence = String.fromCharCode(96).repeat(3);
const groups = {
  "Python·零基础系统课": [
    "python-program-writing-guide", "python-variable-deep-dive", "Python2",
    "python-how-strings-are-read", "python-boolean-truthiness-deep-dive",
    "python-loops-deep-dive", "python-zero-based-indexing-deep-dive",
    "python-list-methods-complete-guide", "python-slicing-complete-guide",
    "python-functions-from-zero", "python-format-characters", "python-f-string-guide",
  ],
  "工程制图·从投影到解题": [
    "engineering-three-view-corresponding-points", "engineering-drawing-visible-hidden-lines",
    "engineering-composite-three-views-guide", "complex-combination-silhouette-vs-occlusion",
    "combination-dimensioning-guide", "draftai-geometry-logic",
  ],
};
function article(slug) {
  const all = readFileSync(join(postsDir, slug + ".md"), "utf8");
  const match = all.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, slug + " missing frontmatter");
  return { meta: match[1], body: all.slice(match[0].length) };
}
function field(meta, key) {
  return meta.match(new RegExp("^" + key + ":\\s*(.+)$", "m"))?.[1]?.trim();
}
const known = new Set(readdirSync(postsDir).filter(n => /\.mdx?$/.test(n)).map(n => n.replace(/\.mdx?$/, "")));

test("course order, article metadata, stable URLs, and balanced markup", () => {
  const visited = new Set();
  for (const [group, slugs] of Object.entries(groups)) {
    slugs.forEach((slug, i) => {
      assert.ok(!visited.has(slug), "duplicate course entry " + slug);
      visited.add(slug);
      const {meta, body} = article(slug);
      assert.equal(field(meta, "series"), '"' + group + '"', slug);
      assert.equal(Number(field(meta, "seriesOrder")), i + 1, slug);
      assert.equal(field(meta, "draft"), "false", slug);
      assert.equal(field(meta, "lang"), "zh-CN", slug);
      assert.equal(body.split("\n").filter(line => line.startsWith(fence)).length % 2, 0, slug + " code fences");
      assert.equal((body.match(/<details\b/g) ?? []).length, (body.match(/<\/details>/g) ?? []).length, slug + " details");
      const prose = body.replace(new RegExp("^" + fence + "[^\\n]*\\n[\\s\\S]*?^" + fence + "\\s*$", "gm"), "");
      assert.doesNotMatch(prose, /^# [^\n]+$/m, slug + " duplicate H1");
      for (const m of body.matchAll(/\]\(\/posts\/([^/#?)]+)\/(?:#[^)]*)?\)/g)) {
        assert.ok(known.has(decodeURIComponent(m[1])), slug + " broken link /posts/" + m[1]);
      }
    });
  }
  assert.equal(visited.size, 18);
  assert.ok(known.has("Python2"), "preserve old URL");
  assert.ok(known.has("my-post"), "preserve old URL");
});

const svgNames = [
  "dimension-base-cylinder.svg", "dimension-through-groove.svg",
  "edge-occlusion-segments.svg", "edge-projection-overlap.svg",
];
test("all new SVG diagrams render and have accessible titles and descriptions", async () => {
  const referenced = article("engineering-drawing-visible-hidden-lines").body + article("combination-dimensioning-guide").body;
  for (const name of svgNames) {
    const path = join(figuresDir, name);
    assert.ok(existsSync(path), name);
    assert.ok(referenced.includes("/assets/images/engineering-lessons/" + name), "unreferenced " + name);
    const source = readFileSync(path);
    const svg = source.toString("utf8");
    assert.match(svg, /<svg\b[^>]+viewBox="0 0 \d+ \d+"/);
    assert.match(svg, /<title id="title">/);
    assert.match(svg, /<desc id="desc">/);
    const {data, info} = await sharp(source).png().toBuffer({resolveWithObject: true});
    assert.ok(data.length > 1500, name);
    assert.ok(info.width >= 600 && info.height >= 500, name);
  }
});
test("dimension arrows are on dedicated dimension lines", () => {
  for (const name of svgNames.slice(0, 2)) {
    const svg = readFileSync(join(figuresDir, name), "utf8");
    const arrowLines = [...svg.matchAll(/<line\b[^>]*class="dline"[^>]*marker-start="url\(#arrow\)"[^>]*marker-end="url\(#arrow\)"[^>]*\/>/g)];
    assert.ok(arrowLines.length >= 4, name + " arrowheads");
    assert.doesNotMatch(svg, /<path\b[^>]*marker-start="url\(#arrow\)"/);
    assert.match(svg, /\.center\{[^}]*stroke-dasharray:15 4 2 4/);
  }
});
test("dimension scale geometry is consistent at 5 px per millimetre", () => {
  const base = readFileSync(join(figuresDir, svgNames[0]), "utf8");
  assert.match(base, /<rect x="130" y="232" width="300" height="100" class="object"\/>/);
  assert.match(base, /<rect x="130" y="434" width="300" height="200" class="object"\/>/);
  assert.match(base, /<circle cx="280" cy="534" r="50" class="object"\/>/);
  assert.match(base, /<path d="M230 232 V157 H330 V232" class="object"\/>/);
  const groove = readFileSync(join(figuresDir, svgNames[1]), "utf8");
  assert.match(groove, /<path d="M150 188 H320 V238 H380 V188 H550 V338 H150 Z" class="object"\/>/);
  assert.match(groove, /<rect x="150" y="444" width="400" height="250" class="object"\/>/);
  assert.match(groove, /<path d="M320 444 V694 M380 444 V694" class="object"\/>/);
});
function pythonBlocks(slug) {
  const rx = new RegExp("^" + fence + "python[^\\n]*\\n([\\s\\S]*?)^" + fence + "\\s*$", "gm");
  return [...article(slug).body.matchAll(rx)].map(m => m[1]);
}
function python(code) {
  const r = spawnSync("python3", ["-c", code], { encoding: "utf8", timeout: 5000 });
  assert.equal(r.status, 0, r.stderr || String(r.error));
  return r.stdout.trim();
}
test("all new Python examples parse as valid Python", () => {
  for (const slug of ["python-list-methods-complete-guide", "python-slicing-complete-guide", "python-functions-from-zero"]) {
    const blocks = pythonBlocks(slug);
    assert.ok(blocks.length >= 10, slug);
    for (const code of blocks) {
      const r = spawnSync("python3", ["-c", "import ast,sys;ast.parse(sys.stdin.read())"], {input: code, encoding: "utf8", timeout: 5000});
      assert.equal(r.status, 0, slug + " syntax error\n" + r.stderr);
    }
  }
});
test("representative tutorials print their documented outputs", () => {
  for (const [slug, needle, output] of [
    ["python-list-methods-complete-guide", "scores = [78, 90, 84]", "78\n3\n[78, 95, 84]"],
    ["python-slicing-complete-guide", "print(a[5:1:-2])", "['F', 'D']\n['F', 'E', 'D', 'C', 'B', 'A']"],
    ["python-functions-from-zero", "def is_pass(score):", "True\nFalse"],
    ["python-functions-from-zero", "def average(scores):", "平均分：90.0"],
  ]) {
    const code = pythonBlocks(slug).find(s => s.includes(needle));
    assert.ok(code, slug + " missing example " + needle);
    assert.equal(python(code), output, slug + " output");
  }
});
