import { prepareMarkdownForVisualEditing, restoreProtectedMarkdown } from "/admin-markdown-guard.js?v=0d32c47f";

let Editor, NodeExtension, StarterKit, Markdown, Image, TableKit;

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
      NodeExtension = core.Node;
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
  let visualLoadFailed = false;
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
    if (mode === "visual" && editor && !visualLoadFailed) editor.commands.focus("end");
  }

  function reportProtected(records) {
    const items = Array.isArray(records) ? records : [];
    const count = items.length;
    const types = [...new Set(items.map(item => item.reason).filter(Boolean))].join("、");
    visualLoadFailed = false;
    if (notice) {
      notice.hidden = count === 0;
      notice.textContent = count
        ? "已启用混合可视化编辑：检测到 " + count + " 段扩展 Markdown/MDX 语法，已封装为可保真的“保留语法块”。普通正文可继续可视化编辑；需要修改语法本身时，点击对应块中的“编辑语法”。类型：" + types + "。"
        : "";
      notice.setAttribute("role", count ? "status" : "none");
    }
    if ($("visualTab")) {
      $("visualTab").disabled = false;
      $("visualTab").setAttribute("aria-disabled", "false");
      $("visualTab").title = "所见即所得编辑；复杂 Markdown/MDX 语法以保留块显示";
      $("visualTab").textContent = "所见即所得";
    }
    if (count) status("已保护 " + count + " 段特殊语法；其他正文仍可可视化编辑。");
  }

  function reportVisualLoadFailure(error) {
    visualLoadFailed = true;
    const detail = error instanceof Error ? error.message : String(error);
    if (notice) {
      notice.hidden = false;
      notice.textContent = "可视化编辑器无法安全载入本篇内容，原始正文未被改写。请使用 Markdown 源码模式编辑。错误：" + detail;
      notice.setAttribute("role", "alert");
    }
    if ($("visualTab")) {
      $("visualTab").disabled = true;
      $("visualTab").setAttribute("aria-disabled", "true");
      $("visualTab").title = detail;
      $("visualTab").textContent = "可视化不可用";
    }
    status("可视化加载失败，已保留原始正文并回退源码模式：" + detail, true);
  }

  let protectedSyntaxDialog = null;
  let protectedSyntaxTextarea = null;
  let protectedSyntaxTarget = null;

  function ensureProtectedSyntaxDialog() {
    if (protectedSyntaxDialog) {
      return { dialog: protectedSyntaxDialog, textarea: protectedSyntaxTextarea };
    }

    const style = document.createElement("style");
    style.textContent = [
      ".firefly-protected-markdown{border:1px dashed #b7a58a;border-radius:10px;background:#faf8f3;padding:10px 12px;margin:10px 0;color:#463f35;}",
      ".firefly-protected-markdown__head{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;font-weight:650;margin-bottom:7px;}",
      ".firefly-protected-markdown__preview{max-height:190px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;color:#57534e;}",
      ".firefly-protected-markdown__edit{border:1px solid #d6c7ad;border-radius:7px;padding:4px 9px;background:#fff;font-size:12px;cursor:pointer;}",
      ".firefly-protected-dialog{width:min(860px,calc(100vw - 28px));max-width:none;border:1px solid #d8d1c4;border-radius:14px;padding:18px;background:#fff;color:#292524;box-shadow:0 24px 80px #0003;}",
      ".firefly-protected-dialog::backdrop{background:#17171780;backdrop-filter:blur(2px);}",
      ".firefly-protected-dialog textarea{display:block;width:100%;min-height:42vh;resize:vertical;border:1px solid #d6d3d1;border-radius:9px;padding:10px;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;}",
      ".firefly-protected-dialog__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px;}",
      ".firefly-protected-dialog button{border:1px solid #d6d3d1;border-radius:8px;padding:7px 13px;background:#fff;cursor:pointer;}",
      ".firefly-protected-dialog button[type=submit]{background:#292524;color:#fff;border-color:#292524;}"
    ].join("");
    document.head.append(style);

    const dialog = document.createElement("dialog");
    dialog.className = "firefly-protected-dialog";
    const heading = document.createElement("h3");
    heading.textContent = "编辑保留的 Markdown/MDX 语法";
    heading.style.cssText = "font-size:16px;font-weight:700;margin:0 0 8px";
    const description = document.createElement("p");
    description.textContent = "这里修改的是原始语法片段。保存后会原样写回文章正文，不会由可视化编辑器重新格式化。";
    description.style.cssText = "font-size:13px;color:#78716c;margin:0 0 12px";
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "原始 Markdown/MDX 语法");
    const actions = document.createElement("div");
    actions.className = "firefly-protected-dialog__actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "保存语法块";
    const form = document.createElement("form");
    form.addEventListener("submit", event => {
      event.preventDefault();
      const target = protectedSyntaxTarget;
      if (!target) {
        dialog.close();
        return;
      }
      const pos = target.getPos();
      if (typeof pos !== "number") {
        dialog.close();
        status("语法块已不在文档中，请重新选择后再编辑。", true);
        return;
      }
      const current = target.editor.state.doc.nodeAt(pos);
      if (!current || current.type.name !== "protectedMarkdownBlock") {
        dialog.close();
        status("无法定位语法块，已取消修改。", true);
        return;
      }
      target.editor.view.dispatch(
        target.editor.state.tr.setNodeMarkup(pos, undefined, {
          ...current.attrs,
          raw: textarea.value,
        }),
      );
      protectedSyntaxTarget = null;
      dialog.close();
    });
    cancel.addEventListener("click", () => {
      protectedSyntaxTarget = null;
      dialog.close();
    });
    actions.append(cancel, save);
    form.append(textarea, actions);
    dialog.append(heading, description, form);
    document.body.append(dialog);
    protectedSyntaxDialog = dialog;
    protectedSyntaxTextarea = textarea;
    return { dialog, textarea };
  }

  function openProtectedSyntaxEditor(activeEditor, getPos, node) {
    const ui = ensureProtectedSyntaxDialog();
    protectedSyntaxTarget = { editor: activeEditor, getPos };
    ui.textarea.value = typeof node.attrs.raw === "string" ? node.attrs.raw : "";
    if (typeof ui.dialog.showModal === "function") ui.dialog.showModal();
    else ui.dialog.setAttribute("open", "");
    ui.textarea.focus();
    ui.textarea.setSelectionRange(0, 0);
  }

  function createProtectedMarkdownBlock() {
    return NodeExtension.create({
      name: "protectedMarkdownBlock",
      group: "block",
      atom: true,
      selectable: true,
      draggable: false,
      isolating: true,
      addAttributes() {
        return {
          marker: { default: "" },
          raw: { default: "" },
          reason: { default: "扩展 Markdown" },
        };
      },
      parseHTML() {
        return [{ tag: "div[data-firefly-protected-markdown]" }];
      },
      renderHTML({ node }) {
        return ["div", { "data-firefly-protected-markdown": "true" },
          ["strong", {}, "保留语法块"],
          ["pre", {}, node.attrs.raw || ""],
        ];
      },
      renderMarkdown(node) {
        return node.attrs.marker || "";
      },
      addNodeView() {
        return ({ node, editor: activeEditor, getPos }) => {
          const root = document.createElement("div");
          root.className = "firefly-protected-markdown";
          root.contentEditable = "false";
          root.setAttribute("data-firefly-protected-markdown", "true");
          let currentNode = node;

          const render = () => {
            root.replaceChildren();
            const header = document.createElement("div");
            header.className = "firefly-protected-markdown__head";
            const label = document.createElement("span");
            label.textContent = "保留原始语法 · " + (currentNode.attrs.reason || "扩展 Markdown");
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "firefly-protected-markdown__edit";
            edit.textContent = "编辑语法";
            edit.addEventListener("mousedown", event => event.preventDefault());
            edit.addEventListener("click", event => {
              event.preventDefault();
              event.stopPropagation();
              openProtectedSyntaxEditor(activeEditor, getPos, currentNode);
            });
            header.append(label, edit);
            const preview = document.createElement("pre");
            preview.className = "firefly-protected-markdown__preview";
            const raw = typeof currentNode.attrs.raw === "string" ? currentNode.attrs.raw : "";
            preview.textContent = raw.length > 1200
              ? raw.slice(0, 1200) + "\n… 预览已截断，保存时仍保留完整内容。"
              : raw;
            root.append(header, preview);
          };
          render();

          return {
            dom: root,
            update(nextNode) {
              if (nextNode.type.name !== "protectedMarkdownBlock") return false;
              currentNode = nextNode;
              render();
              return true;
            },
            stopEvent(event) {
              return Boolean(event.target instanceof Element && event.target.closest("button"));
            },
            ignoreMutation() {
              return true;
            },
          };
        };
      },
    });
  }

  function replaceProtectedMarkerParagraphs(activeEditor, records) {
    if (!records.length) return;
    const lookup = new Map(records.map(record => [record.marker, record]));
    const json = activeEditor.getJSON();
    function textOf(node) {
      if (!node) return "";
      if (typeof node.text === "string") return node.text;
      return (node.content || []).map(textOf).join("");
    }
    json.content = (json.content || []).map(node => {
      if (node.type !== "paragraph") return node;
      const record = lookup.get(textOf(node));
      if (!record) return node;
      return {
        type: "protectedMarkdownBlock",
        attrs: { marker: record.marker, raw: record.raw, reason: record.reason },
      };
    });
    activeEditor.commands.setContent(json, { emitUpdate: false });
  }

  function syncSourceFromEditor() {
    if (!editor || loadingSource || visualLoadFailed) return;
    const markdown = editor.getMarkdown();
    const records = [];
    editor.state.doc.descendants(node => {
      if (node.type.name === "protectedMarkdownBlock") {
        records.push({ marker: node.attrs.marker, raw: node.attrs.raw });
      }
    });
    const restored = restoreProtectedMarkdown(markdown, records);
    sourceField.value = frontmatterPrefix + restored + (restored && !restored.endsWith("\n") ? "\n" : "");
    sourceField.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function loadSourceIntoEditor() {
    if (!editor) return false;
    const current = sourceField.value || "";
    const split = splitFrontmatter(current);
    const prepared = prepareMarkdownForVisualEditing(split.body);
    frontmatterPrefix = split.prefix;
    loadingSource = true;
    try {
      editor.commands.setContent(prepared.markdown, { contentType: "markdown", emitUpdate: false });
      replaceProtectedMarkerParagraphs(editor, prepared.records);
      lastLoadedSource = current;
      reportProtected(prepared.records);
      return true;
    } catch (error) {
      reportVisualLoadFailure(error);
      setMode("source");
      return false;
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
    if (!editor || visualLoadFailed) {
      status("当前文档未能安全载入可视化编辑器，请先使用源码模式。", true);
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
    frontmatterPrefix = splitFrontmatter(sourceField.value).prefix;

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
        createProtectedMarkdownBlock(),
      ],
      content: "",
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
      reportProtected(prepareMarkdownForVisualEditing(split.body).records);
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

    const loadedVisually = loadSourceIntoEditor();
    if (loadedVisually) setMode("visual");
    refreshRecoveryAvailability();

    window.FireflyRichEditor = {
      isBusy: () => pendingUploads > 0,
      hasUnsupportedSyntax: () => Boolean(visualLoadFailed),
      reload: loadSourceIntoEditor,
      getMarkdown: () => {
        if (!editor) return "";
        const records = [];
        editor.state.doc.descendants(node => {
          if (node.type.name === "protectedMarkdownBlock") records.push({ marker: node.attrs.marker, raw: node.attrs.raw });
        });
        return restoreProtectedMarkdown(editor.getMarkdown(), records);
      },
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
