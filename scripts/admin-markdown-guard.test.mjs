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

test("基础提示容器进入可视化解析，MDX 组件仍作为无损保留块", () => {
  const source = [
    "开头正文。",
    "",
    ":::tip",
    "这段正文 **可直接编辑**。",
    ":::",
    "",
    "<TabGroup labels={items}>",
    "组件内部文字。",
    "</TabGroup>",
    "",
    "结尾正文。",
  ].join("\n");

  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 1);
  assert.ok(result.records.some(record => record.raw === "<TabGroup labels={items}>\n组件内部文字。\n</TabGroup>"));
  assert.match(result.markdown, /:::tip\n这段正文 \*\*可直接编辑\*\*。\n:::/);
  assert.doesNotMatch(result.markdown, /组件内部文字/);
  assert.match(result.markdown, /开头正文/);
  assert.match(result.markdown, /结尾正文/);
});

test("不支持的自定义 directive 仍以原始语法保护，不会被误当作 callout", () => {
  const raw = ":::spoiler\n秘密内容\n:::";
  const result = prepareMarkdownForVisualEditing("开头\n\n" + raw + "\n\n结尾");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].raw, raw);
  assert.match(result.markdown, /开头/);
  assert.match(result.markdown, /结尾/);
});

test("容器内包含 MDX 标签时整体保留，避免 marker 移出容器", () => {
  const raw = [
    ":::tip",
    "说明文字。",
    '<Badge type="tip">新</Badge>',
    ":::",
  ].join("\n");
  const result = prepareMarkdownForVisualEditing("前言\n\n" + raw + "\n\n后记");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].raw, raw);
  assert.match(result.markdown, /前言/);
  assert.match(result.markdown, /后记/);
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


test("复合 HTML/MDX 标签容器整体作为一个保留块", () => {
  const raw = [
    "<details>",
    "<summary>展开</summary>",
    "<div class='inside'>原始内容</div>",
    "</details>",
  ].join("\n");
  const result = prepareMarkdownForVisualEditing("前言\n\n" + raw + "\n\n后记");

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].raw, raw);
  assert.match(result.markdown, /前言/);
  assert.match(result.markdown, /后记/);
});

test("简单变量和多行 MDX 表达式均保留", () => {
  const first = "{userName}";
  const second = ["{", "  getContent({ id: 1 })", "}"].join("\n");
  const result = prepareMarkdownForVisualEditing("开头\n\n" + first + "\n\n" + second + "\n\n结尾");

  assert.equal(result.records.length, 2);
  assert.ok(result.records.some(record => record.raw === first));
  assert.ok(result.records.some(record => record.raw === second));
  assert.match(result.markdown, /开头/);
  assert.match(result.markdown, /结尾/);
});

test("常见原始 HTML 链接属性不会被 Markdown 往返改写", () => {
  const raw = "<a href='/docs' target='_blank' rel='noreferrer'>文档</a>";
  const result = prepareMarkdownForVisualEditing("请访问 " + raw + " 查看说明。");

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].raw, "请访问 " + raw + " 查看说明。");
});


test("simple static Badge components remain available to the inline visual node", () => {
  const source = '段落中的 <Badge>新功能</Badge> 与 <Badge type="tip">提示</Badge> 可以直接编辑。';
  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 0);
  assert.equal(result.markdown, source);
});

test("Badge with dynamic props remains protected as MDX source", () => {
  const source = '动态徽章 <Badge type={badgeType}>提示</Badge> 不应该被简化。';
  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].raw, source);
});

test("Badge with unsupported class props or nested markup remains protected", () => {
  for (const source of [
    '<Badge class="custom">重要</Badge>',
    '<Badge type="tip"><Icon name="check" />已完成</Badge>',
    '<Badge type="tip">**强调文字**</Badge>',
  ]) {
    const result = prepareMarkdownForVisualEditing(source);
    assert.equal(result.records.length, 1, source);
    assert.equal(result.records[0].raw, source);
  }
});


test("普通 Markdown 表格保留为可视化编辑内容，不被包装成源码保护块", () => {
  const table = [
    "| 名称 | 说明 |",
    "| --- | --- |",
    "| alpha | 第一项 |",
    "| beta | 第二项 |",
  ].join("\n");
  const source = "表格前言。\n\n" + table + "\n\n表格后文。";
  const result = prepareMarkdownForVisualEditing(source);
  assert.equal(result.records.length, 0);
  assert.equal(result.markdown, source);
});


test("multiple protected formulas and special components survive marker restoration without reordering", () => {
  const inlineFormula = "欧拉公式 $e^{i\\pi} + 1 = 0$ 是例子。";
  const customDirective = ":::spoiler[保留说明]\\n保留 **原始格式**。\\n:::";
  const dynamicComponent = '<Badge type={badgeType}>动态标签</Badge>';
  const blockFormula = "$$\\n\\frac{a}{b} + \\sqrt{x}\\n$$";
  const source = [
    "前言。",
    "",
    inlineFormula,
    "",
    customDirective,
    "",
    dynamicComponent,
    "",
    blockFormula,
    "",
    "后记。",
  ].join("\\n");

  const prepared = prepareMarkdownForVisualEditing(source);
  const restored = restoreProtectedMarkdown(prepared.markdown, prepared.records);
  const expectedBlocks = [inlineFormula, customDirective, dynamicComponent, blockFormula];

  for (const raw of expectedBlocks) {
    assert.equal(prepared.records.some(record => record.raw === raw), true, raw);
    assert.equal(restored.includes(raw), true, raw);
  }
  assert.doesNotMatch(restored, /FIREFLYRAWBLOCK\\d+END/);
  const positions = expectedBlocks.map(raw => restored.indexOf(raw));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.ok(restored.indexOf("前言。") < positions[0]);
  assert.ok(restored.indexOf("后记。") > positions.at(-1));
});
