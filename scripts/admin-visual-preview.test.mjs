import assert from "node:assert/strict";
import test from "node:test";

import { inspectProtectedMarkdown, serializeEditableStepTimeline, serializeEditableTabGroup } from "../public/admin-visual-preview.js";

test("Firefly Badge component renders as a safe visual preview model", () => {
  const model = inspectProtectedMarkdown('前言 <Badge type="tip">新功能</Badge> 后记', "MDX component");
  assert.equal(model.kind, "badges");
  assert.ok(model.segments.some(item => item.kind === "badge" && item.text === "新功能" && item.type === "tip"));
});

test("Steps and Timeline retain item titles and readable summaries", () => {
  const steps = inspectProtectedMarkdown([
    "<Steps>",
    '  <StepItem title="安装依赖">运行 \x60pnpm install\x60。</StepItem>',
    '  <StepItem title="启动服务">执行命令。</StepItem>',
    "</Steps>",
  ].join("\n"), "MDX component");
  assert.equal(steps.kind, "steps");
  assert.equal(steps.items.length, 2);
  assert.equal(steps.items[0].title, "安装依赖");

  const timeline = inspectProtectedMarkdown([
    "<Timeline>",
    '  <TimelineItem date="2026-01-01" title="上线">站点发布。</TimelineItem>',
    "</Timeline>",
  ].join("\n"), "MDX component");
  assert.equal(timeline.kind, "timeline");
  assert.equal(timeline.items[0].date, "2026-01-01");
  assert.equal(timeline.items[0].text, "站点发布。");
});

test("TabGroup preview reads labels and code fences without executing anything", () => {
  const model = inspectProtectedMarkdown([
    '<TabGroup labels={["demo.js", "demo.py"]}>',
    "\x60\x60\x60js",
    "console.log(1)",
    "\x60\x60\x60",
    "\x60\x60\x60py",
    "print(2)",
    "\x60\x60\x60",
    "</TabGroup>",
  ].join("\n"), "MDX component");
  assert.equal(model.kind, "tabs");
  assert.equal(model.items[0].title, "demo.js");
  assert.match(model.items[1].text, /print\(2\)/);
});

test("extended callouts, task lists, math, and iframe have safe preview models", () => {
  assert.equal(inspectProtectedMarkdown(":::warning[小心]\n请检查。\n:::", "Callout with extended Markdown/MDX").kind, "callout");
  assert.equal(inspectProtectedMarkdown("- [x] 已完成\n- [ ] 待办", "Task list").kind, "task-list");
  assert.equal(inspectProtectedMarkdown("$$\nx^2 + 1\n$$", "LaTeX display math").kind, "math");
  const embed = inspectProtectedMarkdown('<iframe src="https://example.com/embed"></iframe>', "HTML or theme tag");
  assert.equal(embed.kind, "embed");
  assert.equal(embed.host, "example.com");
});

test("unknown syntax becomes a safe component summary without evaluating expressions", () => {
  const raw = "<UnknownWidget run={dangerousFunction()}>原始说明</UnknownWidget>";
  const model = inspectProtectedMarkdown(raw, "MDX component");
  assert.equal(model.kind, "component");
  assert.equal(model.title, "UnknownWidget");
  assert.equal(model.text, "原始说明");
  assert.doesNotMatch(JSON.stringify(model), /dangerousFunction/);
});


test("display math strips delimiters before KaTeX rendering", () => {
  const model = inspectProtectedMarkdown("$$\n\\frac{a}{b} + c\n$$", "LaTeX display math");
  assert.equal(model.kind, "math");
  assert.equal(model.display, true);
  assert.equal(model.text, "\\frac{a}{b} + c");
  assert.doesNotMatch(model.text, /^\$\$|\$\$$/);
});

test("inline math separates readable prose from the TeX expression", () => {
  const model = inspectProtectedMarkdown("欧拉公式 $e^{i\\pi} + 1 = 0$ 是常见例子。", "LaTeX inline math");
  assert.equal(model.kind, "inline-math");
  assert.deepEqual(model.segments, [
    { kind: "text", text: "欧拉公式" },
    { kind: "math", text: "e^{i\\pi} + 1 = 0" },
    { kind: "text", text: "是常见例子。" },
  ]);
});

test("math expressions remain inert text in the preview model", () => {
  const source = String.raw`\htmlData{onclick=alert(1)}{x}`;
  const model = inspectProtectedMarkdown("$$\n" + source + "\n$$", "LaTeX display math");
  assert.equal(model.text, source);
  assert.equal(typeof model.text, "string");
});


test("simple Steps and Timeline expose safe structured editing models", () => {
  const steps = inspectProtectedMarkdown([
    "<Steps>",
    '  <StepItem title="Install" type="tip">Run command.</StepItem>',
    '  <StepItem title="Verify">Check output.</StepItem>',
    "</Steps>",
  ].join("\n"), "MDX component");
  assert.equal(steps.kind, "steps");
  assert.equal(steps.editable, true);
  assert.equal(steps.items.length, 2);
  assert.equal(steps.items[0].title, "Install");
  assert.equal(steps.items[0].text, "Run command.");

  const timeline = inspectProtectedMarkdown([
    "<Timeline>",
    '  <TimelineItem date="2026-10-18" title="Published" icon="rocket">First release.</TimelineItem>',
    "</Timeline>",
  ].join("\n"), "MDX component");
  assert.equal(timeline.kind, "timeline");
  assert.equal(timeline.editable, true);
  assert.equal(timeline.items[0].date, "2026-10-18");
  assert.equal(timeline.items[0].icon, "rocket");
});

