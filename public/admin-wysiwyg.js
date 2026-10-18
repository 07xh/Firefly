import { prepareMarkdownForVisualEditing, restoreProtectedMarkdown } from "/admin-markdown-guard.js?v=20261018-callouts";
import { inspectProtectedMarkdown } from "/admin-visual-preview.js?v=20261018-visual-blocks";

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


  const GLOBAL_MDX_COMPONENT_NAMES = new Set([
    "Badge", "StepItem", "Steps", "TabGroup", "Timeline", "TimelineItem",
  ]);

  // Remove only redundant top-of-document imports from the global registry.
  // Other imports, aliases, code examples and mid-document text are untouched.
  function stripGlobalComponentImports(markdown) {
    const lines = String(markdown || "").split("\n");
    const output = [];
    let preamble = true;
    let removed = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] || "";
      if (!preamble) {
        output.push(...lines.slice(i));
        break;
      }
      if (/^[ \t]*$/.test(line)) {
        output.push(line);
        continue;
      }
      if (!/^[ \t]*import\b/.test(line)) {
        preamble = false;
        output.push(...lines.slice(i));
        break;
      }

      let end = i;
      let declaration = line;
      let match = declaration.match(/^\s*import\s*\{([\s\S]*?)\}\s*from\s*(["'])(@\/components\/firefly-mdx|@components\/firefly-mdx)\2\s*;?\s*$/);
      while (!match && end + 1 < lines.length && end - i < 24 && !/^[ \t]*$/.test(lines[end + 1])) {
        end += 1;
        declaration += "\n" + lines[end];
        match = declaration.match(/^\s*import\s*\{([\s\S]*?)\}\s*from\s*(["'])(@\/components\/firefly-mdx|@components\/firefly-mdx)\2\s*;?\s*$/);
      }

      if (match) {
        const names = match[1].split(",").map((value) => value.trim()).filter(Boolean);
        const isSafeRedundantImport = names.length > 0 && names.every((name) =>
          /^[A-Z][A-Za-z0-9_]*$/.test(name) && GLOBAL_MDX_COMPONENT_NAMES.has(name)
        );
        if (isSafeRedundantImport) {
          removed += 1;
          i = end;
          continue;
        }
      }

      output.push(...lines.slice(i, end + 1));
      i = end;
    }

    let source = output.join("\n");
    if (removed) source = source.replace(/^(?:[ \t]*\r?\n)+/, "");
    return { source, removed };
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


  const CALLOUT_TYPES = ["tip", "warning", "danger", "info", "success", "note", "important", "caution"];
  const CALLOUT_TITLES = {
    tip: "提示",
    warning: "注意",
    danger: "警告",
    info: "信息",
    success: "成功",
    note: "备注",
    important: "重要",
    caution: "谨慎",
  };

  function normalizeCalloutType(value) {
    const type = String(value || "").toLowerCase();
    return CALLOUT_TYPES.includes(type) ? type : "tip";
  }

  function ensureCalloutStyles() {
    if (document.getElementById("firefly-callout-editor-styles")) return;
    const style = document.createElement("style");
    style.id = "firefly-callout-editor-styles";
    style.textContent = [
      ".firefly-callout{--firefly-callout-color:#0e7490;border:1px solid color-mix(in srgb,var(--firefly-callout-color) 22%,transparent);border-left:4px solid var(--firefly-callout-color);border-radius:10px;padding:11px 14px;margin:14px 0;background:color-mix(in srgb,var(--firefly-callout-color) 6%,white);color:#292524;}",
      ".firefly-callout--tip{--firefly-callout-color:#0e7490}.firefly-callout--info{--firefly-callout-color:#2563eb}.firefly-callout--note{--firefly-callout-color:#64748b}.firefly-callout--warning,.firefly-callout--caution{--firefly-callout-color:#b45309}.firefly-callout--danger{--firefly-callout-color:#dc2626}.firefly-callout--important{--firefly-callout-color:#7c3aed}.firefly-callout--success{--firefly-callout-color:#15803d}",
      ".firefly-callout__head{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:8px;font-size:12px;line-height:1.5}",
      ".firefly-callout__title{font-size:13px;font-weight:750;color:var(--firefly-callout-color)}",
      ".firefly-callout__select,.firefly-callout__edit-title{border:1px solid color-mix(in srgb,var(--firefly-callout-color) 24%,#d6d3d1);border-radius:6px;background:#fff;color:#57534e;padding:3px 7px;font:inherit;cursor:pointer}",
      ".firefly-callout__select{margin-left:auto;max-width:145px}.firefly-callout__content{min-height:1.5em;line-height:1.75;font-size:14px;outline:none}",
      ".firefly-callout__content>:first-child{margin-top:0}.firefly-callout__content>:last-child{margin-bottom:0}.firefly-callout__content p{margin:5px 0}",
      ".firefly-callout.ProseMirror-selectednode{outline:2px solid color-mix(in srgb,var(--firefly-callout-color) 45%,transparent);outline-offset:2px}",
      "@media(prefers-color-scheme:dark){.firefly-callout{background:color-mix(in srgb,var(--firefly-callout-color) 12%,#18181b);color:#e7e5e4}.firefly-callout__select,.firefly-callout__edit-title{background:#27272a;color:#e7e5e4;border-color:#52525b}}",
    ].join("\n");
    document.head.append(style);
  }

  function createCalloutBlock() {
    return NodeExtension.create({
      name: "fireflyCallout",
      group: "block",
      content: "block+",
      defining: true,
      isolating: true,

      addAttributes() {
        return {
          type: {
            default: "tip",
            parseHTML: element => normalizeCalloutType(element.getAttribute("data-type")),
            renderHTML: attributes => ({ "data-type": normalizeCalloutType(attributes.type) }),
          },
          title: {
            default: "",
            parseHTML: element => element.getAttribute("data-title") || "",
            renderHTML: attributes => ({ "data-title": String(attributes.title || "") }),
          },
        };
      },

      parseHTML() {
        return [{ tag: "aside[data-firefly-callout]" }];
      },

      renderHTML({ node, HTMLAttributes }) {
        const type = normalizeCalloutType(node.attrs.type);
        const title = String(node.attrs.title || "").trim() || CALLOUT_TITLES[type];
        return ["aside", {
          ...HTMLAttributes,
          "data-firefly-callout": "true",
          "data-type": type,
          class: "firefly-callout firefly-callout--" + type,
        },
          ["div", { class: "firefly-callout__head" },
            ["strong", { class: "firefly-callout__title" }, title],
          ],
          ["div", { class: "firefly-callout__content" }, 0],
        ];
      },

      markdownTokenizer: {
        name: "fireflyCallout",
        level: "block",
        start: source => source.indexOf(":::"),
        tokenize(source, _tokens, lexer) {
          const opening = /^ {0,3}:{3,}[ \t]*(tip|warning|danger|info|success|note|important|caution)(?:\[([^\]\r\n]*)\]|[ \t]+([^\r\n]*?))?[ \t]*\r?\n/i.exec(source);
          if (!opening) return undefined;

          const lines = source.split("\n");
          let depth = 1;
          let fence = null;
          let closingLine = -1;

          for (let i = 1; i < lines.length; i += 1) {
            const line = (lines[i] || "").replace(/\r$/, "");
            if (fence) {
              const closingFence = line.match(/^ {0,3}(\x60{3,}|~{3,})[ \t]*$/);
              if (closingFence && closingFence[1][0] === fence.char && closingFence[1].length >= fence.length) {
                fence = null;
              }
              continue;
            }

            const openingFence = line.match(/^ {0,3}(\x60{3,}|~{3,})/);
            if (openingFence) {
              fence = { char: openingFence[1][0], length: openingFence[1].length };
              continue;
            }

            if (/^ {0,3}:{3,}[ \t]*$/.test(line)) {
              depth -= 1;
              if (depth === 0) {
                closingLine = i;
                break;
              }
              continue;
            }

            if (/^ {0,3}:{3,}[ \t]*[A-Za-z][A-Za-z0-9_-]*(?:\[[^\]\r\n]*\]|[ \t]+.*)?[ \t]*$/.test(line)) {
              depth += 1;
            }
          }

          if (closingLine < 0) return undefined;
          let consumed = 0;
          for (let i = 0; i <= closingLine; i += 1) {
            consumed += lines[i].length;
            if (i < closingLine || source[consumed] === "\n") consumed += 1;
          }
          const type = String(opening[1] || "tip").toLowerCase();
          const inner = lines.slice(1, closingLine).join("\n").replace(/\r$/gm, "");
          return {
            type: "fireflyCallout",
            raw: source.slice(0, consumed),
            calloutType: type,
            calloutTitle: String(opening[2] ?? opening[3] ?? "").trim(),
            text: inner,
            tokens: lexer.blockTokens(inner),
          };
        },
      },

      parseMarkdown(token, helpers) {
        return {
          type: "fireflyCallout",
          attrs: {
            type: normalizeCalloutType(token.calloutType),
            title: String(token.calloutTitle || ""),
          },
          content: helpers.parseBlockChildren
            ? helpers.parseBlockChildren(token.tokens || [])
            : helpers.parseChildren(token.tokens || []),
        };
      },

      renderMarkdown(node, helpers) {
        const type = normalizeCalloutType(node.attrs?.type);
        const title = String(node.attrs?.title || "").trim();
        const body = helpers.renderChildren(node.content || []).replace(/\n+$/, "");
        return ":::"
          + type
          + (title ? "[" + title.replace(/[\]\r\n]/g, " ") + "]" : "")
          + "\n"
          + body
          + "\n:::\n\n";
      },

      addNodeView() {
        return ({ node, editor: activeEditor, getPos }) => {
          const root = document.createElement("aside");
          root.className = "firefly-callout";
          root.setAttribute("data-firefly-callout", "true");
          const header = document.createElement("div");
          header.className = "firefly-callout__head";
          const contentDOM = document.createElement("div");
          contentDOM.className = "firefly-callout__content";
          root.append(header, contentDOM);
          let currentNode = node;

          const updateAttributes = patch => {
            const position = getPos();
            if (typeof position !== "number") return;
            const current = activeEditor.state.doc.nodeAt(position);
            if (!current || current.type.name !== "fireflyCallout") return;
            activeEditor.view.dispatch(
              activeEditor.state.tr.setNodeMarkup(position, undefined, {
                ...current.attrs,
                ...patch,
              }),
            );
          };

          const renderHeader = () => {
            const type = normalizeCalloutType(currentNode.attrs.type);
            const title = String(currentNode.attrs.title || "").trim() || CALLOUT_TITLES[type];
            root.className = "firefly-callout firefly-callout--" + type;
            root.setAttribute("data-type", type);
            root.setAttribute("data-title", String(currentNode.attrs.title || ""));
            header.replaceChildren();

            const titleLabel = document.createElement("strong");
            titleLabel.className = "firefly-callout__title";
            titleLabel.textContent = title;
            header.append(titleLabel);

            const editTitle = document.createElement("button");
            editTitle.type = "button";
            editTitle.className = "firefly-callout__edit-title";
            editTitle.textContent = "编辑标题";
            editTitle.addEventListener("mousedown", event => event.preventDefault());
            editTitle.addEventListener("click", event => {
              event.preventDefault();
              event.stopPropagation();
              const value = window.prompt("提示块标题（留空使用默认标题）", String(currentNode.attrs.title || ""));
              if (value !== null) updateAttributes({ title: value.trim() });
            });
            header.append(editTitle);

            const select = document.createElement("select");
            select.className = "firefly-callout__select";
            select.setAttribute("aria-label", "提示块类型");
            for (const optionType of CALLOUT_TYPES) {
              const option = document.createElement("option");
              option.value = optionType;
              option.textContent = CALLOUT_TITLES[optionType];
              select.append(option);
            }
            select.value = type;
            select.addEventListener("mousedown", event => event.stopPropagation());
            select.addEventListener("change", () => updateAttributes({ type: normalizeCalloutType(select.value) }));
            header.append(select);
          };

          renderHeader();
          return {
            dom: root,
            contentDOM,
            update(nextNode) {
              if (nextNode.type.name !== "fireflyCallout") return false;
              currentNode = nextNode;
              renderHeader();
              return true;
            },
            stopEvent(event) {
              return header.contains(event.target);
            },
            ignoreMutation(mutation) {
              return header.contains(mutation.target);
            },
          };
        };
      },
    });
  }

  function visualPreviewElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function ensureProtectedVisualPreviewStyles() {
    if (document.getElementById("firefly-visual-preview-styles")) return;
    const style = document.createElement("style");
    style.id = "firefly-visual-preview-styles";
    style.textContent = [
      ".firefly-visual-preview{display:grid;gap:9px;min-width:0;color:#27342b;font-size:13px;line-height:1.65}",
      ".firefly-visual-preview__eyebrow{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#718075;font-weight:750}",
      ".firefly-visual-preview__title{font-size:15px;font-weight:750;line-height:1.4;margin:0;color:#25372b;overflow-wrap:anywhere}",
      ".firefly-visual-preview__text{white-space:pre-wrap;overflow-wrap:anywhere;color:#46554a}",
      ".firefly-visual-preview__muted{font-size:12px;color:#738076}",
      ".firefly-visual-preview__props{display:flex;flex-wrap:wrap;gap:5px}",
      ".firefly-visual-preview__prop{border:1px solid #d6e2d7;background:#f6faf6;border-radius:6px;padding:2px 7px;font-size:11px;color:#55705a;overflow-wrap:anywhere}",
      ".firefly-visual-preview__badge{display:inline-flex;vertical-align:middle;margin:2px 4px;padding:2px 9px;border-radius:999px;background:#e4f5eb;color:#147744;border:1px solid #c4e8d1;font-size:11px;font-weight:750}",
      ".firefly-visual-preview__badge--warning,.firefly-visual-preview__badge--caution{background:#fff4dc;color:#925c05;border-color:#f1d8a0}",
      ".firefly-visual-preview__badge--danger{background:#ffebeb;color:#b42323;border-color:#f2c4c4}",
      ".firefly-visual-preview__badge--important{background:#f1eaff;color:#7041ac;border-color:#ded0f7}",
      ".firefly-visual-preview__badge--note{background:#f1f4f6;color:#58636f;border-color:#dce2e7}",
      ".firefly-visual-preview__callout{border:1px solid #cfe4d4;border-left:4px solid #16834c;background:#f4fbf5;border-radius:9px;padding:11px 13px;display:grid;gap:6px}",
      ".firefly-visual-preview__callout--warning,.firefly-visual-preview__callout--caution{border-color:#f0d9a6;border-left-color:#b7791f;background:#fffaf0}",
      ".firefly-visual-preview__callout--danger{border-color:#f0c3c3;border-left-color:#dc2626;background:#fff6f6}",
      ".firefly-visual-preview__callout--important{border-color:#ddd0fa;border-left-color:#7c3aed;background:#faf7ff}",
      ".firefly-visual-preview__callout--info{border-color:#c9defb;border-left-color:#2563eb;background:#f5f9ff}",
      ".firefly-visual-preview__list{display:grid;gap:7px;margin:0;padding:0;list-style:none}",
      ".firefly-visual-preview__item{display:grid;grid-template-columns:25px minmax(0,1fr);gap:9px;align-items:start;border:1px solid #e2e9e2;border-radius:9px;padding:9px 10px;background:#fff}",
      ".firefly-visual-preview__number{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#e2f4e8;color:#16834c;font-weight:800;font-size:11px}",
      ".firefly-visual-preview__item-title{font-weight:750;color:#304237;overflow-wrap:anywhere}",
      ".firefly-visual-preview__item-meta{font-size:11px;color:#728074;margin-bottom:2px}",
      ".firefly-visual-preview__panel{border:1px solid #dfe7df;border-radius:8px;overflow:hidden;background:#fff;min-width:0}",
      ".firefly-visual-preview__panel-head{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 10px;background:#f2f7f2;border-bottom:1px solid #e0e8e0;font-weight:700}",
      ".firefly-visual-preview__panel pre{margin:0;padding:10px;overflow:auto;max-height:180px;background:#fbfcfb;color:#344139;font:12px/1.6 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".firefly-visual-preview__math{display:block;white-space:pre-wrap;overflow:auto;padding:12px;border-radius:8px;text-align:center;background:#f7f8fa;border:1px solid #e1e5ea;color:#344054;font:14px/1.8 ui-serif,Georgia,serif;overflow-wrap:anywhere}",
      ".firefly-visual-preview__todo{display:flex;align-items:flex-start;gap:8px;padding:3px 0;color:#3e4d42}",
      ".firefly-visual-preview__todo input{margin-top:5px;accent-color:#16834c}",
      ".firefly-visual-preview__link{display:inline-flex;align-items:center;gap:7px;border:1px solid #d7e6db;background:#f6fbf7;padding:6px 10px;border-radius:8px;color:#167346;font-weight:700;overflow-wrap:anywhere}",
      ".firefly-visual-preview__embed{display:flex;align-items:center;gap:10px;padding:12px;border:1px dashed #c9d8cc;border-radius:9px;background:#f7faf7}",
      ".firefly-visual-preview__icon{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:#e4f4e9;color:#176c3c;font-size:18px;font-weight:800;flex:0 0 auto}",
      ".firefly-visual-preview__empty{padding:10px;border:1px dashed #d7ded7;border-radius:8px;background:#fafcfa;color:#69776d}",
      "@media(prefers-color-scheme:dark){.firefly-visual-preview{color:#e5ebe5}.firefly-visual-preview__title,.firefly-visual-preview__item-title{color:#e7efe7}.firefly-visual-preview__text{color:#d0d8d0}.firefly-visual-preview__item,.firefly-visual-preview__panel{background:#202820;border-color:#3b493d}.firefly-visual-preview__panel-head{background:#273328;border-color:#3b493d}.firefly-visual-preview__panel pre,.firefly-visual-preview__math,.firefly-visual-preview__empty{background:#1a211b;color:#d7e2d8;border-color:#3b493d}.firefly-visual-preview__prop{background:#26352a;color:#c0dfc7;border-color:#3c5943}.firefly-visual-preview__callout{background:#1d2b21;color:#dce8de;border-color:#3b6045}.firefly-visual-preview__callout--warning,.firefly-visual-preview__callout--caution{background:#2b2519;border-color:#66502d}.firefly-visual-preview__callout--danger{background:#2d1e1e;border-color:#6b3434}.firefly-visual-preview__callout--important{background:#292035;border-color:#59457b}.firefly-visual-preview__callout--info{background:#1c2635;border-color:#385783}.firefly-visual-preview__link{background:#203328;border-color:#3d6048;color:#a5e5b8}.firefly-visual-preview__embed{background:#202820;border-color:#465749}}",
    ].join("\n");
    document.head.append(style);
  }

  function createProtectedVisualPreview(raw, reason) {
    ensureProtectedVisualPreviewStyles();
    const model = inspectProtectedMarkdown(raw, reason);
    const preview = visualPreviewElement("div", "firefly-visual-preview firefly-visual-preview--" + model.kind);
    const heading = (title, extraClass = "") => preview.append(visualPreviewElement("div", "firefly-visual-preview__title" + (extraClass ? " " + extraClass : ""), title));
    const paragraph = (text, className = "firefly-visual-preview__text") => {
      if (text) preview.append(visualPreviewElement("div", className, text));
    };
    const propertyList = (attributes, parent = preview) => {
      if (!attributes?.length) return;
      const wrap = visualPreviewElement("div", "firefly-visual-preview__props");
      for (const item of attributes) {
        const chip = visualPreviewElement("span", "firefly-visual-preview__prop", item.name + "=" + item.value);
        wrap.append(chip);
      }
      parent.append(wrap);
    };
    const appendItems = (items, kind) => {
      if (!items?.length) {
        paragraph("组件已识别，但没有可摘要的子项。");
        return;
      }
      const list = visualPreviewElement(kind === "steps" ? "ol" : "div", "firefly-visual-preview__list");
      items.forEach((item, index) => {
        const row = visualPreviewElement("div", "firefly-visual-preview__item");
        row.append(visualPreviewElement("span", "firefly-visual-preview__number", kind === "timeline" ? "●" : String(index + 1)));
        const main = visualPreviewElement("div", "");
        if (item.date) main.append(visualPreviewElement("div", "firefly-visual-preview__item-meta", item.date));
        main.append(visualPreviewElement("div", "firefly-visual-preview__item-title", item.title || ("第 " + (index + 1) + " 项")));
        if (item.text) main.append(visualPreviewElement("div", "firefly-visual-preview__text", item.text));
        row.append(main);
        list.append(row);
      });
      preview.append(list);
    };

    if (model.kind === "callout") {
      const callout = visualPreviewElement("div", "firefly-visual-preview__callout firefly-visual-preview__callout--" + model.type);
      const title = model.title || ({ tip: "提示", warning: "注意", danger: "警告", info: "信息", success: "成功", note: "备注", important: "重要", caution: "谨慎" }[model.type] || "提示");
      callout.append(visualPreviewElement("div", "firefly-visual-preview__title", title));
      callout.append(visualPreviewElement("div", "firefly-visual-preview__text", model.text || "此容器暂时没有可显示的正文。"));
      preview.append(callout);
    } else if (model.kind === "badges") {
      const line = visualPreviewElement("div", "firefly-visual-preview__text");
      for (const segment of model.segments || []) {
        if (segment.kind === "badge") {
          const known = new Set(["tip", "warning", "danger", "info", "success", "note", "important", "caution"]);
          const type = known.has(segment.type) ? segment.type : "default";
          line.append(visualPreviewElement("span", "firefly-visual-preview__badge firefly-visual-preview__badge--" + type, segment.text));
        } else if (segment.text) {
          line.append(document.createTextNode(segment.text + " "));
        }
      }
      preview.append(line);
    } else if (model.kind === "steps" || model.kind === "timeline") {
      heading(model.title);
      appendItems(model.items, model.kind);
    } else if (model.kind === "tabs") {
      heading(model.title);
      if (model.items?.length) {
        for (const item of model.items) {
          const panel = visualPreviewElement("div", "firefly-visual-preview__panel");
          const panelHead = visualPreviewElement("div", "firefly-visual-preview__panel-head");
          panelHead.append(visualPreviewElement("span", "", item.title));
          if (item.language) panelHead.append(visualPreviewElement("span", "firefly-visual-preview__muted", item.language));
          panel.append(panelHead, visualPreviewElement("pre", "", item.text));
          preview.append(panel);
        }
      } else {
        paragraph("标签页组件已识别，内容为空。");
      }
    } else if (model.kind === "math") {
      heading(model.title);
      preview.append(visualPreviewElement("div", "firefly-visual-preview__math", model.text || "公式为空"));
      paragraph("公式源码已保留；可通过“编辑语法”修改。", "firefly-visual-preview__muted");
    } else if (model.kind === "task-list") {
      heading(model.title);
      for (const item of model.items || []) {
        const row = visualPreviewElement("label", "firefly-visual-preview__todo");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.disabled = true;
        checkbox.checked = Boolean(item.checked);
        row.append(checkbox, visualPreviewElement("span", "", item.text));
        preview.append(row);
      }
    } else if (model.kind === "footnotes" || model.kind === "wiki") {
      heading(model.title);
      for (const item of model.items || []) {
        const row = visualPreviewElement("div", "firefly-visual-preview__link");
        row.append(visualPreviewElement("span", "", item.title));
        if (item.text && item.text !== item.title) row.append(visualPreviewElement("span", "firefly-visual-preview__muted", item.text));
        preview.append(row);
      }
    } else if (model.kind === "details") {
      const card = visualPreviewElement("div", "firefly-visual-preview__panel");
      card.append(visualPreviewElement("div", "firefly-visual-preview__panel-head", "▸ " + model.title));
      if (model.text) card.append(visualPreviewElement("div", "firefly-visual-preview__text", model.text));
      preview.append(card);
    } else if (model.kind === "embed") {
      const card = visualPreviewElement("div", "firefly-visual-preview__embed");
      card.append(visualPreviewElement("div", "firefly-visual-preview__icon", "↗"));
      const main = visualPreviewElement("div", "");
      main.append(visualPreviewElement("div", "firefly-visual-preview__item-title", model.title));
      main.append(visualPreviewElement("div", "firefly-visual-preview__text", model.host || "外部内容"));
      main.append(visualPreviewElement("div", "firefly-visual-preview__muted", model.text || "未执行嵌入代码"));
      card.append(main);
      preview.append(card);
    } else if (model.kind === "component") {
      const card = visualPreviewElement("div", "firefly-visual-preview__panel");
      card.append(visualPreviewElement("div", "firefly-visual-preview__panel-head", model.title || "MDX 组件"));
      if (model.text) card.append(visualPreviewElement("div", "firefly-visual-preview__text", model.text));
      propertyList(model.attributes, card);
      preview.append(card);
    } else if (model.kind === "html") {
      heading(model.title);
      paragraph(model.text || "HTML / 主题组件语法已安全保留。");
    } else {
      heading(model.title || "扩展语法");
      paragraph(model.text || "这种语法已安全保留，预览区隐藏了源码。点击“编辑语法”可修改原始内容。");
      if (model.text) paragraph("保存时仍保留原始语法，不会把此预览摘要写回文章。", "firefly-visual-preview__muted");
    }
    return preview;
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
            const raw = typeof currentNode.attrs.raw === "string" ? currentNode.attrs.raw : "";
            const preview = createProtectedVisualPreview(raw, currentNode.attrs.reason || "扩展 Markdown");
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
    const migrated = stripGlobalComponentImports(split.body);
    const sourceBody = migrated.removed ? migrated.source : split.body;
    if (migrated.removed) {
      sourceField.value = split.prefix + sourceBody;
      sourceField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const prepared = prepareMarkdownForVisualEditing(sourceBody);
    frontmatterPrefix = split.prefix;
    loadingSource = true;
    try {
      editor.commands.setContent(prepared.markdown, { contentType: "markdown", emitUpdate: false });
      replaceProtectedMarkerParagraphs(editor, prepared.records);
      lastLoadedSource = sourceField.value || current;
      reportProtected(prepared.records);
      if (migrated.removed) {
        status("已从本次编辑稿移除 " + migrated.removed + " 条冗余 firefly-mdx import；保存文章后即可将清理结果写入 GitHub。");
        if (notice) {
          notice.hidden = false;
          notice.textContent = (notice.textContent ? notice.textContent + " " : "")
            + "已自动移除 " + migrated.removed + " 条冗余的 firefly-mdx 组件 import；保存后写入 GitHub。";
          notice.setAttribute("role", "status");
        }
      }
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
      case "callout": {
        editor.chain().focus().insertContent({
          type: "fireflyCallout",
          attrs: { type: "tip", title: "" },
          content: [{ type: "paragraph" }],
        }).run();
        break;
      }
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
    ensureCalloutStyles();
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
        createCalloutBlock(),
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
