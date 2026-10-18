import assert from "node:assert/strict";
import test from "node:test";

import { inspectProtectedMarkdown } from "../public/admin-visual-preview.js";

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
