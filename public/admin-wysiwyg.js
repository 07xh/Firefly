let Editor, StarterKit, Markdown, Image, TableKit;

async function loadTiptapModules() {
  const providers = [
    {
      name: "esm.sh（统一 ProseMirror 依赖）",
      urls: [
        "https://esm.sh/@tiptap/core@3.31.3?deps=@tiptap/core@3.31.3,@tiptap/pm@3.31.3",
        "https://esm.sh/@tiptap/starter-kit@3.31.3?deps=@tiptap/core@3.31.3,@tiptap/pm@3.31.3",
        "https://esm.sh/@tiptap/markdown@3.31.3?deps=@tiptap/core@3.31.3,@tiptap/pm@3.31.3",
        "https://esm.sh/@tiptap/extension-image@3.31.3?deps=@tiptap/core@3.31.3,@tiptap/pm@3.31.3",
        "https://esm.sh/@tiptap/extension-table@3.31.3?deps=@tiptap/core@3.31.3,@tiptap/pm@3.31.3",
      ],
    },
    {
      name: "jsDelivr（备用）",
      urls: [
        "https://cdn.jsdelivr.net/npm/@tiptap/core@3.31.3/+esm",
        "https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@3.31.3/+esm",
        "https://cdn.jsdelivr.net/npm/@tiptap/markdown@3.31.3/+esm",
        "https://cdn.jsdelivr.net/npm/@tiptap/extension-image@3.31.3/+esm",
        "https://cdn.jsdelivr.net/npm/@tiptap/extension-table@3.31.3/+esm",
      ],
    },
  ];
  const failures = [];
  for (const provider of providers) {
    try {
      const [core, starter, markdown, image, table] = await Promise.all(
        provider.urls.map((url) => import(url)),
      );
      if (!core.Editor || !starter.default || !markdown.Markdown || !image.default || !table.TableKit) {
        throw new Error("模块导出不完整");
      }
      Editor = core.Editor;
      StarterKit = starter.default;
      Markdown = markdown.Markdown;
      Image = image.default;
      TableKit = table.TableKit;
      return provider.name;
    } catch (error) {
      failures.push(provider.name + ": " + (error instanceof Error ? error.message : String(error)));
    }
  }
  throw new Error("Tiptap 模块无法加载或导出不完整。请检查网络、CDN 拦截或依赖冲突。 " + failures.join(" | "));
}

