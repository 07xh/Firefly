import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { describeProtectedSyntax, inspectProtectedMarkdown, serializeEditableStepTimeline, serializeEditableTabGroup, serializeEditableCallout, serializeEditableTaskList, serializeEditableDetails } from "../public/admin-visual-preview.js";
import { normalizeEditorLinkAddress } from "../public/admin-link-utils.js";
import { getAdminImagePreviewUrl, resolveRepositoryImagePath } from "../public/admin-image-preview-utils.js";

test("后台日常提示使用自然中文，技术诊断默认不直接打扰编辑者", () => {
  const adminPage = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");
  const editorScript = readFileSync(new URL("../public/admin-wysiwyg.js", import.meta.url), "utf8");
  const settingsApi = readFileSync(new URL("../src/pages/api/admin/settings.ts", import.meta.url), "utf8");
  const articlesApi = readFileSync(new URL("../src/pages/api/admin/articles.ts", import.meta.url), "utf8");

  assert.match(adminPage, /检查保存功能/);
  assert.match(adminPage, /查看详细检查信息/);
  assert.match(adminPage, /文章已保存，网站正在更新/);
  assert.doesNotMatch(adminPage, /高级模式|GitHub HTTP|GitHub Request ID|accepted permissions/);
  assert.doesNotMatch(editorScript, /高级模式|Tiptap 模块无法加载|CDN 拦截/);
  assert.match(editorScript, /临时备份/);
  assert.match(settingsApi, /后台尚未完成文章保存配置/);
  assert.doesNotMatch(settingsApi, /Worker 未配置|settings\\.json 必须是 JSON 对象|left、right 或 both/);
  assert.match(articlesApi, /后台缺少完成这项操作的权限/);
  assert.doesNotMatch(articlesApi, /Internal error|Invalid article path|GitHub 写入失败/);
});

test("相对图片预览路径按文章源文件目录解析，不按后台地址解析", () => {
  assert.equal(
    resolveRepositoryImagePath("src/content/posts/firefly.md", "./images/1.avif"),
    "src/content/posts/images/1.avif",
  );
  assert.equal(
    resolveRepositoryImagePath("src/content/posts/guide/firefly-layout-system.md", "../images/left-list.avif"),
    "src/content/posts/images/left-list.avif",
  );
  assert.equal(
    getAdminImagePreviewUrl("src/content/posts/firefly.md", "./images/1.avif"),
    "/api/admin/image-preview/?path=src%2Fcontent%2Fposts%2Fimages%2F1.avif",
  );
  assert.equal(
    resolveRepositoryImagePath("src/content/posts/firefly.md", "./images/a%20b.webp?width=2#preview"),
    "src/content/posts/images/a b.webp",
  );
});

test("相对图片预览拒绝外部地址、非图片与越界路径", () => {
  const article = "src/content/posts/guide/firefly-layout-system.md";
  for (const source of [
    "https://example.com/image.png",
    "//example.com/image.png",
    "/images/image.png",
    "data:image/png;base64,AAAA",
    "#section",
    "../../../../../secrets.png",
    "./readme.md",
    "./images/%2F%2Fevil.png",
    "./images/%ZZ.avif",
  ]) {
    assert.equal(resolveRepositoryImagePath(article, source), null, source);
    assert.equal(getAdminImagePreviewUrl(article, source), null, source);
  }
});

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

test("折叠内容可通过中文表单结构化编辑并保持原文格式", () => {
  const raw = serializeEditableDetails({ title: "更多信息", body: "这里是补充内容。" });
  assert.equal(raw, "<details>\n<summary>更多信息</summary>\n这里是补充内容。\n</details>");
  const model = inspectProtectedMarkdown(raw, "HTML or theme tag");
  assert.equal(model.kind, "details");
  assert.equal(model.title, "更多信息");
  assert.equal(model.text, "这里是补充内容。");
  assert.equal(model.editable, true);
});

test("陌生的特殊内容使用易懂名称展示，且不会执行其中代码", () => {
  const raw = "<UnknownWidget run={dangerousFunction()}>原始说明</UnknownWidget>";
  const model = inspectProtectedMarkdown(raw, "MDX component");
  assert.equal(model.kind, "component");
  assert.equal(model.title, "特殊内容模块");
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
  assert.throws(() => serializeEditableStepTimeline({ kind: "steps" }, []), /1 到 30 个步骤或时间点/);
});


