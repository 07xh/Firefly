import { Editor } from "https://cdn.jsdelivr.net/npm/@tiptap/core@3.31.3/+esm";
import StarterKit from "https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@3.31.3/+esm";
import { Markdown } from "https://cdn.jsdelivr.net/npm/@tiptap/markdown@3.31.3/+esm";
import Image from "https://cdn.jsdelivr.net/npm/@tiptap/extension-image@3.31.3/+esm";
import { TableKit } from "https://cdn.jsdelivr.net/npm/@tiptap/extension-table@3.31.3/+esm";

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

  function getUnsafeReason(markdown) {
    // Ignore fenced code: imports and angle-bracket examples inside code are safe text.
    const withoutFences = markdown
      .replace(/^\s*\`\`\`[\\s\\S]*?^\s*\`\`\`\s*$/gm, "")
      .replace(/^\s*~~~[\\s\\S]*?^\s*~~~\s*$/gm, "");
    if (/^\s*(?:import|export)\s/m.test(withoutFences)) {
      return "正文包含 MDX import/export 语句。为避免组件丢失，请使用 Markdown 源码模式编辑。";
    }
    if (/<\/?[A-Z][A-Za-z0-9_.:-]*(?:\s|\/?>)/.test(withoutFences)) {
      return "正文包含自定义 MDX/组件标签。为避免破坏组件，请使用 Markdown 源码模式编辑。";
    }
    if (/<\/?(?:script|style|iframe|video|audio|div|section|details|summary|table|kbd|sup|sub|span|u|figure|figcaption)\b/i.test(withoutFences)) {
      return "正文包含 HTML 或主题特殊标签。为避免转换丢失属性，请使用 Markdown 源码模式编辑。";
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
    if (mode === "visual" && editor && !unsupportedReason) editor.commands.focus("end");
  }

  function reportUnsupported(reason) {
    unsupportedReason = reason;
    if (notice) {
      notice.hidden = !reason;
      notice.textContent = reason || "";
      notice.setAttribute("role", reason ? "status" : "none");
    }
    if ($("visualTab")) {
      $("visualTab").setAttribute("aria-disabled", reason ? "true" : "false");
      $("visualTab").title = reason || "所见即所得编辑";
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
    const initial = splitFrontmatter(sourceField.value);
    frontmatterPrefix = initial.prefix;
    unsupportedReason = getUnsafeReason(initial.body);

    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4, 5, 6] },
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
      if (event.detail?.mode === "visual") loadSourceIntoEditor();
    });
    sourceField.addEventListener("input", () => {
      if (activeMode === "source") lastLoadedSource = sourceField.value;
    });

    reportUnsupported(unsupportedReason);
    if (unsupportedReason) setMode("source");
    else setMode("visual");
    loadSourceIntoEditor();

    window.FireflyRichEditor = {
      isBusy: () => pendingUploads > 0,
      hasUnsupportedSyntax: () => Boolean(unsupportedReason),
      reload: loadSourceIntoEditor,
      getMarkdown: () => editor ? editor.getMarkdown() : "",
      destroy: () => editor?.destroy(),
    };
  }

  init().catch(error => {
    console.error("Firefly WYSIWYG editor failed to initialize:", error);
    pane.hidden = true;
    sourceField.hidden = false;
    $("wysiwygFallback") && ($("wysiwygFallback").hidden = false);
    status("可视化编辑器加载失败，已回退到 Markdown 源码模式；正文内容未被修改。", true);
  });
})();