test("complex Steps and Timeline remain visual-only to preserve source semantics", () => {
  const cases = [
    '<Steps client:load><StepItem title="Install">Run command.</StepItem></Steps>',
    '<Steps><StepItem title="Install">Run \x60pnpm install\x60.</StepItem></Steps>',
    '<Steps><StepItem title="Install"><Badge type="tip">New</Badge></StepItem></Steps>',
    '<Timeline><TimelineItem date="2026" title="First" class="custom">Details.</TimelineItem></Timeline>',
  ];
  for (const source of cases) {
    const model = inspectProtectedMarkdown(source, "MDX component");
    assert.notEqual(model.editable, true, source);
  }
});

test("structured Steps and Timeline serializer emits stable plain-text MDX", () => {
  const stepsModel = { kind: "steps" };
  assert.equal(serializeEditableStepTimeline(stepsModel, [
    { title: "Install", type: "tip", icon: "rocket", text: "Run command." },
    { title: "Verify", text: "Check output." },
  ]), '<Steps>\n  <StepItem title="Install" type="tip" icon="rocket">Run command.</StepItem>\n  <StepItem title="Verify">Check output.</StepItem>\n</Steps>');

  const timelineModel = { kind: "timeline" };
  assert.equal(serializeEditableStepTimeline(timelineModel, [
    { date: "2026-10-18", title: "Published", text: "First release." },
  ]), '<Timeline>\n  <TimelineItem date="2026-10-18" title="Published">First release.</TimelineItem>\n</Timeline>');
});

test("structured serializer rejects nested markup, expressions, and invalid component options", () => {
  assert.throws(() => serializeEditableStepTimeline({ kind: "steps" }, [
    { title: "Unsafe", text: "{runCode()}" },
  ]), /正文不能为空/);
  assert.throws(() => serializeEditableStepTimeline({ kind: "timeline" }, [
    { date: "2026", title: "Okay", text: "Details.", icon: "unknown" },
  ]), /图标名称/);
  assert.throws(() => serializeEditableStepTimeline({ kind: "steps" }, []), /1 到 30 项/);
});


test("simple literal TabGroup exposes safe structured editing with exact code preservation", () => {
  const source = [
    '<TabGroup labels={["demo.js", "demo.py"]}>',
    "\x60\x60\x60js",
    'const text = "hello";',
    "console.log(text);",
    "\x60\x60\x60",
    "\x60\x60\x60py",
    "print(2)",
    "\x60\x60\x60",
    "</TabGroup>",
  ].join("\n");
  const model = inspectProtectedMarkdown(source, "MDX component");
  assert.equal(model.kind, "tabs");
  assert.equal(model.editable, true);
  assert.equal(model.items.length, 2);
  assert.equal(model.items[0].title, "demo.js");
  assert.equal(model.items[0].language, "js");
  assert.equal(model.items[0].text, 'const text = "hello";\nconsole.log(text);');
  assert.equal(model.items[1].text, "print(2)");
});

test("dynamic, mixed-content, and malformed TabGroup components are not editable", () => {
  const cases = [
    '<TabGroup labels={getLabels()}>\n\x60\x60\x60js\nconsole.log(1)\n\x60\x60\x60\n</TabGroup>',
    '<TabGroup labels={["one"]} client:load>\n\x60\x60\x60js\nconsole.log(1)\n\x60\x60\x60\n</TabGroup>',
    '<TabGroup labels={["one"]}>\nIntro text\n\x60\x60\x60js\nconsole.log(1)\n\x60\x60\x60\n</TabGroup>',
    '<TabGroup labels={["one", "two"]}>\n\x60\x60\x60js\nconsole.log(1)\n\x60\x60\x60\n</TabGroup>',
    '<TabGroup labels={["bad"label]}>\n\x60\x60\x60js\nconsole.log(1)\n\x60\x60\x60\n</TabGroup>',
  ];
  for (const source of cases) {
    const model = inspectProtectedMarkdown(source, "MDX component");
    assert.equal(model.kind, "tabs");
    assert.notEqual(model.editable, true, source);
  }
});

test("TabGroup serializer chooses a safe fence and round-trips code text", () => {
  const values = [
    { title: "JavaScript 示例", language: "js", text: 'const fence = "\x60\x60\x60";\nconsole.log(fence);\n' },
    { title: "Python", language: "py", text: "print(2)\n\n# trailing blank line" },
  ];
  const raw = serializeEditableTabGroup({ kind: "tabs" }, values);
  assert.match(raw, /\x60{4}js/);
  const model = inspectProtectedMarkdown(raw, "MDX component");
  assert.equal(model.editable, true);
  assert.deepEqual(model.items.map(item => item.title), values.map(item => item.title));
  assert.deepEqual(model.items.map(item => item.language), values.map(item => item.language));
  assert.deepEqual(model.items.map(item => item.text), values.map(item => item.text));
});

test("TabGroup serializer rejects unsafe labels, languages, and oversized content", () => {
  assert.throws(() => serializeEditableTabGroup({ kind: "tabs" }, [{ title: 'bad"label', language: "js", text: "x" }]), /标签名称/);
  assert.throws(() => serializeEditableTabGroup({ kind: "tabs" }, [{ title: "JS", language: "{run()}", text: "x" }]), /代码语言/);
  assert.throws(() => serializeEditableTabGroup({ kind: "tabs" }, [{ title: "JS", language: "js", text: "x".repeat(50001) }]), /50000/);
  assert.throws(() => serializeEditableTabGroup({ kind: "tabs" }, []), /1 到 20 项/);
});
