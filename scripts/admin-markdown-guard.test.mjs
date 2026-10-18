import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareMarkdownForVisualEditing,
  restoreProtectedMarkdown,
} from "../public/admin-markdown-guard.js";

test("普通 Markdown 和代码示例保持正常可视化，不产生保留块", () => {
  const tick = "\x60";
  const source = [
    "# 标题",
    "",
    "这里是普通文字，行内代码 " + tick + "<div>" + tick + " 和 " + tick + "import { A } from 'x'" + tick + " 是示例。",
    "",
    "\x60\x60\x60\x60mdx",
    "import { TabGroup } from 'x';",
    "<TabGroup />",
    ":::tip",
    "\x60\x60\x60\x60",
  ].join("\n");

  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 0);
  assert.equal(result.markdown, source);
});

test("行内公式所在段落被保护，公式与周边内容均保留", () => {
  const source = [
    "前面的普通段落。",
    "",
    "欧拉公式 $e^{i\\pi} + 1 = 0$ 是数学中常见的例子。",
    "",
    "后面的普通段落。",
  ].join("\n");

  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].reason, "LaTeX inline math");
  assert.equal(result.records[0].raw, "欧拉公式 $e^{i\\pi} + 1 = 0$ 是数学中常见的例子。");
  assert.match(result.markdown, /前面的普通段落/);
  assert.match(result.markdown, /后面的普通段落/);
});

test("块级公式从开始分隔符到结束分隔符整体保留", () => {
  const formula = ["$$", "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", "$$"].join("\n");
  const result = prepareMarkdownForVisualEditing("开始\n\n" + formula + "\n\n结束");

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].raw, formula);
  assert.match(result.markdown, /FIREFLYRAWBLOCK0END/);
  assert.match(result.markdown, /开始/);
  assert.match(result.markdown, /结束/);
});

test("MDX 标签、主题提示块保留原始语法，普通正文仍可编辑", () => {
  const source = [
    "开头正文。",
    "",
    ":::tip",
    "这段正文仍可编辑。",
    ":::",
    "",
    "<TabGroup labels={items}>",
    "组件内部文字。",
    "</TabGroup>",
    "",
    "结尾正文。",
  ].join("\n");

  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 2);
  assert.ok(result.records.some(record => record.raw === ":::tip\n这段正文仍可编辑。\n:::"));
  assert.ok(result.records.some(record => record.raw === "<TabGroup labels={items}>\n组件内部文字。\n</TabGroup>"));
  assert.doesNotMatch(result.markdown, /这段正文仍可编辑/);
  assert.doesNotMatch(result.markdown, /组件内部文字/);
  assert.match(result.markdown, /开头正文/);
  assert.match(result.markdown, /结尾正文/);
});

test("任务清单整体保护，避免复选框在编辑器往返中丢失", () => {
  const list = ["- [ ] 计划一", "- [x] 计划二"].join("\n");
  const result = prepareMarkdownForVisualEditing("介绍\n\n" + list + "\n\n结尾");

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].raw, list);
  assert.match(result.markdown, /介绍/);
  assert.match(result.markdown, /结尾/);
});

test("扩展语法位于四反引号代码围栏内时不会被误判", () => {
  const fence = "\x60\x60\x60\x60";
  const source = [
    fence + "mdx",
    "import { Badge } from 'x';",
    "<Badge />",
    ":::tip",
    "\x60\x60\x60js",
    "console.log('sample')",
    "\x60\x60\x60",
    fence,
  ].join("\n");

  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 0);
  assert.equal(result.markdown, source);
});

test("保留块编辑后可按 marker 原位恢复新语法文本", () => {
  const result = prepareMarkdownForVisualEditing("前言\n\n<iframe src='a'></iframe>\n\n后记");
  assert.equal(result.records.length, 1);
  const editedRecords = result.records.map(record => ({
    ...record,
    raw: "<iframe src='b'></iframe>",
  }));
  const restored = restoreProtectedMarkdown(result.markdown, editedRecords);

  assert.match(restored, /<iframe src='b'><\/iframe>/);
  assert.doesNotMatch(restored, /FIREFLYRAWBLOCK/);
  assert.match(restored, /前言/);
  assert.match(restored, /后记/);
});