(() => {
  const $ = (id) => document.getElementById(id);
  const sourceField = $("body");
  const editorElement = $("wysiwygEditor");
  const pane = $("wysiwygPane");
  const notice = $("wysiwygNotice");
  if (!sourceField || !editorElement || !pane) return;

  const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  let editor = null;
  let frontmatterPrefix = "";
  let loadingSource = false;
  let unsupportedReason = "";
  let pendingUploads = 0;
  let activeMode = "visual";
  let lastLoadedSource = sourceField.value;

  function status(message, isError = false) {
    const target = $("status");
    if (target) {
      target.textContent = message;
      target.style.color = isError ? "#b42318" : "#657267";
    }
  }

  function splitFrontmatter(source) {
    const match = source.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
    if (!match) return { prefix: "", body: source, hasFrontmatter: false };
    return { prefix: match[0], body: source.slice(match[0].length), hasFrontmatter: true };
  }

  const recoveryKey = "firefly:admin:recovery:v1:last";
  const recoveryEnabledKey = "firefly:admin:recovery:v1:enabled";
  let recoveryTimer = null;

  function currentContext() {
    return window.FireflyArticleContext || { path: "", sha: "" };
  }

  function readRecovery() {
    try {
      const raw = sessionStorage.getItem(recoveryKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isPasswordProtectedSource(source) {
    const currentPassword = $("articlePassword")?.value?.trim() || "";
    if (currentPassword) return true;
    const prefix = splitFrontmatter(source).prefix;
    const match = prefix.match(/^password:\s*(.*?)\s*$/m);
    const raw = match?.[1]?.trim() || "";
    return Boolean(raw && !/^(?:""|''|null)$/i.test(raw));
  }

  function setRecoveryStatus(message) {
    const target = $("localRecoveryStatus");
    if (target) target.textContent = message;
  }

  function refreshRecoveryAvailability() {
    const toggle = $("localRecoveryCheck");
    const button = $("restoreLocalRecovery");
    if (!toggle || !button) return;

    if (!toggle.checked) {
      button.hidden = true;
      button.disabled = true;
      setRecoveryStatus("默认关闭。开启后，未加密文章只会在当前浏览器标签页保存恢复副本。");
      return;
    }

    const snapshot = readRecovery();
    if (!snapshot) {
      button.hidden = true;
      button.disabled = true;
      setRecoveryStatus("已开启，正在等待可恢复的编辑内容。访问密码不会存入恢复副本。");
      return;
    }

    const context = currentContext();
    const sameArticle = snapshot.path
      ? snapshot.path === context.path && snapshot.sha === context.sha
      : !context.path;
    button.hidden = false;
    button.disabled = !sameArticle;
    if (!sameArticle) {
      button.textContent = "恢复其他文章的副本";
      setRecoveryStatus(snapshot.path
        ? "发现其他文章的恢复副本。请先选择该文章；若远端 SHA 已变化，为避免覆盖新版本，将禁止恢复。"
        : "发现新文章恢复副本。请回到新建文章模式后再恢复。");
      return;
    }

    button.textContent = snapshot.path ? "恢复本篇未保存内容" : "恢复新建文章副本";
    const savedAt = snapshot.savedAt
      ? new Date(snapshot.savedAt).toLocaleString("zh-CN", { hour12: false })
      : "时间未知";
    setRecoveryStatus("发现 " + savedAt + " 的本地恢复副本。恢复会覆盖当前表单内容并标记为未保存修改。");
  }

  function clearRecovery(detail = {}) {
    const snapshot = readRecovery();
    if (!snapshot) {
      refreshRecoveryAvailability();
      return;
    }
    const sameSavedArticle = detail.path && snapshot.path === detail.path;
    const sameNewArticle = !snapshot.path && Boolean(detail.slug);
    if (sameSavedArticle || sameNewArticle) {
      try { sessionStorage.removeItem(recoveryKey); } catch {}
    }
    refreshRecoveryAvailability();
  }

  function saveRecovery() {
    if (!$("localRecoveryCheck")?.checked) return;
    const source = sourceField.value || "";
    if (isPasswordProtectedSource(source)) {
      setRecoveryStatus("检测到文章启用了密码保护。为避免保存受保护正文，已跳过本次本地恢复。");
      return;
    }

    const title = $("title")?.value?.trim() || "";
    const slug = $("slug")?.value?.trim() || "";
    const split = splitFrontmatter(source);
    if (!title && !slug && !split.body.trim()) return;

    const context = currentContext();
    const snapshot = {
      path: typeof context.path === "string" ? context.path : "",
      sha: typeof context.sha === "string" ? context.sha : "",
      title,
      slug,
      published: $("published")?.value || "",
      date: $("date")?.value || "",
      category: $("category")?.value || "",
      tags: $("tags")?.value || "",
      description: $("description")?.value || "",
      body: source,
      draft: Boolean($("draft")?.checked),
      savedAt: Date.now()
    };
    try {
      sessionStorage.setItem(recoveryKey, JSON.stringify(snapshot));
      setRecoveryStatus("已在当前标签页保存恢复副本（" +
        new Date(snapshot.savedAt).toLocaleTimeString("zh-CN", { hour12: false }) + "）。");
      refreshRecoveryAvailability();
    } catch {
      setRecoveryStatus("浏览器无法保存本地恢复副本；当前内容仍在编辑器中，请及时保存到 GitHub。");
    }
  }

  function queueRecovery() {
    if (!$("localRecoveryCheck")?.checked) return;
    if (recoveryTimer !== null) clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      recoveryTimer = null;
      saveRecovery();
    }, 800);
  }

  function restoreRecovery() {
    const snapshot = readRecovery();
    if (!snapshot || $("restoreLocalRecovery")?.disabled) return;
    if (!window.confirm("恢复本地副本会覆盖当前表单中尚未保存的内容，确定恢复吗？")) return;

    const context = currentContext();
    if (snapshot.path && (snapshot.path !== context.path || snapshot.sha !== context.sha)) {
      setRecoveryStatus("恢复已取消：文章版本已变化，请重新载入并比较远端内容。");
      return;
    }
    if (isPasswordProtectedSource(snapshot.body || "")) {
      setRecoveryStatus("此副本包含密码保护文章，已禁止恢复。");
      return;
    }

    const values = {
      title: snapshot.title,
      slug: snapshot.slug,
      published: snapshot.published,
      date: snapshot.date,
      category: snapshot.category,
      tags: snapshot.tags,
      description: snapshot.description,
      body: snapshot.body
    };
    for (const [id, value] of Object.entries(values)) {
      const field = $(id);
      if (field && typeof value === "string") {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    $("draft").checked = snapshot.draft === true;
    $("draft").dispatchEvent(new Event("change", { bubbles: true }));
    window.dispatchEvent(new CustomEvent("firefly:source-loaded"));
    window.dispatchEvent(new CustomEvent("firefly:mode", { detail: { mode: "visual" } }));
    setRecoveryStatus("恢复完成。内容尚未写入 GitHub；请检查后手动保存。");
  }


  function getUnsafeReason(markdown) {
    // Ignore fenced code: imports and angle-bracket examples inside code are safe text.
    const withoutFences = markdown
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^\s*~~~[\s\S]*?^\s*~~~\s*$/gm, "");

    if (/^\s*(?:import|export)\s/m.test(withoutFences)) {
      return "正文包含 MDX import/export 语句。为避免组件丢失，请使用 Markdown 源码模式编辑。";
    }
    if (/<\/?[A-Z][A-Za-z0-9_.:-]*(?:\s|\/?>)/.test(withoutFences)) {
      return "正文包含自定义 MDX/组件标签。为避免破坏组件，请使用 Markdown 源码模式编辑。";
    }
    if (/<\/?(?:script|style|iframe|video|audio|div|section|details|summary|table|kbd|sup|sub|span|u|figure|figcaption)\b/i.test(withoutFences)) {
      return "正文包含 HTML 或主题特殊标签。为避免转换丢失属性，请使用 Markdown 源码模式编辑。";
    }
    if (/^\s*:{3,}/m.test(withoutFences)) {
      return "正文包含主题提示块或 Markdown directive，请使用源码模式避免丢失主题语法。";
    }
    if (/(^|\n)\s*\$\$|\$(?:\\.|[^$\n])+\$/m.test(withoutFences)) {
      return "正文包含数学公式语法。请使用源码模式，以保留 KaTeX/LaTeX 公式。";
    }
    if (/(^|\n)\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s/m.test(withoutFences)) {
      return "正文包含任务清单。请使用源码模式，以保留复选框语法。";
    }
    if (/\[\[[^\]\n]+\]\]/.test(withoutFences)) {
      return "正文包含 Wiki 双括号链接。请使用源码模式，以保留站内链接语法。";
    }
    if (/^\[\^[^\]]+\]:/m.test(withoutFences)) {
      return "正文包含 Markdown 脚注定义。请使用源码模式，以保留脚注。";
    }
    if (/(^|\n)\s*\{\s*(?:\/\*|[A-Za-z_$][\w$.]*\s*(?:\(|\?\.|\.|\[))/.test(withoutFences)) {
      return "正文包含 MDX 表达式。为避免改变运行逻辑，请使用 Markdown 源码模式编辑。";
    }
    return "";
  }

  function setMode(mode) {
    activeMode = mode;
    $("body").hidden = mode !== "source";
    pane.hidden = mode !== "visual";
    $("markdownPreview").hidden = mode !== "preview";
    $("visualTab")?.classList.toggle("active", mode === "visual");
    $("editorTab")?.classList.toggle("active", mode === "source");
    $("previewTab")?.classList.toggle("active", mode === "preview");
    $("visualTab")?.setAttribute("aria-selected", String(mode === "visual"));
    $("editorTab")?.setAttribute("aria-selected", String(mode === "source"));
    $("previewTab")?.setAttribute("aria-selected", String(mode === "preview"));
    if (mode === "visual" && editor && !unsupportedReason) editor.commands.focus("end");
  }

  function reportUnsupported(reason) {
    unsupportedReason = reason;
    if (notice) {
      notice.hidden = !reason;
      notice.textContent = reason
        ? "本篇文章暂不支持可视化编辑：" + reason + " 正文已保留，请切换到 Markdown 源码模式编辑。"
        : "";
      notice.setAttribute("role", reason ? "status" : "none");
    }
    if (reason) {
      status("本篇文章已安全切换到 Markdown 源码模式：" + reason, true);
    }
    if ($("visualTab")) {
      $("visualTab").setAttribute("aria-disabled", reason ? "true" : "false");
      $("visualTab").disabled = Boolean(reason);
      $("visualTab").title = reason || "所见即所得编辑";
      $("visualTab").textContent = reason ? "可视化不可用" : "所见即所得";
    }
  }

  function syncSourceFromEditor() {
    if (!editor || loadingSource || unsupportedReason) return;
    const markdown = editor.getMarkdown();
    sourceField.value = frontmatterPrefix + markdown + (markdown && !markdown.endsWith("\n") ? "\n" : "");
    sourceField.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function loadSourceIntoEditor() {
    if (!editor) return;
    const current = sourceField.value;
    const split = splitFrontmatter(current);
    const reason = getUnsafeReason(split.body);
    if (reason) {
      frontmatterPrefix = split.prefix;
      lastLoadedSource = current;
      reportUnsupported(reason);
      setMode("source");
      return;
    }

    frontmatterPrefix = split.prefix;
    unsupportedReason = "";
    reportUnsupported("");
    loadingSource = true;
    try {
      editor.commands.setContent(split.body, { contentType: "markdown", emitUpdate: false });
      lastLoadedSource = current;
    } catch (error) {
      reportUnsupported("当前文档无法安全转换为可视化格式，请使用源码模式。");
      setMode("source");
    } finally {
      loadingSource = false;
    }
  }

  async function uploadImage(file) {
    if (!file || !file.type) return;
    if (!allowedImageTypes.has(file.type.toLowerCase())) {
      status("仅支持 PNG、JPEG、WebP 和 GIF 图片。", true);
      return;
    }
    if (file.size <= 0 || file.size > 4 * 1024 * 1024) {
      status("图片必须大于 0 且不超过 4 MiB，请压缩后重试。", true);
      return;
    }
    pendingUploads += 1;
    const toolbar = $("wysiwygUpload");
    if (toolbar) toolbar.disabled = true;
    status("正在上传图片到 GitHub，请稍候…");
    const form = new FormData();
    form.append("file", file, file.name || "image.png");
    try {
      const response = await fetch("/api/admin/upload/", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      if (response.status === 401) throw new Error("登录已过期，请重新登录。");
      const data = await response.json().catch(() => ({ error: "图片上传响应无法解析" }));
      if (!response.ok) throw new Error(data.error || "图片上传失败");
      if (!data.imageUrl) throw new Error("上传接口未返回图片地址，图片没有插入正文。");
      editor.chain().focus().setImage({
        src: data.imageUrl,
        alt: file.name || "文章图片",
        title: file.name || "",
      }).run();
      status("图片已上传并插入正文。图片文件已单独提交到 GitHub；文章正文仍需保存。");
    } catch (error) {
      status(error instanceof Error ? error.message : "图片上传失败。", true);
    } finally {
      pendingUploads = Math.max(0, pendingUploads - 1);
      if (toolbar) toolbar.disabled = pendingUploads > 0;
    }
  }

  function runAction(action) {
    if (!editor || unsupportedReason) {
      status("当前文档包含无法无损转换的语法，请先使用源码模式。", true);
      return;
    }
    const chain = editor.chain().focus();
    switch (action) {
      case "paragraph": chain.setParagraph().run(); break;
      case "h1": chain.toggleHeading({ level: 1 }).run(); break;
      case "h2": chain.toggleHeading({ level: 2 }).run(); break;
      case "h3": chain.toggleHeading({ level: 3 }).run(); break;
      case "bold": chain.toggleBold().run(); break;
      case "italic": chain.toggleItalic().run(); break;
      case "underline": chain.toggleUnderline().run(); break;
      case "strike": chain.toggleStrike().run(); break;
      case "bullet": chain.toggleBulletList().run(); break;
      case "ordered": chain.toggleOrderedList().run(); break;
      case "quote": chain.toggleBlockquote().run(); break;
      case "code": chain.toggleCodeBlock().run(); break;
      case "rule": chain.setHorizontalRule().run(); break;
      case "undo": chain.undo().run(); break;
      case "redo": chain.redo().run(); break;
      case "table":
        if (typeof editor.commands.insertTable === "function") {
          editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
        } else status("当前编辑器版本暂不支持插入表格。", true);
        break;
      case "link": {
        const existing = editor.getAttributes("link").href || "https://";
        const href = window.prompt("输入链接地址（https://、http:// 或 mailto:）", existing);
        if (href === null) return;
        const trimmed = href.trim();
        if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
          status("链接仅允许 http、https 或 mailto 地址。", true);
          return;
        }
        if (trimmed) chain.extendMarkRange("link").setLink({ href: trimmed }).run();
        break;
      }
      case "unlink": chain.unsetLink().run(); break;
      case "imagePicker": $("wysiwygFile")?.click(); break;
      default: break;
    }
    syncSourceFromEditor();
  }

  async function init() {
    const providerName = await loadTiptapModules();
    status("可视化编辑器模块加载成功（" + providerName + "）。");
    const initial = splitFrontmatter(sourceField.value);
    frontmatterPrefix = initial.prefix;
    unsupportedReason = getUnsafeReason(initial.body);

    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
          // Avoid duplicate ProseMirror plugin$ keys seen with some CDN module graphs.
          gapcursor: false,
          dropcursor: false,
        }),
        Markdown.configure({ markedOptions: { gfm: true } }),
        Image.configure({ inline: false, allowBase64: false }),
        TableKit,
      ],
      content: unsupportedReason ? "" : initial.body,
      contentType: "markdown",
      editorProps: {
        attributes: {
          class: "firefly-prosemirror-content",
          role: "textbox",
          "aria-label": "文章可视化编辑器",
          "aria-multiline": "true",
          spellcheck: "true",
        },
        handlePaste(_view, event) {
          const files = Array.from(event.clipboardData?.files || []);
          const image = files.find(file => allowedImageTypes.has(file.type.toLowerCase()));
          if (!image) return false;
          event.preventDefault();
          void uploadImage(image);
          return true;
        },
        handleDrop(_view, event) {
          const files = Array.from(event.dataTransfer?.files || []);
          const image = files.find(file => allowedImageTypes.has(file.type.toLowerCase()));
          if (!image) return false;
          event.preventDefault();
          void uploadImage(image);
          return true;
        },
      },
      onUpdate: () => syncSourceFromEditor(),
      onSelectionUpdate: ({ editor: activeEditor }) => {
        document.querySelectorAll("[data-editor-action]").forEach(button => {
          const action = button.getAttribute("data-editor-action");
          const state = {
            bold: activeEditor.isActive("bold"),
            italic: activeEditor.isActive("italic"),
            underline: activeEditor.isActive("underline"),
            strike: activeEditor.isActive("strike"),
            bullet: activeEditor.isActive("bulletList"),
            ordered: activeEditor.isActive("orderedList"),
            quote: activeEditor.isActive("blockquote"),
            code: activeEditor.isActive("codeBlock"),
            link: activeEditor.isActive("link"),
          }[action];
          button.classList.toggle("is-active", Boolean(state));
          button.setAttribute("aria-pressed", String(Boolean(state)));
        });
      },
    });

    const uploadButton = $("wysiwygUpload");
    const fileInput = $("wysiwygFile");
    uploadButton?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (file) void uploadImage(file);
    });
    document.querySelectorAll("[data-editor-action]").forEach(button => {
      button.addEventListener("click", () => runAction(button.getAttribute("data-editor-action")));
    });

    window.addEventListener("firefly:source-loaded", () => loadSourceIntoEditor());
    window.addEventListener("firefly:mode", event => {
      const mode = event.detail?.mode;
      if (mode === "visual") {
        activeMode = "visual";
        loadSourceIntoEditor();
      } else if (mode === "source" || mode === "preview") {
        activeMode = mode;
      }
    });
    sourceField.addEventListener("input", () => {
      if (activeMode !== "source") return;
      lastLoadedSource = sourceField.value;
      const split = splitFrontmatter(sourceField.value);
      frontmatterPrefix = split.prefix;
      reportUnsupported(getUnsafeReason(split.body));
    });

    const recoveryToggle = $("localRecoveryCheck");
    if (recoveryToggle) {
      try {
        recoveryToggle.checked = sessionStorage.getItem(recoveryEnabledKey) === "1";
      } catch {
        recoveryToggle.checked = false;
      }
      recoveryToggle.addEventListener("change", () => {
        try {
          if (recoveryToggle.checked) {
            sessionStorage.setItem(recoveryEnabledKey, "1");
            setRecoveryStatus("已开启本地恢复；带访问密码的文章不会保存到恢复区。");
            queueRecovery();
          } else {
            sessionStorage.removeItem(recoveryEnabledKey);
            sessionStorage.removeItem(recoveryKey);
            setRecoveryStatus("已关闭，当前本地恢复副本已删除。");
            refreshRecoveryAvailability();
          }
        } catch {
          setRecoveryStatus("浏览器不允许使用 sessionStorage，无法启用本地恢复。");
        }
      });
    }
    $("restoreLocalRecovery")?.addEventListener("click", restoreRecovery);
    $("editor")?.addEventListener("input", queueRecovery);
    $("editor")?.addEventListener("change", queueRecovery);
    window.addEventListener("firefly:source-loaded", refreshRecoveryAvailability);
    window.addEventListener("firefly:clear-recovery", event => clearRecovery(event.detail || {}));
    window.addEventListener("firefly:save-complete", event => clearRecovery(event.detail || {}));

    reportUnsupported(unsupportedReason);
    if (unsupportedReason) setMode("source");
    else setMode("visual");
    loadSourceIntoEditor();
    refreshRecoveryAvailability();

    window.FireflyRichEditor = {
      isBusy: () => pendingUploads > 0,
      hasUnsupportedSyntax: () => Boolean(unsupportedReason),
      reload: loadSourceIntoEditor,
      getMarkdown: () => editor ? editor.getMarkdown() : "",
      destroy: () => editor?.destroy(),
    };
    window.dispatchEvent(new CustomEvent("firefly:wysiwyg-ready", { detail: { ok: true } }));
  }

  init().catch(error => {
    console.error("Firefly WYSIWYG editor failed to initialize:", error);
    pane.hidden = true;
    sourceField.hidden = false;
    if ($("visualTab")) { $("visualTab").disabled = true; $("visualTab").textContent = "可视化编辑器不可用"; }
    $("wysiwygFallback") && ($("wysiwygFallback").hidden = false);
    window.dispatchEvent(new CustomEvent("firefly:wysiwyg-ready", { detail: { ok: false } }));
    const detail = error instanceof Error ? error.message : String(error);
    status("可视化编辑器加载失败，已回退到 Markdown 源码模式；正文内容未被修改。原因：" + detail, true);
    if ($("wysiwygFallback")) {
      $("wysiwygFallback").textContent = "加载失败详情：" + detail + "。若错误包含 plugin$，通常是编辑器插件/依赖实例冲突，不一定是网络问题；正文仍可在 Markdown 源码模式编辑。";
    }
  });
})();