test("simple literal TabGroup exposes safe structured editing with exact code preservation", () => {
  const source = [
    '<TabGroup labels={["demo.js", "demo.py"]}>',
    "\x60\x60\x60js",
    'const text = "hello";',
    'const sample = "</TabGroup>";',
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
  assert.equal(model.items[0].text, 'const text = "hello";\nconst sample = "</TabGroup>";\nconsole.log(text);');
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
  assert.throws(() => serializeEditableTabGroup({ kind: "tabs" }, []), /1 到 20 个之间/);
});


test("simple plain-text callouts expose safe structured editing", () => {
  const model = inspectProtectedMarkdown(":::tip[小提示]\n第一行正文。\n第二行正文。\n:::", "Callout");
  assert.equal(model.kind, "callout");
  assert.equal(model.editable, true);
  assert.equal(model.type, "tip");
  assert.equal(model.title, "小提示");
  assert.equal(model.body, "第一行正文。\n第二行正文。");
});

test("formatted, nested, list, and outer-whitespace callouts remain source-only", () => {
  const cases = [
    ":::tip[标题]\n**加粗内容**\n:::",
    ':::tip\n<Badge type="tip">标签</Badge>\n:::',
    ":::tip\n- 列表内容\n:::",
    ":::tip[标题]\n# 小标题\n正文\n:::",
    "\n:::tip\n简单内容\n:::",
  ];
  for (const source of cases) {
    const model = inspectProtectedMarkdown(source, "Callout");
    assert.equal(model.kind, "callout");
    assert.notEqual(model.editable, true, source);
  }
});

test("callout serializer round-trips type, title, and multiline plain text", () => {
  const raw = serializeEditableCallout({ kind: "callout" }, {
    type: "warning",
    title: "重要提醒",
    body: "先检查设置。\n再保存更改。",
  });
  assert.equal(raw, ":::warning[重要提醒]\n先检查设置。\n再保存更改。\n:::");
  const model = inspectProtectedMarkdown(raw, "Callout");
  assert.equal(model.editable, true);
  assert.equal(model.type, "warning");
  assert.equal(model.title, "重要提醒");
  assert.equal(model.body, "先检查设置。\n再保存更改。");
});

test("callout serializer rejects unsupported types and Markdown/MDX bodies", () => {
  assert.throws(() => serializeEditableCallout({ kind: "callout" }, { type: "script", title: "", body: "普通文字" }), /有效的提示样式/);
  assert.throws(() => serializeEditableCallout({ kind: "callout" }, { type: "tip", title: "标题", body: "**加粗**" }), /纯文本/);
  assert.throws(() => serializeEditableCallout({ kind: "callout" }, { type: "tip", title: "", body: "::: nested" }), /纯文本/);
});


test("simple plain task lists expose structured editing without losing checked state", () => {
  const model = inspectProtectedMarkdown("- [x] 已完成\n- [ ] 待处理\n- [X] 再检查", "Task list");
  assert.equal(model.kind, "task-list");
  assert.equal(model.editable, true);
  assert.deepEqual(model.items.map(item => item.checked), [true, false, true]);
  assert.deepEqual(model.items.map(item => item.text), ["已完成", "待处理", "再检查"]);
  assert.equal(inspectProtectedMarkdown("- [ ] 结尾换行正常\n", "Task list").editable, true);
});

test("mixed, nested, formatted, and overlong task lists remain source-only", () => {
  const cases = [
    "任务：\n- [ ] 需要检查",
    "- [ ] **加粗**",
    "- [ ] 第一项\n  - [ ] 嵌套项目",
    "- [ ] <Badge type=\"tip\">组件</Badge>",
    "- [ ] " + "很长".repeat(300),
  ];
  for (const source of cases) {
    const model = inspectProtectedMarkdown(source, "Task list");
    assert.notEqual(model.editable, true, source.slice(0, 100));
  }
});

test("task list serializer round-trips edited checkbox state and text", () => {
  const values = [
    { checked: true, text: "完成第一项" },
    { checked: false, text: "待办第二项" },
  ];
  const raw = serializeEditableTaskList(values);
  assert.equal(raw, "- [x] 完成第一项\n- [ ] 待办第二项");
  const model = inspectProtectedMarkdown(raw, "Task list");
  assert.equal(model.editable, true);
  assert.deepEqual(model.items.map(item => item.checked), values.map(item => item.checked));
  assert.deepEqual(model.items.map(item => item.text), values.map(item => item.text));
});

test("task list serializer rejects formatting, empty values, and more than 100 items", () => {
  assert.throws(() => serializeEditableTaskList([{ text: "**bold**" }]), /纯文字/);
  assert.throws(() => serializeEditableTaskList([{ text: "" }]), /纯文字/);
  assert.throws(() => serializeEditableTaskList([]), /1 到 100 项/);
  assert.throws(() => serializeEditableTaskList(Array.from({ length: 101 }, (_, i) => ({ text: "项目" + i }))), /1 到 100 项/);
});


test("simple details disclosure blocks expose structured title and body editing", () => {
  const source = "<details>\n<summary>常见问题</summary>\n这里是纯文本答案。\n第二行补充说明。\n</details>";
  const model = inspectProtectedMarkdown(source, "HTML details");
  assert.equal(model.kind, "details");
  assert.equal(model.editable, true);
  assert.equal(model.title, "常见问题");
  assert.equal(model.body, "这里是纯文本答案。\n第二行补充说明。");
});

test("details with attributes, nested components, or formatted bodies remain source-only", () => {
  const cases = [
    '<details open>\n<summary>标题</summary>\n正文。\n</details>',
    "<details>\n<summary><Badge>标题</Badge></summary>\n正文。\n</details>",
    "<details>\n<summary>标题</summary>\n**加粗正文**\n</details>",
    "<details>\n<summary>标题</summary>\n- 列表项\n</details>",
    "<details>\n<summary>标题</summary>\n第一段\n\n第二段\n</details>",
  ];
  for (const source of cases) {
    const model = inspectProtectedMarkdown(source, "HTML details");
    assert.notEqual(model.editable, true, source);
  }
});

test("details serializer round-trips safe title and multiline text", () => {
  const raw = serializeEditableDetails({
    title: "安装说明",
    body: "先打开设置页。\n再保存更改。",
  });
  assert.equal(raw, "<details>\n<summary>安装说明</summary>\n先打开设置页。\n再保存更改。\n</details>");
  const model = inspectProtectedMarkdown(raw, "HTML details");
  assert.equal(model.editable, true);
  assert.equal(model.title, "安装说明");
  assert.equal(model.body, "先打开设置页。\n再保存更改。");
});

test("details serializer validates title and body to protect Markdown/MDX", () => {
  assert.throws(() => serializeEditableDetails({ title: "", body: "普通文字" }), /标题不能为空/);
  assert.throws(() => serializeEditableDetails({ title: "标题", body: "**加粗**" }), /纯文本/);
  assert.throws(() => serializeEditableDetails({ title: "标题", body: ":::tip nested" }), /纯文本/);
});


test("internal syntax reasons are shown to writers as plain Chinese", () => {
  assert.equal(describeProtectedSyntax("LaTeX display math"), "数学公式");
  assert.equal(describeProtectedSyntax("LaTeX inline math"), "含公式的正文");
  assert.equal(describeProtectedSyntax("Callout with extended Markdown/MDX"), "提示卡片");
  assert.equal(describeProtectedSyntax("Task list"), "待办清单");
  assert.equal(describeProtectedSyntax("MDX component"), "特殊内容组件");
  assert.equal(describeProtectedSyntax("HTML or theme tag"), "特殊版式内容");
  assert.equal(describeProtectedSyntax("MDX import/export"), "组件引用设置");
  assert.equal(describeProtectedSyntax("unrecognized internal label"), "特殊内容");
});


test("structured editor validation messages use plain Chinese rather than syntax jargon", () => {
  assert.throws(
    () => serializeEditableStepTimeline({ kind: "steps" }, [{ title: "示例", text: "{runCode()}" }]),
    error => error instanceof Error && /正文不能为空/.test(error.message) && !/Markdown|MDX/.test(error.message),
  );
  assert.throws(
    () => serializeEditableCallout({ kind: "callout" }, { type: "tip", title: "提示", body: "**加粗**" }),
    error => error instanceof Error && /纯文本/.test(error.message) && !/Markdown|MDX|源码/.test(error.message),
  );
  assert.throws(
    () => serializeEditableTaskList([{ checked: false, text: "**加粗**" }]),
    error => error instanceof Error && /纯文字/.test(error.message) && !/Markdown|MDX/.test(error.message),
  );
  assert.throws(
    () => serializeEditableDetails({ title: "标题", body: "**加粗**" }),
    error => error instanceof Error && /纯文本/.test(error.message) && !/Markdown|MDX|源码/.test(error.message),
  );
});


test("visual editor accepts safe web, email, phone, and in-site links", () => {
  assert.equal(normalizeEditorLinkAddress(" https://example.com/guide?q=1 "), "https://example.com/guide?q=1");
  assert.equal(normalizeEditorLinkAddress("http://example.com"), "http://example.com/");
  assert.equal(normalizeEditorLinkAddress("mailto:editor@example.com?subject=Hello"), "mailto:editor@example.com?subject=Hello");
  assert.equal(normalizeEditorLinkAddress("tel:+1 (555) 012-3456"), "tel:+1(555)012-3456");
  assert.equal(normalizeEditorLinkAddress("/posts/guide/"), "/posts/guide/");
  assert.equal(normalizeEditorLinkAddress("../guide/"), "../guide/");
  assert.equal(normalizeEditorLinkAddress("#introduction"), "#introduction");
});

test("visual editor rejects unsafe or malformed link addresses", () => {
  for (const address of [
    "",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//external.example/path",
    "https://",
    "mailto:",
    "tel:hello",
    "https://example.com/with\nnewline",
    'https://example.com/" onclick="alert(1)',
    "/" + "a".repeat(2048),
  ]) {
    assert.equal(normalizeEditorLinkAddress(address), null, `expected rejection for ${JSON.stringify(address)}`);
  }
});
