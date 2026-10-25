import { prepareMarkdownForVisualEditing, restoreProtectedMarkdownStrict } from "/admin-markdown-guard.js?v=20261021-strict-integrity";
import { inspectProtectedMarkdown, serializeEditableStepTimeline, serializeEditableTabGroup, serializeEditableCallout, serializeEditableTaskList, serializeEditableDetails } from "/admin-visual-preview.js?v=20261018-details-editor";
import { filterSlashItems, SLASH_ITEMS, validateImageSource } from "/admin-editor-commands.js?v=20261026-visual";

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
  let requiredProtectedMarkers = [];
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
      image: $("image")?.value || "",
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
      image: snapshot.image || "",
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

  const BADGE_TYPES = ["default", "tip", "note", "important", "warning", "caution"];
  const BADGE_TITLES = {
    default: "主题色",
    tip: "提示",
    note: "笔记",
    important: "重要",
    warning: "注意",
    caution: "谨慎",
  };

  function normalizeBadgeType(value) {
    const type = String(value || "default").toLowerCase();
    return BADGE_TYPES.includes(type) ? type : "default";
  }

  function isSafeBadgeLabel(value) {
    const label = String(value ?? "");
    return Boolean(label.trim()) && !/[<>{}\r\n\x60*_~\[\]$]/.test(label);
  }

  function ensureBadgeStyles() {
    if (document.getElementById("firefly-badge-editor-styles")) return;
    const style = document.createElement("style");
    style.id = "firefly-badge-editor-styles";
    style.textContent = [
      ".firefly-mdx-badge{display:inline-flex;align-items:center;gap:5px;vertical-align:middle;margin:1px 3px;padding:3px 8px;border:1px solid #cce6d4;border-radius:999px;background:#eaf7ee;color:#177443;font:650 12px/1.4 system-ui,sans-serif;white-space:nowrap;max-width:100%;}",
      ".firefly-mdx-badge--tip{background:#e6f6f5;color:#0e7490;border-color:#bfe8e4}.firefly-mdx-badge--note{background:#f0f3f5;color:#5b6570;border-color:#dce2e7}.firefly-mdx-badge--important{background:#f1eaff;color:#7041ac;border-color:#ded0f7}.firefly-mdx-badge--warning{background:#fff4dc;color:#925c05;border-color:#f1d8a0}.firefly-mdx-badge--caution{background:#ffeded;color:#a83232;border-color:#f2c4c4}",
      ".firefly-mdx-badge__label{display:inline-block;min-width:4px;overflow-wrap:anywhere;white-space:normal;}",
      ".firefly-mdx-badge__controls{display:inline-flex;align-items:center;gap:2px;opacity:.28;transition:opacity .15s;}",
      ".firefly-mdx-badge:hover .firefly-mdx-badge__controls,.firefly-mdx-badge:focus-within .firefly-mdx-badge__controls{opacity:1;}",
      ".firefly-mdx-badge__select{max-width:75px;border:1px solid #bdd9c4;border-radius:6px;padding:1px 3px;background:#fff;color:#33533d;font:11px system-ui,sans-serif;cursor:pointer;}",
      ".firefly-mdx-badge__edit{border:1px solid #bdd9c4;border-radius:5px;padding:1px 4px;background:#fff;color:#33533d;font:11px system-ui,sans-serif;cursor:pointer;}",
      ".firefly-mdx-badge.ProseMirror-selectednode{outline:2px solid #58a875;outline-offset:2px;}",
      "@media(prefers-color-scheme:dark){.firefly-mdx-badge{background:#203b2b;color:#aee7bc;border-color:#3d6a49}.firefly-mdx-badge--tip{background:#18383a;color:#8de0db;border-color:#286469}.firefly-mdx-badge--note{background:#2b3036;color:#d2d8df;border-color:#4b5662}.firefly-mdx-badge--important{background:#302542;color:#d9c0ff;border-color:#59457b}.firefly-mdx-badge--warning{background:#3b301c;color:#f5d18e;border-color:#69522b}.firefly-mdx-badge--caution{background:#3e2525;color:#ffb0b0;border-color:#783f3f}.firefly-mdx-badge__select,.firefly-mdx-badge__edit{background:#202820;color:#e5ebe5;border-color:#506a55}}",
    ].join("\n");
    document.head.append(style);
  }

  function createMdxBadgeInline() {
    return NodeExtension.create({
      name: "fireflyBadge",
      group: "inline",
      inline: true,
      atom: true,
      selectable: true,
      addAttributes() {
        return {
          type: { default: "default" },
          label: { default: "" },
        };
      },
      parseHTML() {
        return [{ tag: "span[data-firefly-badge]" }];
      },
      renderHTML({ node }) {
        const type = normalizeBadgeType(node.attrs.type);
        return ["span", {
          "data-firefly-badge": "true",
          "data-type": type,
          class: "firefly-mdx-badge firefly-mdx-badge--" + type,
        }, String(node.attrs.label || "")];
      },
      markdownTokenizer: {
        name: "fireflyBadge",
        level: "inline",
        start: source => source.indexOf("<Badge"),
        tokenize(source) {
          const match = /^<Badge\b([^>]*)>([^<>{}\r\n]*)<\/Badge\s*>/.exec(source);
          if (!match) return undefined;
          const attrSource = match[1].trim();
          let type = "default";
          if (attrSource) {
            const typed = /^type\s*=\s*(?:"(default|tip|note|important|warning|caution)"|'(default|tip|note|important|warning|caution)')$/.exec(attrSource);
            if (!typed) return undefined;
            type = typed[1] || typed[2] || "default";
          }
          const label = match[2];
          if (!isSafeBadgeLabel(label)) return undefined;
          return {
            type: "fireflyBadge",
            raw: match[0],
            badgeType: type,
            badgeLabel: label,
          };
        },
      },
      parseMarkdown(token) {
        return {
          type: "fireflyBadge",
          attrs: {
            type: normalizeBadgeType(token.badgeType),
            label: String(token.badgeLabel || ""),
          },
        };
      },
      renderMarkdown(node) {
        const type = normalizeBadgeType(node.attrs?.type);
        const label = String(node.attrs?.label || "");
        return type === "default"
          ? "<Badge>" + label + "</Badge>"
          : '<Badge type="' + type + '">' + label + "</Badge>";
      },
      addNodeView() {
        return ({ node, editor: activeEditor, getPos }) => {
          const root = document.createElement("span");
          root.contentEditable = "false";
          root.setAttribute("data-firefly-badge", "true");
          let currentNode = node;

          const updateAttributes = patch => {
            const position = getPos();
            if (typeof position !== "number") return;
            const current = activeEditor.state.doc.nodeAt(position);
            if (!current || current.type.name !== "fireflyBadge") return;
            activeEditor.view.dispatch(activeEditor.state.tr.setNodeMarkup(position, undefined, {
              ...current.attrs,
              ...patch,
            }));
          };

          const render = () => {
            const type = normalizeBadgeType(currentNode.attrs.type);
            root.className = "firefly-mdx-badge firefly-mdx-badge--" + type;
            root.replaceChildren();
            const label = document.createElement("span");
            label.className = "firefly-mdx-badge__label";
            label.textContent = String(currentNode.attrs.label || "");
            label.title = "双击徽章文字可编辑";
            label.addEventListener("dblclick", event => {
              event.preventDefault();
              event.stopPropagation();
              const next = window.prompt("徽章文字", String(currentNode.attrs.label || ""));
              if (next === null) return;
              if (!isSafeBadgeLabel(next)) {
                status("徽章文字不能为空，也不能包含换行、MDX 标签或 Markdown 强调符号。", true);
                return;
              }
              updateAttributes({ label: next });
            });

            const controls = document.createElement("span");
            controls.className = "firefly-mdx-badge__controls";
            const select = document.createElement("select");
            select.className = "firefly-mdx-badge__select";
            select.setAttribute("aria-label", "徽章类型");
            select.title = "修改徽章类型";
            for (const item of BADGE_TYPES) {
              const option = document.createElement("option");
              option.value = item;
              option.textContent = BADGE_TITLES[item];
              select.append(option);
            }
            select.value = type;
            select.addEventListener("mousedown", event => event.stopPropagation());
            select.addEventListener("change", () => updateAttributes({ type: normalizeBadgeType(select.value) }));

            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "firefly-mdx-badge__edit";
            edit.textContent = "编辑";
            edit.title = "编辑徽章文字";
            edit.addEventListener("mousedown", event => event.preventDefault());
            edit.addEventListener("click", event => {
              event.preventDefault();
              event.stopPropagation();
              const next = window.prompt("徽章文字", String(currentNode.attrs.label || ""));
              if (next === null) return;
              if (!isSafeBadgeLabel(next)) {
                status("徽章文字不能为空，也不能包含换行、MDX 标签或 Markdown 强调符号。", true);
                return;
              }
              updateAttributes({ label: next });
            });
            controls.append(select, edit);
            root.append(label, controls);
          };

          render();
          return {
            dom: root,
            update(nextNode) {
              if (nextNode.type.name !== "fireflyBadge") return false;
              currentNode = nextNode;
              render();
              return true;
            },
            stopEvent(event) {
              return Boolean(event.target instanceof Element && event.target.closest("button,select"));
            },
            ignoreMutation() {
              return true;
            },
          };
        };
      },
    });
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

  function openStructuredStepTimelineEditor(activeEditor, getPos, node, model) {
    const dialog = document.createElement("dialog");
    dialog.className = "firefly-structured-editor";
    dialog.setAttribute("aria-labelledby", "firefly-structured-editor-title");
    const style = document.createElement("style");
    style.textContent = [
      ".firefly-structured-editor{width:min(860px,calc(100vw - 24px));max-width:none;max-height:88vh;overflow:auto;border:1px solid #d7e4d9;border-radius:16px;padding:0;background:#fbfdfb;color:#243329;box-shadow:0 20px 70px #102e1b33}",
      ".firefly-structured-editor::backdrop{background:#16231c88;backdrop-filter:blur(3px)}",
      ".firefly-structured-editor__inner{padding:clamp(14px,3vw,24px);display:grid;gap:14px}",
      ".firefly-structured-editor__title{margin:0;font-size:19px;line-height:1.4}",
      ".firefly-structured-editor__hint{margin:0;color:#67766a;font-size:12px;line-height:1.6}",
      ".firefly-structured-editor__list{display:grid;gap:12px}",
      ".firefly-structured-editor__item{border:1px solid #dce7dd;border-radius:12px;background:#fff;padding:12px;display:grid;gap:10px;min-width:0}",
      ".firefly-structured-editor__item-head{display:flex;justify-content:space-between;align-items:center;gap:8px}",
      ".firefly-structured-editor__item-number{font-size:12px;font-weight:750;color:#27804c}",
      ".firefly-structured-editor__fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
      ".firefly-structured-editor__field{display:grid;gap:5px;min-width:0}",
      ".firefly-structured-editor__field--wide{grid-column:1/-1}",
      ".firefly-structured-editor__field label{font-size:12px;font-weight:700;color:#536457}",
      ".firefly-structured-editor__field input,.firefly-structured-editor__field textarea,.firefly-structured-editor__field select{width:100%;min-width:0;border:1px solid #ceddce;border-radius:8px;background:#fff;color:#243329;padding:9px 10px;font:inherit;font-size:13px}",
      ".firefly-structured-editor__field textarea{min-height:70px;resize:vertical}",
      ".firefly-structured-editor__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fbfdfb;padding-top:8px}",
      ".firefly-structured-editor__button{border:1px solid #cbd9ce;border-radius:8px;background:#fff;color:#314536;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}",
      ".firefly-structured-editor__button--primary{background:#177746;color:#fff;border-color:#177746;font-weight:750}",
      ".firefly-structured-editor__button--danger{color:#b42323;border-color:#e5c7c7}",
      ".firefly-structured-editor__button:disabled{opacity:.5;cursor:not-allowed}",
      "@media(max-width:520px){.firefly-structured-editor__fields{grid-template-columns:1fr}.firefly-structured-editor__field--wide{grid-column:auto}.firefly-structured-editor__actions{justify-content:stretch}.firefly-structured-editor__actions button{flex:1}}",
      "@media(prefers-color-scheme:dark){.firefly-structured-editor{background:#1a231b;color:#e6eee7;border-color:#3f5844}.firefly-structured-editor__hint,.firefly-structured-editor__field label{color:#b8c9bb}.firefly-structured-editor__item{background:#222d23;border-color:#405645}.firefly-structured-editor__field input,.firefly-structured-editor__field textarea,.firefly-structured-editor__field select,.firefly-structured-editor__button{background:#202820;color:#e4ece5;border-color:#4c6551}.firefly-structured-editor__actions{background:#1a231b}.firefly-structured-editor__button--primary{background:#26794a;border-color:#26794a;color:#fff}}",
    ].join("\n");
    document.head.append(style);

    const inner = document.createElement("div");
    inner.className = "firefly-structured-editor__inner";
    const heading = document.createElement("h2");
    heading.id = "firefly-structured-editor-title";
    heading.className = "firefly-structured-editor__title";
    heading.textContent = model.kind === "timeline" ? "可视化编辑时间线" : "可视化编辑步骤";
    const hint = document.createElement("p");
    hint.className = "firefly-structured-editor__hint";
    hint.textContent = "仅编辑安全的纯文字项目。代码、嵌套组件和 Markdown 格式仍使用原始语法编辑；这里不会执行或渲染文章源码。";
    const list = document.createElement("div");
    list.className = "firefly-structured-editor__list";
    const error = document.createElement("p");
    error.className = "firefly-structured-editor__hint";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "firefly-structured-editor__actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "firefly-structured-editor__button";
    add.textContent = "＋ 添加项目";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "firefly-structured-editor__button";
    cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "firefly-structured-editor__button firefly-structured-editor__button--primary";
    save.textContent = "保存组件";
    actions.append(add, cancel, save);
    inner.append(heading, hint, list, error, actions);
    dialog.append(inner);
    document.body.append(dialog);

    let rowRefs = [];
    let closed = false;
    const startingItems = (model.items || []).map(item => ({
      title: item.title || "",
      date: item.date || "",
      type: item.type || "default",
      icon: item.icon || "",
      text: item.rawText || item.text || "",
    }));

    const makeButton = (label, extraClass = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "firefly-structured-editor__button" + (extraClass ? " " + extraClass : "");
      button.textContent = label;
      return button;
    };

    const makeField = (labelText, value, key, options = {}) => {
      const wrap = document.createElement("div");
      wrap.className = "firefly-structured-editor__field" + (options.wide ? " firefly-structured-editor__field--wide" : "");
      const label = document.createElement("label");
      label.textContent = labelText;
      const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
      if (!options.multiline && options.type) input.type = options.type;
      input.value = String(value || "");
      input.maxLength = options.maxLength || 500;
      if (options.placeholder) input.placeholder = options.placeholder;
      label.htmlFor = "firefly-component-" + key + "-" + rowRefs.length;
      input.id = label.htmlFor;
      if (options.multiline) input.rows = 3;
      wrap.append(label, input);
      return { wrap, input };
    };

    const getValues = () => rowRefs.map(row => ({
      title: row.title.input.value.trim(),
      date: row.date?.input.value.trim() || "",
      type: row.type.value,
      icon: row.icon.value,
      text: row.text.input.value.trim(),
    }));

    const renderRows = items => {
      list.replaceChildren();
      rowRefs = [];
      items.forEach((item, index) => {
        const card = document.createElement("section");
        card.className = "firefly-structured-editor__item";
        const cardHead = document.createElement("div");
        cardHead.className = "firefly-structured-editor__item-head";
        const number = document.createElement("span");
        number.className = "firefly-structured-editor__item-number";
        number.textContent = (model.kind === "timeline" ? "时间线节点 " : "步骤 ") + (index + 1);
        const remove = makeButton("删除", "firefly-structured-editor__button--danger");
        remove.addEventListener("click", () => {
          const values = getValues();
          values.splice(index, 1);
          renderRows(values);
        });
        cardHead.append(number, remove);

        const fields = document.createElement("div");
        fields.className = "firefly-structured-editor__fields";
        const titleField = makeField("标题", item.title, "title", { maxLength: 120, placeholder: model.kind === "timeline" ? "事件标题" : "步骤标题" });
        fields.append(titleField.wrap);

        let dateField = null;
        if (model.kind === "timeline") {
          dateField = makeField("日期 / 时间标签", item.date, "date", { maxLength: 80, placeholder: "例如 2026-10-18" });
          fields.append(dateField.wrap);
        }

        const typeWrap = document.createElement("div");
        typeWrap.className = "firefly-structured-editor__field";
        const typeLabel = document.createElement("label");
        typeLabel.textContent = "颜色类型";
        const typeSelect = document.createElement("select");
        typeSelect.setAttribute("aria-label", "颜色类型");
        for (const value of ["default", "tip", "note", "important", "warning", "caution"]) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = ({ default: "主题色", tip: "提示", note: "笔记", important: "重要", warning: "注意", caution: "谨慎" })[value];
          typeSelect.append(option);
        }
        typeSelect.value = item.type || "default";
        typeLabel.htmlFor = "firefly-component-type-" + index;
        typeSelect.id = typeLabel.htmlFor;
        typeWrap.append(typeLabel, typeSelect);
        fields.append(typeWrap);

        const iconWrap = document.createElement("div");
        iconWrap.className = "firefly-structured-editor__field";
        const iconLabel = document.createElement("label");
        iconLabel.textContent = "图标";
        const iconSelect = document.createElement("select");
        iconSelect.setAttribute("aria-label", "图标");
        for (const value of ["", "star", "rocket", "git", "flag", "book", "heart", "zap", "bug", "tag", "calendar", "code", "edit"]) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value || "无图标";
          iconSelect.append(option);
        }
        iconSelect.value = item.icon || "";
        iconLabel.htmlFor = "firefly-component-icon-" + index;
        iconSelect.id = iconLabel.htmlFor;
        iconWrap.append(iconLabel, iconSelect);
        fields.append(iconWrap);

        const textField = makeField("正文（纯文字）", item.text, "text", { wide: true, multiline: true, maxLength: 500, placeholder: "写一段简单说明，不包含 Markdown 格式符号。" });
        fields.append(textField.wrap);

        rowRefs.push({ title: titleField, date: dateField, type: typeSelect, icon: iconSelect, text: textField });
        card.append(cardHead, fields);
        list.append(card);
      });
      add.disabled = items.length >= 30;
    };

    const close = () => {
      if (closed) return;
      closed = true;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      dialog.remove();
      if (!document.querySelector(".firefly-structured-editor")) style.remove();
    };
    const showError = message => {
      error.textContent = message;
      error.hidden = false;
    };
    add.addEventListener("click", () => {
      const values = getValues();
      if (values.length >= 30) return;
      values.push({
        title: model.kind === "timeline" ? "新事件" : "新步骤",
        date: "",
        type: "default",
        icon: "",
        text: "填写说明。",
      });
      renderRows(values);
    });
    cancel.addEventListener("click", close);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });
    save.addEventListener("click", () => {
      error.hidden = true;
      const values = getValues();
      let raw;
      try {
        raw = serializeEditableStepTimeline(model, values);
      } catch (exception) {
        showError(exception instanceof Error ? exception.message : "内容不符合安全的纯文字格式。");
        return;
      }
      const position = getPos();
      if (typeof position !== "number") {
        showError("组件已不在文档中，请关闭后重新选择。");
        return;
      }
      const current = activeEditor.state.doc.nodeAt(position);
      if (!current || current.type.name !== "protectedMarkdownBlock") {
        showError("无法定位原始组件，已取消修改。");
        return;
      }
      activeEditor.view.dispatch(activeEditor.state.tr.setNodeMarkup(position, undefined, {
        ...current.attrs,
        raw,
      }));
      status("组件内容已更新；点击“保存文章”后写入 GitHub。");
      close();
    });

    renderRows(startingItems);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const firstInput = dialog.querySelector("input");
    firstInput?.focus();
  }


  function openStructuredTabGroupEditor(activeEditor, getPos, node, model) {
    const dialog = document.createElement("dialog");
    dialog.className = "firefly-structured-editor";
    dialog.setAttribute("aria-labelledby", "firefly-tabgroup-editor-title");
    const style = document.createElement("style");
    style.textContent = [
      ".firefly-structured-editor{width:min(920px,calc(100vw - 24px));max-width:none;max-height:90vh;overflow:auto;border:1px solid #d7e4d9;border-radius:16px;padding:0;background:#fbfdfb;color:#243329;box-shadow:0 20px 70px #102e1b33}",
      ".firefly-structured-editor::backdrop{background:#16231c88;backdrop-filter:blur(3px)}",
      ".firefly-structured-editor__inner{padding:clamp(14px,3vw,24px);display:grid;gap:14px}",
      ".firefly-structured-editor__title{margin:0;font-size:19px;line-height:1.4}",
      ".firefly-structured-editor__hint{margin:0;color:#67766a;font-size:12px;line-height:1.6}",
      ".firefly-structured-editor__list{display:grid;gap:12px}",
      ".firefly-structured-editor__item{border:1px solid #dce7dd;border-radius:12px;background:#fff;padding:12px;display:grid;gap:10px;min-width:0}",
      ".firefly-structured-editor__item-head{display:flex;justify-content:space-between;align-items:center;gap:8px}",
      ".firefly-structured-editor__item-number{font-size:12px;font-weight:750;color:#27804c}",
      ".firefly-structured-editor__fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}",
      ".firefly-structured-editor__field{display:grid;gap:5px;min-width:0}",
      ".firefly-structured-editor__field--wide{grid-column:1/-1}",
      ".firefly-structured-editor__field label{font-size:12px;font-weight:700;color:#536457}",
      ".firefly-structured-editor__field input,.firefly-structured-editor__field textarea{width:100%;min-width:0;box-sizing:border-box;border:1px solid #ceddce;border-radius:8px;background:#fff;color:#243329;padding:9px 10px;font:inherit;font-size:13px}",
      ".firefly-structured-editor__field textarea{min-height:70px;resize:vertical}",
      ".firefly-structured-editor__field textarea.firefly-tabgroup-code{min-height:150px;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2;white-space:pre;overflow:auto}",
      ".firefly-structured-editor__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fbfdfb;padding-top:8px}",
      ".firefly-structured-editor__button{border:1px solid #cbd9ce;border-radius:8px;background:#fff;color:#314536;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}",
      ".firefly-structured-editor__button--primary{background:#177746;color:#fff;border-color:#177746;font-weight:750}",
      ".firefly-structured-editor__button--danger{color:#b42323;border-color:#e5c7c7}",
      "@media(max-width:520px){.firefly-structured-editor__fields{grid-template-columns:1fr}.firefly-structured-editor__field--wide{grid-column:auto}.firefly-structured-editor__actions{justify-content:stretch}.firefly-structured-editor__actions button{flex:1}}",
      "@media(prefers-color-scheme:dark){.firefly-structured-editor{background:#1a231b;color:#e6eee7;border-color:#3f5844}.firefly-structured-editor__hint,.firefly-structured-editor__field label{color:#b8c9bb}.firefly-structured-editor__item{background:#222d23;border-color:#405645}.firefly-structured-editor__field input,.firefly-structured-editor__field textarea,.firefly-structured-editor__button{background:#202820;color:#e4ece5;border-color:#4c6551}.firefly-structured-editor__actions{background:#1a231b}.firefly-structured-editor__button--primary{background:#26794a;border-color:#26794a;color:#fff}}",
    ].join("\n");
    document.head.append(style);

    const inner = document.createElement("div");
    inner.className = "firefly-structured-editor__inner";
    const heading = document.createElement("h2");
    heading.id = "firefly-tabgroup-editor-title";
    heading.className = "firefly-structured-editor__title";
    heading.textContent = "可视化编辑标签页";
    const hint = document.createElement("p");
    hint.className = "firefly-structured-editor__hint";
    hint.textContent = "可修改标签名称、代码语言和代码内容。代码框中的 Markdown/MDX/HTML 只作为代码文本保留，不会执行；保存时会自动选择不与代码冲突的围栏符号。";
    const list = document.createElement("div");
    list.className = "firefly-structured-editor__list";
    const error = document.createElement("p");
    error.className = "firefly-structured-editor__hint";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "firefly-structured-editor__actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "firefly-structured-editor__button";
    add.textContent = "＋ 添加标签页";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "firefly-structured-editor__button";
    cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "firefly-structured-editor__button firefly-structured-editor__button--primary";
    save.textContent = "保存标签页";
    actions.append(add, cancel, save);
    inner.append(heading, hint, list, error, actions);
    dialog.append(inner);
    document.body.append(dialog);

    let rowRefs = [];
    let closed = false;
    const startingItems = (model.items || []).map(item => ({
      title: item.title || "",
      language: item.language || "",
      text: item.text || "",
    }));
    const makeButton = (label, extraClass = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "firefly-structured-editor__button" + (extraClass ? " " + extraClass : "");
      button.textContent = label;
      return button;
    };
    const makeField = (labelText, value, key, options = {}) => {
      const wrap = document.createElement("div");
      wrap.className = "firefly-structured-editor__field" + (options.wide ? " firefly-structured-editor__field--wide" : "");
      const label = document.createElement("label");
      label.textContent = labelText;
      const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
      input.value = String(value ?? "");
      input.maxLength = options.maxLength || 500;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.multiline) input.rows = options.rows || 8;
      label.htmlFor = "firefly-tab-" + key + "-" + rowRefs.length;
      input.id = label.htmlFor;
      if (options.className) input.className = options.className;
      wrap.append(label, input);
      return { wrap, input };
    };
    const getValues = () => rowRefs.map(row => ({
      title: row.title.input.value,
      language: row.language.input.value,
      text: row.text.input.value,
    }));
    const renderRows = items => {
      list.replaceChildren();
      rowRefs = [];
      items.forEach((item, index) => {
        const card = document.createElement("section");
        card.className = "firefly-structured-editor__item";
        const cardHead = document.createElement("div");
        cardHead.className = "firefly-structured-editor__item-head";
        const number = document.createElement("span");
        number.className = "firefly-structured-editor__item-number";
        number.textContent = "标签页 " + (index + 1);
        const remove = makeButton("删除标签页", "firefly-structured-editor__button--danger");
        remove.addEventListener("click", () => {
          const values = getValues();
          values.splice(index, 1);
          renderRows(values);
        });
        cardHead.append(number, remove);
        const fields = document.createElement("div");
        fields.className = "firefly-structured-editor__fields";
        const titleField = makeField("标签名称", item.title, "title", { maxLength: 80, placeholder: "例如 JavaScript 示例" });
        const languageField = makeField("代码语言", item.language, "language", { maxLength: 32, placeholder: "例如 js、python、bash" });
        const textField = makeField("代码内容（原样保留）", item.text, "code", { wide: true, multiline: true, maxLength: 50000, rows: 9, className: "firefly-tabgroup-code" });
        fields.append(titleField.wrap, languageField.wrap, textField.wrap);
        rowRefs.push({ title: titleField, language: languageField, text: textField });
        card.append(cardHead, fields);
        list.append(card);
      });
      add.disabled = items.length >= 20;
    };
    const close = () => {
      if (closed) return;
      closed = true;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      dialog.remove();
      if (!document.querySelector(".firefly-structured-editor")) style.remove();
    };
    const showError = message => {
      error.textContent = message;
      error.hidden = false;
    };
    add.addEventListener("click", () => {
      const values = getValues();
      if (values.length >= 20) return;
      values.push({ title: "新标签页", language: "text", text: "" });
      renderRows(values);
    });
    cancel.addEventListener("click", close);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });
    save.addEventListener("click", () => {
      error.hidden = true;
      let raw;
      try {
        raw = serializeEditableTabGroup(model, getValues());
      } catch (exception) {
        showError(exception instanceof Error ? exception.message : "标签页内容不符合可编辑格式。");
        return;
      }
      const position = getPos();
      if (typeof position !== "number") {
        showError("组件已不在文档中，请关闭后重新选择。");
        return;
      }
      const current = activeEditor.state.doc.nodeAt(position);
      if (!current || current.type.name !== "protectedMarkdownBlock") {
        showError("无法定位原始组件，已取消修改。");
        return;
      }
      activeEditor.view.dispatch(activeEditor.state.tr.setNodeMarkup(position, undefined, {
        ...current.attrs,
        raw,
      }));
      status("标签页组件已更新；点击“保存文章”后写入 GitHub。");
      close();
    });

    renderRows(startingItems);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    list.querySelector("input")?.focus();
  }


  function openStructuredCalloutEditor(activeEditor, getPos, node, model) {
    const dialog = document.createElement("dialog");
    dialog.className = "firefly-structured-editor";
    dialog.setAttribute("aria-labelledby", "firefly-callout-editor-title");
    const style = document.createElement("style");
    style.textContent = [
      ".firefly-structured-editor{width:min(720px,calc(100vw - 24px));max-width:none;max-height:88vh;overflow:auto;border:1px solid #d7e4d9;border-radius:16px;padding:0;background:#fbfdfb;color:#243329;box-shadow:0 20px 70px #102e1b33}",
      ".firefly-structured-editor::backdrop{background:#16231c88;backdrop-filter:blur(3px)}",
      ".firefly-structured-editor__inner{padding:clamp(14px,3vw,24px);display:grid;gap:14px}",
      ".firefly-structured-editor__title{margin:0;font-size:19px;line-height:1.4}",
      ".firefly-structured-editor__hint{margin:0;color:#67766a;font-size:12px;line-height:1.6}",
      ".firefly-structured-editor__field{display:grid;gap:6px;min-width:0}",
      ".firefly-structured-editor__field label{font-size:12px;font-weight:700;color:#536457}",
      ".firefly-structured-editor__field input,.firefly-structured-editor__field textarea,.firefly-structured-editor__field select{width:100%;min-width:0;box-sizing:border-box;border:1px solid #ceddce;border-radius:8px;background:#fff;color:#243329;padding:10px;font:inherit;font-size:13px}",
      ".firefly-structured-editor__field textarea{min-height:150px;resize:vertical;line-height:1.65}",
      ".firefly-structured-editor__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fbfdfb;padding-top:8px}",
      ".firefly-structured-editor__button{border:1px solid #cbd9ce;border-radius:8px;background:#fff;color:#314536;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}",
      ".firefly-structured-editor__button--primary{background:#177746;color:#fff;border-color:#177746;font-weight:750}",
      "@media(prefers-color-scheme:dark){.firefly-structured-editor{background:#1a231b;color:#e6eee7;border-color:#3f5844}.firefly-structured-editor__hint,.firefly-structured-editor__field label{color:#b8c9bb}.firefly-structured-editor__field input,.firefly-structured-editor__field textarea,.firefly-structured-editor__field select,.firefly-structured-editor__button{background:#202820;color:#e4ece5;border-color:#4c6551}.firefly-structured-editor__actions{background:#1a231b}.firefly-structured-editor__button--primary{background:#26794a;border-color:#26794a;color:#fff}}",
    ].join("\n");
    document.head.append(style);

    const inner = document.createElement("div");
    inner.className = "firefly-structured-editor__inner";
    const heading = document.createElement("h2");
    heading.id = "firefly-callout-editor-title";
    heading.className = "firefly-structured-editor__title";
    heading.textContent = "可视化编辑提示容器";
    const hint = document.createElement("p");
    hint.className = "firefly-structured-editor__hint";
    hint.textContent = "仅支持纯文本提示容器。正文若包含 Markdown 强调、列表、标题、HTML 或嵌套组件，请使用“编辑语法”，以免丢失格式。";
    const typeWrap = document.createElement("div");
    typeWrap.className = "firefly-structured-editor__field";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "提示类型";
    const typeSelect = document.createElement("select");
    typeSelect.setAttribute("aria-label", "提示类型");
    const typeTitles = {
      tip: "提示", warning: "注意", danger: "警告", info: "信息",
      success: "成功", note: "备注", important: "重要", caution: "谨慎",
    };
    for (const value of Object.keys(typeTitles)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = typeTitles[value];
      typeSelect.append(option);
    }
    typeSelect.value = model.type || "tip";
    typeLabel.htmlFor = "firefly-callout-type";
    typeSelect.id = typeLabel.htmlFor;
    typeWrap.append(typeLabel, typeSelect);
    const titleWrap = document.createElement("div");
    titleWrap.className = "firefly-structured-editor__field";
    const titleLabel = document.createElement("label");
    titleLabel.textContent = "标题（可留空）";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.maxLength = 120;
    titleInput.value = model.title || "";
    titleInput.id = "firefly-callout-title";
    titleLabel.htmlFor = titleInput.id;
    titleWrap.append(titleLabel, titleInput);
    const bodyWrap = document.createElement("div");
    bodyWrap.className = "firefly-structured-editor__field";
    const bodyLabel = document.createElement("label");
    bodyLabel.textContent = "正文";
    const bodyInput = document.createElement("textarea");
    bodyInput.maxLength = 5000;
    bodyInput.rows = 8;
    bodyInput.value = model.body || "";
    bodyInput.id = "firefly-callout-body";
    bodyLabel.htmlFor = bodyInput.id;
    bodyWrap.append(bodyLabel, bodyInput);
    const error = document.createElement("p");
    error.className = "firefly-structured-editor__hint";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "firefly-structured-editor__actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "firefly-structured-editor__button";
    cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "firefly-structured-editor__button firefly-structured-editor__button--primary";
    save.textContent = "保存提示容器";
    actions.append(cancel, save);
    inner.append(heading, hint, typeWrap, titleWrap, bodyWrap, error, actions);
    dialog.append(inner);
    document.body.append(dialog);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      dialog.remove();
      if (!document.querySelector(".firefly-structured-editor")) style.remove();
    };
    cancel.addEventListener("click", close);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });
    save.addEventListener("click", () => {
      error.hidden = true;
      let raw;
      try {
        raw = serializeEditableCallout(model, {
          type: typeSelect.value,
          title: titleInput.value,
          body: bodyInput.value,
        });
      } catch (exception) {
        error.textContent = exception instanceof Error ? exception.message : "提示容器内容不符合可编辑格式。";
        error.hidden = false;
        return;
      }
      const position = getPos();
      if (typeof position !== "number") {
        error.textContent = "组件已不在文档中，请关闭后重新选择。";
        error.hidden = false;
        return;
      }
      const current = activeEditor.state.doc.nodeAt(position);
      if (!current || current.type.name !== "protectedMarkdownBlock") {
        error.textContent = "无法定位原始组件，已取消修改。";
        error.hidden = false;
        return;
      }
      activeEditor.view.dispatch(activeEditor.state.tr.setNodeMarkup(position, undefined, {
        ...current.attrs,
        raw,
      }));
      status("提示容器已更新；点击“保存文章”后写入 GitHub。");
      close();
    });

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    typeSelect.focus();
  }


  function openStructuredTaskListEditor(activeEditor, getPos, node, model) {
    const dialog = document.createElement("dialog");
    dialog.className = "firefly-structured-editor";
    dialog.setAttribute("aria-labelledby", "firefly-tasklist-editor-title");
    const style = document.createElement("style");
    style.textContent = [
      ".firefly-structured-editor{width:min(760px,calc(100vw - 24px));max-width:none;max-height:88vh;overflow:auto;border:1px solid #d7e4d9;border-radius:16px;padding:0;background:#fbfdfb;color:#243329;box-shadow:0 20px 70px #102e1b33}",
      ".firefly-structured-editor::backdrop{background:#16231c88;backdrop-filter:blur(3px)}",
      ".firefly-structured-editor__inner{padding:clamp(14px,3vw,24px);display:grid;gap:14px}",
      ".firefly-structured-editor__title{margin:0;font-size:19px;line-height:1.4}",
      ".firefly-structured-editor__hint{margin:0;color:#67766a;font-size:12px;line-height:1.6}",
      ".firefly-structured-editor__list{display:grid;gap:8px}",
      ".firefly-structured-editor__task{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid #dce7dd;border-radius:10px;background:#fff;padding:8px;min-width:0}",
      ".firefly-structured-editor__task input[type=checkbox]{width:18px;height:18px;accent-color:#177746}",
      ".firefly-structured-editor__task input[type=text]{width:100%;min-width:0;box-sizing:border-box;border:1px solid #ceddce;border-radius:7px;background:#fff;color:#243329;padding:9px 10px;font:inherit;font-size:13px}",
      ".firefly-structured-editor__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fbfdfb;padding-top:8px}",
      ".firefly-structured-editor__button{border:1px solid #cbd9ce;border-radius:8px;background:#fff;color:#314536;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}",
      ".firefly-structured-editor__button--primary{background:#177746;color:#fff;border-color:#177746;font-weight:750}",
      ".firefly-structured-editor__button--danger{color:#b42323;border-color:#e5c7c7}",
      "@media(max-width:520px){.firefly-structured-editor__task{grid-template-columns:24px minmax(0,1fr)}.firefly-structured-editor__task .firefly-structured-editor__button{grid-column:2}.firefly-structured-editor__actions{justify-content:stretch}.firefly-structured-editor__actions button{flex:1}}",
      "@media(prefers-color-scheme:dark){.firefly-structured-editor{background:#1a231b;color:#e6eee7;border-color:#3f5844}.firefly-structured-editor__hint{color:#b8c9bb}.firefly-structured-editor__task{background:#222d23;border-color:#405645}.firefly-structured-editor__task input[type=text],.firefly-structured-editor__button{background:#202820;color:#e4ece5;border-color:#4c6551}.firefly-structured-editor__actions{background:#1a231b}.firefly-structured-editor__button--primary{background:#26794a;border-color:#26794a;color:#fff}}",
    ].join("\n");
    document.head.append(style);
    const inner = document.createElement("div");
    inner.className = "firefly-structured-editor__inner";
    const heading = document.createElement("h2");
    heading.id = "firefly-tasklist-editor-title";
    heading.className = "firefly-structured-editor__title";
    heading.textContent = "可视化编辑待办清单";
    const hint = document.createElement("p");
    hint.className = "firefly-structured-editor__hint";
    hint.textContent = "勾选状态和文字可以直接修改，也可添加或删除项目。仅支持纯文字条目；复杂 Markdown、嵌套列表和组件会继续保留源码。";
    const list = document.createElement("div");
    list.className = "firefly-structured-editor__list";
    const error = document.createElement("p");
    error.className = "firefly-structured-editor__hint";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "firefly-structured-editor__actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "firefly-structured-editor__button";
    add.textContent = "＋ 添加待办";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "firefly-structured-editor__button";
    cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "firefly-structured-editor__button firefly-structured-editor__button--primary";
    save.textContent = "保存清单";
    actions.append(add, cancel, save);
    inner.append(heading, hint, list, error, actions);
    dialog.append(inner);
    document.body.append(dialog);

    let rowRefs = [];
    let closed = false;
    const initial = (model.items || []).map(item => ({ checked: Boolean(item.checked), text: item.text || "" }));
    const getValues = () => rowRefs.map(row => ({
      checked: row.checkbox.checked,
      text: row.input.value,
    }));
    const renderRows = items => {
      list.replaceChildren();
      rowRefs = [];
      items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "firefly-structured-editor__task";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Boolean(item.checked);
        checkbox.setAttribute("aria-label", "待办项目 " + (index + 1) + " 是否完成");
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 500;
        input.value = String(item.text || "");
        input.setAttribute("aria-label", "待办项目 " + (index + 1) + " 内容");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "firefly-structured-editor__button firefly-structured-editor__button--danger";
        remove.textContent = "删除";
        remove.addEventListener("click", () => {
          const values = getValues();
          values.splice(index, 1);
          renderRows(values);
        });
        row.append(checkbox, input, remove);
        list.append(row);
        rowRefs.push({ checkbox, input });
      });
      add.disabled = items.length >= 100;
    };
    const close = () => {
      if (closed) return;
      closed = true;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      dialog.remove();
      if (!document.querySelector(".firefly-structured-editor")) style.remove();
    };
    const showError = message => {
      error.textContent = message;
      error.hidden = false;
    };
    add.addEventListener("click", () => {
      const values = getValues();
      if (values.length >= 100) return;
      values.push({ checked: false, text: "新待办项目" });
      renderRows(values);
      list.querySelector("input[type=text]:last-of-type")?.focus();
    });
    cancel.addEventListener("click", close);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });
    save.addEventListener("click", () => {
      error.hidden = true;
      let raw;
      try {
        raw = serializeEditableTaskList(getValues());
      } catch (exception) {
        showError(exception instanceof Error ? exception.message : "清单内容不符合可编辑格式。");
        return;
      }
      const position = getPos();
      if (typeof position !== "number") {
        showError("清单已不在文档中，请关闭后重新选择。");
        return;
      }
      const current = activeEditor.state.doc.nodeAt(position);
      if (!current || current.type.name !== "protectedMarkdownBlock") {
        showError("无法定位原始清单，已取消修改。");
        return;
      }
      activeEditor.view.dispatch(activeEditor.state.tr.setNodeMarkup(position, undefined, {
        ...current.attrs,
        raw,
      }));
      status("待办清单已更新；点击“保存文章”后写入 GitHub。");
      close();
    });

    renderRows(initial);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    list.querySelector("input[type=text]")?.focus();
  }


  function openStructuredDetailsEditor(activeEditor, getPos, node, model) {
    const dialog = document.createElement("dialog");
    dialog.className = "firefly-structured-editor";
    dialog.setAttribute("aria-labelledby", "firefly-details-editor-title");
    const style = document.createElement("style");
    style.textContent = [
      ".firefly-structured-editor{width:min(720px,calc(100vw - 24px));max-width:none;max-height:88vh;overflow:auto;border:1px solid #d7e4d9;border-radius:16px;padding:0;background:#fbfdfb;color:#243329;box-shadow:0 20px 70px #102e1b33}",
      ".firefly-structured-editor::backdrop{background:#16231c88;backdrop-filter:blur(3px)}",
      ".firefly-structured-editor__inner{padding:clamp(14px,3vw,24px);display:grid;gap:14px}",
      ".firefly-structured-editor__title{margin:0;font-size:19px;line-height:1.4}",
      ".firefly-structured-editor__hint{margin:0;color:#67766a;font-size:12px;line-height:1.6}",
      ".firefly-structured-editor__field{display:grid;gap:6px;min-width:0}",
      ".firefly-structured-editor__field label{font-size:12px;font-weight:700;color:#536457}",
      ".firefly-structured-editor__field input,.firefly-structured-editor__field textarea{width:100%;min-width:0;box-sizing:border-box;border:1px solid #ceddce;border-radius:8px;background:#fff;color:#243329;padding:10px;font:inherit;font-size:13px}",
      ".firefly-structured-editor__field textarea{min-height:160px;resize:vertical;line-height:1.65}",
      ".firefly-structured-editor__actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fbfdfb;padding-top:8px}",
      ".firefly-structured-editor__button{border:1px solid #cbd9ce;border-radius:8px;background:#fff;color:#314536;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer}",
      ".firefly-structured-editor__button--primary{background:#177746;color:#fff;border-color:#177746;font-weight:750}",
      "@media(prefers-color-scheme:dark){.firefly-structured-editor{background:#1a231b;color:#e6eee7;border-color:#3f5844}.firefly-structured-editor__hint,.firefly-structured-editor__field label{color:#b8c9bb}.firefly-structured-editor__field input,.firefly-structured-editor__field textarea,.firefly-structured-editor__button{background:#202820;color:#e4ece5;border-color:#4c6551}.firefly-structured-editor__actions{background:#1a231b}.firefly-structured-editor__button--primary{background:#26794a;border-color:#26794a;color:#fff}}",
    ].join("\n");
    document.head.append(style);
    const inner = document.createElement("div");
    inner.className = "firefly-structured-editor__inner";
    const heading = document.createElement("h2");
    heading.id = "firefly-details-editor-title";
    heading.className = "firefly-structured-editor__title";
    heading.textContent = "可视化编辑折叠区块";
    const hint = document.createElement("p");
    hint.className = "firefly-structured-editor__hint";
    hint.textContent = "修改折叠标题和纯文本正文。为防止丢格式，含 Markdown 强调、列表、空行分段、HTML 或嵌套组件的折叠区仍使用“编辑语法”。";
    const titleWrap = document.createElement("div");
    titleWrap.className = "firefly-structured-editor__field";
    const titleLabel = document.createElement("label");
    titleLabel.textContent = "折叠标题";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.maxLength = 120;
    titleInput.value = model.title || "";
    titleInput.id = "firefly-details-title";
    titleLabel.htmlFor = titleInput.id;
    titleWrap.append(titleLabel, titleInput);
    const bodyWrap = document.createElement("div");
    bodyWrap.className = "firefly-structured-editor__field";
    const bodyLabel = document.createElement("label");
    bodyLabel.textContent = "正文";
    const bodyInput = document.createElement("textarea");
    bodyInput.maxLength = 5000;
    bodyInput.rows = 8;
    bodyInput.value = model.body || "";
    bodyInput.id = "firefly-details-body";
    bodyLabel.htmlFor = bodyInput.id;
    bodyWrap.append(bodyLabel, bodyInput);
    const error = document.createElement("p");
    error.className = "firefly-structured-editor__hint";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "firefly-structured-editor__actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "firefly-structured-editor__button";
    cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "firefly-structured-editor__button firefly-structured-editor__button--primary";
    save.textContent = "保存折叠区";
    actions.append(cancel, save);
    inner.append(heading, hint, titleWrap, bodyWrap, error, actions);
    dialog.append(inner);
    document.body.append(dialog);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      dialog.remove();
      if (!document.querySelector(".firefly-structured-editor")) style.remove();
    };
    cancel.addEventListener("click", close);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });
    save.addEventListener("click", () => {
      error.hidden = true;
      let raw;
      try {
        raw = serializeEditableDetails({ title: titleInput.value, body: bodyInput.value });
      } catch (exception) {
        error.textContent = exception instanceof Error ? exception.message : "折叠区内容不符合可编辑格式。";
        error.hidden = false;
        return;
      }
      const position = getPos();
      if (typeof position !== "number") {
        error.textContent = "折叠区已不在文档中，请关闭后重新选择。";
        error.hidden = false;
        return;
      }
      const current = activeEditor.state.doc.nodeAt(position);
      if (!current || current.type.name !== "protectedMarkdownBlock") {
        error.textContent = "无法定位原始折叠区，已取消修改。";
        error.hidden = false;
        return;
      }
      activeEditor.view.dispatch(activeEditor.state.tr.setNodeMarkup(position, undefined, {
        ...current.attrs,
        raw,
      }));
      status("折叠区块已更新；点击“保存文章”后写入 GitHub。");
      close();
    });

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    titleInput.focus();
    titleInput.select();
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
      ".firefly-visual-preview__tabs{display:flex;gap:5px;overflow-x:auto;padding:3px 0 8px;scrollbar-width:thin}",
      ".firefly-visual-preview__tab{flex:0 0 auto;border:1px solid #dce7de;background:#f8fbf8;color:#54675a;border-radius:7px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer}",
      ".firefly-visual-preview__tab[aria-selected=true]{background:#e4f5e9;color:#126b3c;border-color:#9fd2ae;font-weight:750}",
      ".firefly-visual-preview__math{min-width:0;overflow-x:auto}",
      ".firefly-visual-preview__math--inline{display:inline-block;vertical-align:middle;padding:1px 5px;max-width:100%;text-align:left;background:#f7f8fa}",
      ".firefly-visual-preview__math .katex-display{margin:.2em 0}",
      ".firefly-visual-preview__math .katex{font-size:1.08em}",
      ".firefly-visual-preview__math{display:block;white-space:pre-wrap;overflow:auto;padding:12px;border-radius:8px;text-align:center;background:#f7f8fa;border:1px solid #e1e5ea;color:#344054;font:14px/1.8 ui-serif,Georgia,serif;overflow-wrap:anywhere}",
      ".firefly-visual-preview__todo{display:flex;align-items:flex-start;gap:8px;padding:3px 0;color:#3e4d42}",
      ".firefly-visual-preview__todo input{margin-top:5px;accent-color:#16834c}",
      ".firefly-visual-preview__link{display:inline-flex;align-items:center;gap:7px;border:1px solid #d7e6db;background:#f6fbf7;padding:6px 10px;border-radius:8px;color:#167346;font-weight:700;overflow-wrap:anywhere}",
      ".firefly-visual-preview__embed{display:flex;align-items:center;gap:10px;padding:12px;border:1px dashed #c9d8cc;border-radius:9px;background:#f7faf7}",
      ".firefly-visual-preview__icon{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:#e4f4e9;color:#176c3c;font-size:18px;font-weight:800;flex:0 0 auto}",
      ".firefly-visual-preview__empty{padding:10px;border:1px dashed #d7ded7;border-radius:8px;background:#fafcfa;color:#69776d}",
      "@media(prefers-color-scheme:dark){.firefly-visual-preview{color:#e5ebe5}.firefly-visual-preview__title,.firefly-visual-preview__item-title{color:#e7efe7}.firefly-visual-preview__text{color:#d0d8d0}.firefly-visual-preview__item,.firefly-visual-preview__panel{background:#202820;border-color:#3b493d}.firefly-visual-preview__panel-head{background:#273328;border-color:#3b493d}.firefly-visual-preview__panel pre,.firefly-visual-preview__math,.firefly-visual-preview__empty{background:#1a211b;color:#d7e2d8;border-color:#3b493d}.firefly-visual-preview__prop{background:#26352a;color:#c0dfc7;border-color:#3c5943}.firefly-visual-preview__tabs{background:#1a211b}.firefly-visual-preview__tab{background:#202820;color:#d0d8d0;border-color:#3b493d}.firefly-visual-preview__tab[aria-selected=true]{background:#21432d;color:#b3edc3;border-color:#3d7650}.firefly-visual-preview__prop{background:#26352a;color:#c0dfc7;border-color:#3c5943}.firefly-visual-preview__callout{background:#1d2b21;color:#dce8de;border-color:#3b6045}.firefly-visual-preview__callout--warning,.firefly-visual-preview__callout--caution{background:#2b2519;border-color:#66502d}.firefly-visual-preview__callout--danger{background:#2d1e1e;border-color:#6b3434}.firefly-visual-preview__callout--important{background:#292035;border-color:#59457b}.firefly-visual-preview__callout--info{background:#1c2635;border-color:#385783}.firefly-visual-preview__link{background:#203328;border-color:#3d6048;color:#a5e5b8}.firefly-visual-preview__embed{background:#202820;border-color:#465749}}",
    ].join("\n");
    document.head.append(style);
  }

  function renderKatexInto(target, tex, displayMode) {
    const source = String(tex || "");
    const render = () => {
      const katex = window.FireflyKatex;
      if (!katex || typeof katex.renderToString !== "function") {
        target.textContent = source;
        target.dataset.katexState = "fallback";
        return false;
      }
      try {
        // KaTeX generates the HTML; author-provided input is never inserted as HTML directly.
        target.innerHTML = katex.renderToString(source, {
          displayMode: Boolean(displayMode),
          throwOnError: false,
          trust: false,
          strict: "ignore",
          maxExpand: 500,
          maxSize: 20,
          output: "htmlAndMathml",
        });
        target.dataset.katexState = "rendered";
        return true;
      } catch {
        target.textContent = source;
        target.dataset.katexState = "fallback";
        return false;
      }
    };
    if (!render()) {
      window.addEventListener("firefly:katex-ready", render, { once: true });
    }
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
        const tablist = visualPreviewElement("div", "firefly-visual-preview__tabs");
        tablist.setAttribute("role", "tablist");
        tablist.setAttribute("aria-label", "文章标签页预览");
        const panels = [];
        preview.append(tablist);
        model.items.forEach((item, index) => {
          const button = visualPreviewElement("button", "firefly-visual-preview__tab", item.title);
          button.type = "button";
          button.setAttribute("role", "tab");
          button.setAttribute("aria-selected", String(index === 0));
          button.tabIndex = index === 0 ? 0 : -1;
          const panel = visualPreviewElement("div", "firefly-visual-preview__panel");
          panel.setAttribute("role", "tabpanel");
          panel.hidden = index !== 0;
          const panelHead = visualPreviewElement("div", "firefly-visual-preview__panel-head");
          panelHead.append(visualPreviewElement("span", "", item.title));
          if (item.language) panelHead.append(visualPreviewElement("span", "firefly-visual-preview__muted", item.language));
          panel.append(panelHead, visualPreviewElement("pre", "", item.text));
          button.addEventListener("click", () => {
            for (let panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
              const active = panelIndex === index;
              panels[panelIndex].button.setAttribute("aria-selected", String(active));
              panels[panelIndex].button.tabIndex = active ? 0 : -1;
              panels[panelIndex].panel.hidden = !active;
            }
          });
          button.addEventListener("keydown", event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const currentIndex = panels.findIndex(entry => entry.button === button);
            if (currentIndex < 0) return;
            const nextIndex = event.key === "Home" ? 0
              : event.key === "End" ? panels.length - 1
              : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + panels.length) % panels.length;
            panels[nextIndex].button.focus();
            panels[nextIndex].button.click();
          });
          panels.push({ button, panel });
          tablist.append(button);
          preview.append(panel);
        });
      } else {
        paragraph("标签页组件已识别，内容为空。");
      }
    } else if (model.kind === "math") {
      heading(model.title);
      const formula = visualPreviewElement("div", "firefly-visual-preview__math", model.text || "公式为空");
      formula.setAttribute("aria-label", "数学公式预览");
      renderKatexInto(formula, model.text || "", model.display);
      preview.append(formula);
      paragraph("公式源码保留在原文中；点击“编辑语法”可修改。", "firefly-visual-preview__muted");
    } else if (model.kind === "inline-math") {
      const line = visualPreviewElement("div", "firefly-visual-preview__text");
      line.style.lineHeight = "2.1";
      for (const segment of model.segments || []) {
        if (segment.kind === "math") {
          const formula = visualPreviewElement("span", "firefly-visual-preview__math firefly-visual-preview__math--inline", segment.text);
          formula.setAttribute("aria-label", "行内公式预览");
          renderKatexInto(formula, segment.text, false);
          line.append(formula);
        } else if (segment.text) {
          line.append(document.createTextNode(segment.text + " "));
        }
      }
      preview.append(line);
      paragraph("可视化展示保留了公式原文；如需修改，点击“编辑语法”。", "firefly-visual-preview__muted");
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
            const model = inspectProtectedMarkdown(raw, currentNode.attrs.reason || "扩展 Markdown");
            if ((model.kind === "steps" || model.kind === "timeline") && model.editable) {
              const visualEdit = document.createElement("button");
              visualEdit.type = "button";
              visualEdit.className = "firefly-protected-markdown__edit";
              visualEdit.textContent = "可视化编辑";
              visualEdit.title = "修改项目、标题、正文和类型";
              visualEdit.addEventListener("mousedown", event => event.preventDefault());
              visualEdit.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                openStructuredStepTimelineEditor(activeEditor, getPos, currentNode, model);
              });
              header.append(visualEdit);
            } else if (model.kind === "tabs" && model.editable) {
              const visualEdit = document.createElement("button");
              visualEdit.type = "button";
              visualEdit.className = "firefly-protected-markdown__edit";
              visualEdit.textContent = "可视化编辑标签页";
              visualEdit.title = "编辑标签名称、代码语言、代码内容，并可添加或删除标签页";
              visualEdit.addEventListener("mousedown", event => event.preventDefault());
              visualEdit.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                openStructuredTabGroupEditor(activeEditor, getPos, currentNode, model);
              });
              header.append(visualEdit);
            } else if (model.kind === "callout" && model.editable) {
              const visualEdit = document.createElement("button");
              visualEdit.type = "button";
              visualEdit.className = "firefly-protected-markdown__edit";
              visualEdit.textContent = "可视化编辑提示框";
              visualEdit.title = "修改提示类型、标题和纯文本正文";
              visualEdit.addEventListener("mousedown", event => event.preventDefault());
              visualEdit.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                openStructuredCalloutEditor(activeEditor, getPos, currentNode, model);
              });
              header.append(visualEdit);
            } else if (model.kind === "task-list" && model.editable) {
              const visualEdit = document.createElement("button");
              visualEdit.type = "button";
              visualEdit.className = "firefly-protected-markdown__edit";
              visualEdit.textContent = "可视化编辑清单";
              visualEdit.title = "修改勾选状态和文字，并添加或删除待办项目";
              visualEdit.addEventListener("mousedown", event => event.preventDefault());
              visualEdit.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                openStructuredTaskListEditor(activeEditor, getPos, currentNode, model);
              });
              header.append(visualEdit);
            } else if (model.kind === "details" && model.editable) {
              const visualEdit = document.createElement("button");
              visualEdit.type = "button";
              visualEdit.className = "firefly-protected-markdown__edit";
              visualEdit.textContent = "可视化编辑折叠区";
              visualEdit.title = "修改折叠标题和纯文本正文";
              visualEdit.addEventListener("mousedown", event => event.preventDefault());
              visualEdit.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();
                openStructuredDetailsEditor(activeEditor, getPos, currentNode, model);
              });
              header.append(visualEdit);
            }
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
    try {
      const restored = restoreProtectedMarkdownStrict(markdown, records, requiredProtectedMarkers);
      sourceField.value = frontmatterPrefix + restored + (restored && !restored.endsWith("\n") ? "\n" : "");
      sourceField.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (error) {
      // Keep the last proven-good source in the textarea. Do NOT synchronize
      // a partial serialization that dropped an opaque Markdown/MDX block.
      reportVisualLoadFailure(error);
      setMode("source");
    }
  }

  function loadSourceIntoEditor() {
    if (!editor) return false;
    const current = sourceField.value || "";
    const split = splitFrontmatter(current);
    // Opening a visual editor is a READ operation. Never silently delete
    // imports or normalize the original Markdown/MDX before any user edit.
    // Redundant imports may be removed only by an explicit, reversible action.
    const prepared = prepareMarkdownForVisualEditing(split.body);
    frontmatterPrefix = split.prefix;
    loadingSource = true;
    try {
      editor.commands.setContent(prepared.markdown, { contentType: "markdown", emitUpdate: false });
      replaceProtectedMarkerParagraphs(editor, prepared.records);
      const loadedNodes = [];
      editor.state.doc.descendants(node => {
        if (node.type.name === "protectedMarkdownBlock") {
          loadedNodes.push({ marker: node.attrs.marker, raw: node.attrs.raw });
        }
      });
      const expected = prepared.records.map(record => record.marker);
      restoreProtectedMarkdownStrict(editor.getMarkdown(), loadedNodes, expected);
      requiredProtectedMarkers = expected;
      lastLoadedSource = sourceField.value || current;
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

  function ensureImagePreviewTriggerStyles() {
    if (document.querySelector("style[data-firefly-image-preview-trigger]")) return;
    const style = document.createElement("style");
    style.dataset.fireflyImagePreviewTrigger = "true";
    style.textContent = [
      '.firefly-prosemirror-content img[data-firefly-image-preview="true"]{cursor:zoom-in;outline:2px solid transparent;outline-offset:3px;border-radius:4px;transition:outline-color .15s ease,box-shadow .15s ease}',
      '.firefly-prosemirror-content img[data-firefly-image-preview="true"]:hover{outline-color:#9bd6ae;box-shadow:0 0 0 4px #16834c14}',
      '.firefly-prosemirror-content img[data-firefly-image-preview="true"]:focus-visible{outline-color:#16834c;box-shadow:0 0 0 4px #16834c22}',
      '@media(prefers-color-scheme:dark){.firefly-prosemirror-content img[data-firefly-image-preview="true"]:hover{outline-color:#78c992}.firefly-prosemirror-content img[data-firefly-image-preview="true"]:focus-visible{outline-color:#8be0a5}}',
      '@media(prefers-reduced-motion:reduce){.firefly-prosemirror-content img[data-firefly-image-preview="true"]{transition:none}}',
    ].join("\n");
    document.head.append(style);
  }

  function openImagePreview(src, alt = "", title = "") {
    const imageSrc = typeof src === "string" ? src.trim() : "";
    if (!imageSrc) return;

    let dialog = document.getElementById("firefly-image-preview-dialog");
    if (!dialog) {
      const style = document.createElement("style");
      style.dataset.fireflyImagePreview = "true";
      style.textContent = [
        "#firefly-image-preview-dialog{width:min(1100px,calc(100vw - 24px));max-width:none;max-height:92vh;margin:auto;border:1px solid #d7e4d9;border-radius:16px;padding:0;background:#f9fcf9;color:#243329;box-shadow:0 24px 80px #102e1b55;overflow:hidden}",
        "#firefly-image-preview-dialog::backdrop{background:#14251bd9;backdrop-filter:blur(4px)}",
        "#firefly-image-preview-dialog .firefly-image-preview__layout{display:grid;grid-template-rows:auto minmax(0,1fr);max-height:92vh}",
        "#firefly-image-preview-dialog .firefly-image-preview__bar{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #e0e9e1;background:#fff}",
        "#firefly-image-preview-dialog .firefly-image-preview__caption{min-width:0;overflow-wrap:anywhere;font-size:13px;font-weight:650;color:#314536}",
        "#firefly-image-preview-dialog .firefly-image-preview__actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex-shrink:0}",
        "#firefly-image-preview-dialog .firefly-image-preview__button{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:6px 10px;border:1px solid #cbd9ce;border-radius:8px;background:#fff;color:#314536;text-decoration:none;font:inherit;font-size:12px;cursor:pointer}",
        "#firefly-image-preview-dialog .firefly-image-preview__button:focus-visible{outline:2px solid #16834c;outline-offset:2px}",
        "#firefly-image-preview-dialog .firefly-image-preview__image-wrap{display:flex;align-items:center;justify-content:center;min-height:140px;max-height:calc(92vh - 62px);overflow:auto;padding:14px;background:linear-gradient(45deg,#eef2ee 25%,transparent 25%),linear-gradient(-45deg,#eef2ee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eef2ee 75%),linear-gradient(-45deg,transparent 75%,#eef2ee 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}",
        "#firefly-image-preview-dialog .firefly-image-preview__image{display:block;max-width:100%;max-height:calc(92vh - 100px);width:auto;height:auto;object-fit:contain;border-radius:5px;box-shadow:0 4px 24px #102e1b24}",
        "@media(max-width:520px){#firefly-image-preview-dialog .firefly-image-preview__bar{align-items:flex-start;flex-direction:column;gap:8px}#firefly-image-preview-dialog .firefly-image-preview__actions{width:100%}#firefly-image-preview-dialog .firefly-image-preview__button{flex:1}#firefly-image-preview-dialog .firefly-image-preview__image-wrap{padding:8px}}",
        "@media(prefers-color-scheme:dark){#firefly-image-preview-dialog{background:#1a231b;color:#e6eee7;border-color:#405645}#firefly-image-preview-dialog .firefly-image-preview__bar{background:#202820;border-color:#405645}#firefly-image-preview-dialog .firefly-image-preview__caption{color:#e6eee7}#firefly-image-preview-dialog .firefly-image-preview__button{background:#263328;color:#e6eee7;border-color:#4c6551}}",
      ].join("\n");
      document.head.append(style);

      dialog = document.createElement("dialog");
      dialog.id = "firefly-image-preview-dialog";
      dialog.setAttribute("aria-label", "图片放大预览");
      const layout = document.createElement("div");
      layout.className = "firefly-image-preview__layout";
      const bar = document.createElement("div");
      bar.className = "firefly-image-preview__bar";
      const caption = document.createElement("div");
      caption.className = "firefly-image-preview__caption";
      caption.dataset.imageCaption = "true";
      caption.textContent = "图片预览";
      const actions = document.createElement("div");
      actions.className = "firefly-image-preview__actions";
      const original = document.createElement("a");
      original.className = "firefly-image-preview__button";
      original.dataset.imageOriginal = "true";
      original.textContent = "打开原图 ↗";
      original.target = "_blank";
      original.rel = "noopener noreferrer";
      original.hidden = true;
      const close = document.createElement("button");
      close.type = "button";
      close.className = "firefly-image-preview__button";
      close.textContent = "关闭";
      close.addEventListener("click", () => dialog.close());
      actions.append(original, close);
      bar.append(caption, actions);
      const imageWrap = document.createElement("div");
      imageWrap.className = "firefly-image-preview__image-wrap";
      const previewImage = document.createElement("img");
      previewImage.className = "firefly-image-preview__image";
      previewImage.alt = "";
      previewImage.decoding = "async";
      previewImage.addEventListener("error", () => {
        caption.textContent = (caption.textContent || "图片") + "（加载失败，请检查图片链接或网络）";
      });
      imageWrap.append(previewImage);
      layout.append(bar, imageWrap);
      dialog.append(layout);
      document.body.append(dialog);
      dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
      });
    }

    const previewImage = dialog.querySelector(".firefly-image-preview__image");
    const caption = dialog.querySelector("[data-image-caption]");
    const original = dialog.querySelector("[data-image-original]");
    previewImage.src = imageSrc;
    previewImage.alt = alt || title || "图片预览";
    previewImage.title = title || "";
    caption.textContent = alt || title || "图片预览";
    try {
      const url = new URL(imageSrc, location.href);
      const safeProtocol = url.protocol === "https:" || url.protocol === "http:";
      original.hidden = !safeProtocol;
      if (safeProtocol) original.href = url.href;
      else original.removeAttribute("href");
    } catch {
      original.hidden = true;
      original.removeAttribute("href");
    }

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  const markdownPreviewElement = $("markdownPreview");
  if (markdownPreviewElement) {
    markdownPreviewElement.addEventListener("click", event => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      event.preventDefault();
      openImagePreview(target.currentSrc || target.src, target.alt || "", target.title || "");
    });
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


  function openTableInsertDialog() {
    if (!editor || visualLoadFailed || document.getElementById("firefly-table-insert-dialog")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "firefly-table-insert-dialog";
    dialog.setAttribute("aria-labelledby", "firefly-table-insert-title");
    const style = document.createElement("style");
    style.textContent = [
      "#firefly-table-insert-dialog{width:min(480px,calc(100vw - 24px));max-width:none;border:1px solid #d6e4d8;border-radius:16px;padding:0;background:#fbfdfb;color:#243329;box-shadow:0 20px 70px #102e1b33}",
      "#firefly-table-insert-dialog::backdrop{background:#16231c88;backdrop-filter:blur(3px)}",
      ".firefly-table-insert-inner{padding:22px;display:grid;gap:15px}",
      ".firefly-table-insert-inner h2{margin:0;font-size:19px;line-height:1.4}",
      ".firefly-table-insert-hint{margin:0;color:#67766a;font-size:12px;line-height:1.6}",
      ".firefly-table-insert-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}",
      ".firefly-table-insert-field{display:grid;gap:6px;min-width:0}",
      ".firefly-table-insert-field label{font-size:12px;font-weight:700;color:#536457}",
      ".firefly-table-insert-field input{width:100%;box-sizing:border-box;border:1px solid #ceddce;border-radius:8px;padding:10px;background:#fff;color:#243329;font:inherit;font-size:14px}",
      ".firefly-table-insert-check{display:flex;align-items:center;gap:9px;font-size:13px}",
      ".firefly-table-insert-check input{width:17px;height:17px;accent-color:#177746}",
      ".firefly-table-insert-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}",
      ".firefly-table-insert-actions button{border:1px solid #cbd9ce;border-radius:8px;background:#fff;color:#314536;padding:9px 13px;font:inherit;font-size:13px;cursor:pointer}",
      ".firefly-table-insert-actions .primary{background:#177746;color:#fff;border-color:#177746;font-weight:750}",
      ".firefly-table-insert-error{margin:0;color:#b42323;font-size:12px;line-height:1.5}",
      "@media(max-width:420px){.firefly-table-insert-inner{padding:16px}.firefly-table-insert-actions button{flex:1}}",
      "@media(prefers-color-scheme:dark){#firefly-table-insert-dialog{background:#1a231b;color:#e6eee7;border-color:#3f5844}.firefly-table-insert-hint,.firefly-table-insert-field label{color:#b8c9bb}.firefly-table-insert-field input,.firefly-table-insert-actions button{background:#202820;color:#e4ece5;border-color:#4c6551}.firefly-table-insert-actions .primary{background:#26794a;color:#fff;border-color:#26794a}}",
    ].join("\n");
    document.head.append(style);
    const inner = document.createElement("div");
    inner.className = "firefly-table-insert-inner";
    const heading = document.createElement("h2");
    heading.id = "firefly-table-insert-title";
    heading.textContent = "插入 Markdown 表格";
    const hint = document.createElement("p");
    hint.className = "firefly-table-insert-hint";
    hint.textContent = "选择表格大小。插入后可以在单元格中直接编辑，再通过表格工具添加或删除行列。";
    const fields = document.createElement("div");
    fields.className = "firefly-table-insert-fields";
    const makeNumberField = (labelText, id, value, max) => {
      const wrap = document.createElement("div");
      wrap.className = "firefly-table-insert-field";
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = labelText;
      const input = document.createElement("input");
      input.id = id;
      input.type = "number";
      input.min = "1";
      input.max = String(max);
      input.step = "1";
      input.required = true;
      input.value = String(value);
      wrap.append(label, input);
      return input;
    };
    const rowsInput = makeNumberField("行数（1–30）", "firefly-table-insert-rows", 3, 30);
    const colsInput = makeNumberField("列数（1–12）", "firefly-table-insert-cols", 3, 12);
    fields.append(rowsInput.parentElement, colsInput.parentElement);
    const checkLabel = document.createElement("label");
    checkLabel.className = "firefly-table-insert-check";
    const headerCheck = document.createElement("input");
    headerCheck.type = "checkbox";
    headerCheck.checked = true;
    const checkText = document.createElement("span");
    checkText.textContent = "第一行作为表头";
    checkLabel.append(headerCheck, checkText);
    const error = document.createElement("p");
    error.className = "firefly-table-insert-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "firefly-table-insert-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    const insert = document.createElement("button");
    insert.type = "button";
    insert.className = "primary";
    insert.textContent = "插入表格";
    actions.append(cancel, insert);
    inner.append(heading, hint, fields, checkLabel, error, actions);
    dialog.append(inner);
    document.body.append(dialog);

    const close = () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      dialog.remove();
      style.remove();
    };
    cancel.addEventListener("click", close);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      close();
    });
    insert.addEventListener("click", () => {
      const rows = Number(rowsInput.value);
      const cols = Number(colsInput.value);
      const validRows = Number.isInteger(rows) && rows >= 1 && rows <= 30;
      const validCols = Number.isInteger(cols) && cols >= 1 && cols <= 12;
      if (!validRows || !validCols) {
        error.textContent = "行数请填写 1–30 的整数，列数请填写 1–12 的整数。";
        error.hidden = false;
        return;
      }
      if (typeof editor.commands.insertTable !== "function") {
        error.textContent = "当前编辑器不支持插入表格，请刷新后台后重试。";
        error.hidden = false;
        return;
      }
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: headerCheck.checked }).run();
      status("已插入 " + rows + " 行 " + cols + " 列的 Markdown 表格" + (headerCheck.checked ? "（含表头）。" : "。") + "可以直接填写单元格。");
      close();
    });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    rowsInput.focus();
    rowsInput.select();
  }

  function runAction(action) {
    if (!editor || visualLoadFailed) {
      status("当前文档未能安全载入可视化编辑器，请先使用源码模式。", true);
      return;
    }
    if (editor.state.selection.node?.type.name === "protectedMarkdownBlock") {
      status("当前选择的是受保护的 MDX/Markdown 语法块；请使用专用编辑控件，不会直接覆盖原始语法。", true);
      return;
    }
    const chain = editor.chain().focus();
    switch (action) {
      case "badge": {
        editor.chain().focus().insertContent({
          type: "fireflyBadge",
          attrs: { type: "tip", label: "新徽章" },
        }).run();
        break;
      }
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
        openTableInsertDialog();
        break;
      case "addRowBefore": if (typeof editor.commands.addRowBefore === "function") editor.chain().focus().addRowBefore().run(); else status("无法在当前位置插入行，请先点入表格单元格。", true); break;
      case "addRowAfter": if (typeof editor.commands.addRowAfter === "function") editor.chain().focus().addRowAfter().run(); else status("无法在当前位置插入行，请先点入表格单元格。", true); break;
      case "addColumnBefore": if (typeof editor.commands.addColumnBefore === "function") editor.chain().focus().addColumnBefore().run(); else status("无法在当前位置插入列，请先点入表格单元格。", true); break;
      case "addColumnAfter": if (typeof editor.commands.addColumnAfter === "function") editor.chain().focus().addColumnAfter().run(); else status("无法在当前位置插入列，请先点入表格单元格。", true); break;
      case "toggleHeaderRow": if (typeof editor.commands.toggleHeaderRow === "function") editor.chain().focus().toggleHeaderRow().run(); else status("当前编辑器版本暂不支持切换表头。", true); break;
      case "deleteRow": if (typeof editor.commands.deleteRow === "function") editor.chain().focus().deleteRow().run(); else status("无法删除当前行，请先点入表格单元格。", true); break;
      case "deleteColumn": if (typeof editor.commands.deleteColumn === "function") editor.chain().focus().deleteColumn().run(); else status("无法删除当前列，请先点入表格单元格。", true); break;
      case "deleteTable": if (typeof editor.commands.deleteTable === "function") editor.chain().focus().deleteTable().run(); else status("无法删除表格，请先点入表格单元格。", true); break;
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
      case "imageUrl": openImageUrlDialog(); break;
      default: break;
    }
    syncSourceFromEditor();
  }



  // URL image picker based on Pages CMS media insertion UX.
  // The selection and Markdown are untouched until a valid URL is submitted.
  function openImageUrlDialog() {
    if (!editor || visualLoadFailed) return;
    if (document.getElementById("firefly-insert-image-url")) return;
    const dialog = document.createElement("dialog");
    dialog.id = "firefly-insert-image-url";
    dialog.setAttribute("aria-labelledby", "firefly-image-url-title");
    const form = document.createElement("form");
    form.className = "firefly-image-url-form";
    form.noValidate = true;
    const title = document.createElement("h2");
    title.id = "firefly-image-url-title";
    title.textContent = "从图床链接插入图片";
    const helper = document.createElement("p");
    helper.textContent = "粘贴 HTTPS 图片地址或站内 / 开头的图片路径。取消不会改变文章正文。";
    const imageLabel = document.createElement("label");
    imageLabel.textContent = "图片地址 *";
    const urlInput = document.createElement("input");
    urlInput.type = "text"; urlInput.required = true; urlInput.maxLength = 2048;
    urlInput.placeholder = "https://tu.example.com/image.webp";
    imageLabel.append(urlInput);
    const altLabel = document.createElement("label");
    altLabel.textContent = "图片说明（可选）";
    const altInput = document.createElement("input");
    altInput.type = "text"; altInput.maxLength = 160;
    altInput.placeholder = "例如：三视图作图示例";
    altLabel.append(altInput);
    const preview = document.createElement("img");
    preview.alt = "插入前的图片预览"; preview.loading = "lazy";
    preview.hidden = true;
    const error = document.createElement("p");
    error.setAttribute("role","alert"); error.className="firefly-image-url-error"; error.hidden=true;
    const actions = document.createElement("div");
    actions.className = "firefly-image-url-actions";
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.textContent = "取消";
    const save = document.createElement("button");
    save.type = "submit"; save.textContent = "插入图片"; save.className="primary";
    actions.append(cancel, save);
    form.append(title,helper,imageLabel,altLabel,preview,error,actions);
    dialog.append(form);
    const css = document.createElement("style");
    css.dataset.fireflyImageUrlStyles = "true";
    css.textContent = [
      "#firefly-insert-image-url{width:min(500px,calc(100vw - 24px));max-width:none;border:1px solid #d5e5db;border-radius:15px;padding:0;box-shadow:0 22px 72px #172d2244;background:#fff;color:#26392d}",
      "#firefly-insert-image-url::backdrop{background:#13271a99}",
      ".firefly-image-url-form{display:grid;gap:12px;padding:20px}",
      ".firefly-image-url-form h2{margin:0;font-size:18px}",
      ".firefly-image-url-form p{font-size:12px;line-height:1.6;color:#627366;margin:0}",
      ".firefly-image-url-form label{display:grid;gap:6px;font-size:13px;font-weight:600}",
      ".firefly-image-url-form input{width:100%;box-sizing:border-box;border:1px solid #c7d8cd;border-radius:8px;background:#fff;color:#223629;padding:10px;font:14px system-ui}",
      ".firefly-image-url-form img:not([hidden]){display:block;max-height:160px;max-width:100%;object-fit:contain;border-radius:8px;border:1px solid #dce7dd}",
      ".firefly-image-url-form .firefly-image-url-error{color:#b42318}",
      ".firefly-image-url-actions{display:flex;justify-content:flex-end;gap:8px}",
      ".firefly-image-url-actions button{padding:9px 14px;border:1px solid #c9d8cb;border-radius:8px;background:#fff;color:#253e2c;cursor:pointer;font:13px system-ui}",
      ".firefly-image-url-actions .primary{background:#17834c;border-color:#17834c;color:#fff}",
      "@media(max-width:480px){.firefly-image-url-form{padding:15px}.firefly-image-url-actions button{flex:1}}",
    ].join("\n");
    document.head.append(css);
    document.body.append(dialog);
    const cleanup = () => { preview.removeAttribute("src"); dialog.remove(); css.remove(); };
    const close = () => {
      if (typeof dialog.close === "function") dialog.close();
      else cleanup();
    };
    dialog.addEventListener("close", cleanup, { once: true });
    cancel.addEventListener("click", close);
    urlInput.addEventListener("input", () => {
      error.hidden = true;
      const valid = validateImageSource(urlInput.value);
      preview.hidden = !valid;
      if (valid) preview.src = valid;
      else preview.removeAttribute("src");
    });
    preview.addEventListener("error", () => { preview.hidden = true; });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const url = validateImageSource(urlInput.value);
      const alt = altInput.value.replace(/[\r\n]/g, " ").trim();
      if (!url) {
        error.textContent = "请填写安全的 HTTPS 图片地址或站内绝对路径，不能包含空格、括号或不安全协议。";
        error.hidden = false;
        urlInput.focus();
        return;
      }
      const inserted = editor.chain().focus().setImage({ src: url, alt }).run();
      if (!inserted) {
        error.textContent = "当前编辑位置无法插入图片，请先选择普通正文段落。";
        error.hidden = false;
        return;
      }
      close();
      status("图床图片已插入编辑器。正文尚未保存到 GitHub。");
    });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    urlInput.focus();
  }


  // Pages CMS-inspired searchable command menu. This is UI only: typing,
  // searching and dismissing it never changes the Markdown/MDX document.
  function createSlashPalette() {
    const menu = document.createElement("div");
    menu.className = "firefly-slash-menu";
    menu.hidden = true;
    menu.setAttribute("aria-label", "可视化内容快捷插入");
    const label = document.createElement("label");
    label.className = "firefly-slash-label";
    label.textContent = "搜索插入命令";
    const input = document.createElement("input");
    input.type = "search"; input.autocomplete = "off";
    input.placeholder = "标题、列表、表格、图片…";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "firefly-slash-options");
    label.append(input);
    const options = document.createElement("div");
    options.id = "firefly-slash-options";
    options.className = "firefly-slash-options";
    options.setAttribute("role", "listbox");
    const empty = document.createElement("p");
    empty.className = "firefly-slash-empty";
    empty.setAttribute("role", "status");
    empty.textContent = "没有匹配命令";
    menu.append(label,options,empty);
    const style = document.createElement("style");
    style.textContent = [
      ".firefly-slash-menu[hidden]{display:none!important}",
      ".firefly-slash-menu{position:relative;z-index:40;margin:6px 0 12px;padding:12px;background:#fff;border:1px solid #cde1d3;border-radius:13px;box-shadow:0 10px 24px #1835261a;max-height:310px;overflow:auto}",
      ".firefly-slash-label{display:grid;gap:7px;font:600 12px system-ui;color:#447353}",
      ".firefly-slash-label input{box-sizing:border-box;width:100%;padding:10px;border:1px solid #c9decf;border-radius:8px;background:#fff;color:#223629;font:14px system-ui}",
      ".firefly-slash-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:5px;margin-top:8px}",
      ".firefly-slash-options button{display:grid;gap:2px;border:1px solid transparent;border-radius:8px;background:#f5f9f6;color:#285c3d;text-align:left;padding:9px;cursor:pointer;font:13px system-ui}",
      ".firefly-slash-options button small{color:#698574;font-size:10px}",
      ".firefly-slash-options button[aria-selected=true],.firefly-slash-options button:hover,.firefly-slash-options button:focus-visible{background:#e3f5e9;border-color:#82cba0;outline:2px solid transparent}",
      ".firefly-slash-empty{font:12px system-ui;color:#7a8981;padding:7px;margin:0}",
      "@media(prefers-color-scheme:dark){.firefly-slash-menu{background:#202a22;border-color:#47614c}.firefly-slash-label{color:#a8cfb3}.firefly-slash-label input{background:#202820;color:#e6ede8;border-color:#4c6551}.firefly-slash-options button{background:#2b382e;color:#d6eadc}.firefly-slash-options button[aria-selected=true],.firefly-slash-options button:hover{background:#36533f}}",
    ].join("\n");
    document.head.append(style);
    editorElement.insertAdjacentElement("beforebegin", menu);
    let shown = [];
    let active = 0;
    const close = (restoreFocus = false) => {
      menu.hidden = true;
      input.setAttribute("aria-expanded","false");
      input.removeAttribute("aria-activedescendant");
      input.value = "";
      if (restoreFocus) editor?.commands.focus();
    };
    const highlight = () => {
      const buttons = [...options.querySelectorAll("button")];
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute("aria-selected",String(i === active));
        if (i === active) input.setAttribute("aria-activedescendant",buttons[i].id);
      }
      if (!buttons.length) input.removeAttribute("aria-activedescendant");
    };
    const choose = index => {
      const item = shown[index];
      if (!item || visualLoadFailed) return;
      close();
      runAction(item.key);
    };
    const render = () => {
      shown = filterSlashItems(SLASH_ITEMS,input.value).slice(0,14);
      active = 0;
      options.replaceChildren();
      empty.hidden = shown.length > 0;
      for (let i = 0; i < shown.length; i++) {
        const item = shown[i];
        const button = document.createElement("button");
        button.type = "button";
        button.id = "firefly-slash-item-" + i;
        button.setAttribute("role", "option");
        const heading = document.createElement("strong");
        heading.textContent = item.label;
        const hint = document.createElement("small");
        hint.textContent = item.keywords.split(" ").slice(0,3).join(" · ");
        button.append(heading,hint);
        button.addEventListener("mousedown",event => event.preventDefault());
        button.addEventListener("click",() => choose(i));
        options.append(button);
      }
      highlight();
    };
    const open = () => {
      input.value = "";
      menu.hidden = false;
      input.setAttribute("aria-expanded","true");
      render();
      input.focus();
    };
    editorElement.addEventListener("keydown", event => {
      if (event.key !== "/" || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || !editor || visualLoadFailed) return;
      if (activeMode !== "visual" || editor.isActive("codeBlock") || editor.isActive("tableCell") || editor.isActive("tableHeader")) return;
      const selection = editor.state.selection;
      if (!selection.empty || selection.$from.parent.type.name !== "paragraph" || selection.$from.parent.textContent.length !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      open();
    }, true);
    input.addEventListener("input",render);
    input.addEventListener("keydown",event => {
      if (event.key === "Escape") {event.preventDefault();close(true);return;}
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (shown.length) active = (active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
        highlight();
      }
      if (event.key === "Enter") { event.preventDefault(); choose(active); }
    });
    menu.addEventListener("keydown",event => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
    });
    document.addEventListener("pointerdown",event => {
      if (!menu.hidden && !menu.contains(event.target) && !editorElement.contains(event.target)) close();
    });
    window.addEventListener("firefly:source-loaded", () => close());
    window.addEventListener("firefly:mode",event => { if (event.detail?.mode !== "visual") close(); });
  }

  async function init() {
    const providerName = await loadTiptapModules();
    ensureCalloutStyles();
    ensureBadgeStyles();
    ensureImagePreviewTriggerStyles();
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
        Image.configure({
          inline: false,
          allowBase64: false,
          // Make editor images discoverable and keyboard-accessible without changing Markdown serialization.
          HTMLAttributes: {
            class: "firefly-image-preview-trigger",
            tabindex: "0",
            role: "button",
            "data-firefly-image-preview": "true",
          },
        }),
        TableKit,
        createMdxBadgeInline(),
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
        handleClickOn(_view, _position, node, _nodePosition, event) {
          if (node.type.name !== "image" || event.button !== 0) return false;
          event.preventDefault();
          openImagePreview(node.attrs.src, node.attrs.alt, node.attrs.title);
          return true;
        },
        handleKeyDown(_view, event) {
          if (event.key !== "Enter" && event.key !== " ") return false;
          const target = event.target;
          if (!(target instanceof HTMLImageElement)
            || !editorElement.contains(target)
            || target.getAttribute("data-firefly-image-preview") !== "true") {
            return false;
          }
          event.preventDefault();
          openImagePreview(
            target.getAttribute("src") || "",
            target.getAttribute("alt") || "",
            target.getAttribute("title") || "",
          );
          return true;
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
          if (typeof state === "boolean") {
            button.classList.toggle("is-active", state);
            button.setAttribute("aria-pressed", String(state));
          }
        });
        const tableTools = $("tableEditorTools");
        const inTable = activeEditor.isActive("table");
        if (tableTools) tableTools.hidden = !inTable;
        const tableActions = new Set(["addRowBefore", "addRowAfter", "addColumnBefore", "addColumnAfter", "toggleHeaderRow", "deleteRow", "deleteColumn", "deleteTable"]);
        for (const button of document.querySelectorAll("[data-editor-action]")) {
          const action = button.getAttribute("data-editor-action");
          if (!tableActions.has(action)) continue;
          const capabilities = activeEditor.can();
          const command = capabilities[action];
          button.disabled = !inTable || typeof command !== "function" || !command.call(capabilities);
        }
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
      button.addEventListener("mousedown", event => {
        if (button.closest("#tableEditorTools")) event.preventDefault();
      });
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

    createSlashPalette();
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
        return restoreProtectedMarkdownStrict(editor.getMarkdown(), records, requiredProtectedMarkers);
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
