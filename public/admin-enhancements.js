/* Firefly admin editor enhancements: image paste/drop, filters, accessible delete modal, deployment stages. */
(() => {
  const $ = (id) => document.getElementById(id);
  const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

  // Keep destructive controls visible on touch screens; no hover interaction is required.
  const style = document.createElement("style");
  style.textContent = `
    #list button[aria-label^="删除文章"] { opacity: 1 !important; visibility: visible !important; }
    .article-filter-grid { display:grid; grid-template-columns:1fr; gap:8px; margin-top:8px; }
    .firefly-delete-dialog { width:min(92vw,440px); border:1px solid #f0d2cf; border-radius:18px; padding:0; box-shadow:0 24px 80px #11182730; }
    .firefly-delete-dialog::backdrop { background:#17251dcc; backdrop-filter:blur(3px); }
    .firefly-delete-card { padding:22px; background:#fff; border-radius:18px; color:#202820; }
    .firefly-delete-card h2 { margin:12px 0 8px; font-size:18px; }
    .firefly-delete-card p { font-size:13px; line-height:1.7; color:#59675d; overflow-wrap:anywhere; }
    .firefly-delete-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
    .firefly-delete-actions button { min-height:44px; }
    @media(max-width:720px) { .firefly-delete-card { padding:17px; } .firefly-delete-actions { display:grid; grid-template-columns:1fr 1fr; } }
  `;
  document.head.append(style);

  // Category/tag filters are added without disturbing the existing editor layout.
  const statusFilter = $("statusFilter");
  if (statusFilter && ! $("categoryFilter")) {
    const filters = document.createElement("div");
    filters.className = "article-filter-grid";
    filters.innerHTML = '<select id="categoryFilter" aria-label="按分类筛选文章" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700"><option value="">全部分类</option></select><select id="tagFilter" aria-label="按标签筛选文章" class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700"><option value="">全部标签</option></select>';
    statusFilter.insertAdjacentElement("afterend", filters);
  }

  function valueFrom(content, key) {
    if (typeof frontmatterValue === "function") return frontmatterValue(content || "", key);
    const match = String(content || "").match(new RegExp("^" + key + ":\\s*(.*?)\\s*$", "m"));
    return match ? match[1].replace(/^['"]|['"]$/g, "") : "";
  }
  function tagsFor(article) {
    if (Array.isArray(article.tags)) return article.tags;
    const raw = valueFrom(article.content, "tags").replace(/^\[|\]$/g, "");
    return raw ? raw.split(",").map(x => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean) : [];
  }
  function populateFilters() {
    const category = $("categoryFilter"), tag = $("tagFilter");
    if (!category || !tag || !Array.isArray(articles)) return;
    const oldCategory = category.value, oldTag = tag.value;
    const categories = [...new Set(articles.map(a => a.category || valueFrom(a.content, "category")).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-CN"));
    const tags = [...new Set(articles.flatMap(tagsFor))].sort((a,b)=>a.localeCompare(b,"zh-CN"));
    category.replaceChildren(new Option("全部分类", ""));
    categories.forEach(v => category.add(new Option(v, v)));
    tag.replaceChildren(new Option("全部标签", ""));
    tags.forEach(v => tag.add(new Option(v, v)));
    category.value = categories.includes(oldCategory) ? oldCategory : "";
    tag.value = tags.includes(oldTag) ? oldTag : "";
  }
  const baseRender = render;
  render = function() {
    const category = $("categoryFilter")?.value || "";
    const tag = $("tagFilter")?.value || "";
    const original = articles;
    if (category || tag) {
      articles = original.filter(a =>
        (!category || (a.category || valueFrom(a.content, "category")) === category) &&
        (!tag || tagsFor(a).includes(tag))
      );
    }
    try { baseRender(); } finally { articles = original; }
  };
  const baseRefresh = refresh;
  refresh = async function() { await baseRefresh(); populateFilters(); render(); };
  $("categoryFilter")?.addEventListener("change", () => render());
  $("tagFilter")?.addEventListener("change", () => render());

  // Accessible second-confirmation modal. A rejected request leaves the article untouched.
  const dialog = document.createElement("dialog");
  dialog.className = "firefly-delete-dialog";
  dialog.innerHTML = '<form method="dialog" class="firefly-delete-card"><div aria-hidden="true" style="display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#fff0ef;color:#b42318;font-weight:900;font-size:22px">!</div><h2>确认删除文章？</h2><p>删除会提交到 GitHub 并触发 Cloudflare 重新部署。后台不能直接撤销，但可通过 Git 历史恢复。</p><p id="fireflyDeleteTarget" style="padding:9px 11px;border-radius:8px;background:#f7f8f7"></p><div class="firefly-delete-actions"><button type="submit" value="cancel" class="btn">取消</button><button type="submit" value="confirm" class="btn danger">确认删除</button></div></form>';
  document.body.append(dialog);
  function confirmDelete(target) {
    $("fireflyDeleteTarget").textContent = target;
    return new Promise(resolve => {
      const done = () => { dialog.removeEventListener("close", closed); resolve(dialog.returnValue === "confirm"); };
      const closed = () => done();
      dialog.addEventListener("close", closed, { once: true });
      if (typeof dialog.showModal === "function") dialog.showModal();
      else { dialog.removeEventListener("close", closed); resolve(window.confirm("确认删除 " + target + "？")); }
    });
  }
  document.addEventListener("click", async event => {
    const button = event.target?.closest?.('button[aria-label^="删除文章"], #delete');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const row = button.closest(".group");
    const path = row?.querySelectorAll("span")?.[1]?.textContent?.trim();
    const article = button.id === "delete" ? selected : articles.find(a => a.path === path);
    if (!article || !await confirmDelete((article.title || "未命名文章") + " · " + article.path)) return;
    button.disabled = true;
    try {
      const result = await api("DELETE", { path: article.path, sha: article.sha });
      if (selected?.path === article.path) reset();
      say("阶段 2/4：删除已提交到 GitHub。" + (result.commitSha ? " Commit SHA：" + result.commitSha : ""));
      await refresh();
      if (result.commitSha) watchDeployment(result.commitSha);
    } catch (error) {
      say(error instanceof Error ? error.message : "删除失败", true);
    } finally {
      button.disabled = false;
    }
  }, true);

  function insertAtCursor(text) {
    const field = $("body");
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    field.setRangeText(text, start, end, "end");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
  async function uploadImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    if (!allowedImageTypes.has(file.type.toLowerCase())) {
      say("图片格式不支持，仅接受 PNG、JPEG、WebP 和 GIF。", true); return;
    }
    if (file.size < 1 || file.size > 4 * 1024 * 1024) {
      say("图片必须大于 0 且不超过 4 MiB，请压缩后重试。", true); return;
    }
    const marker = "![上传中...](__firefly_upload_" + crypto.randomUUID() + "__)";
    insertAtCursor(marker);
    const form = new FormData();
    form.append("file", file, file.name || "pasted-image.png");
    say("图片正在上传到 GitHub，上传期间请勿删除正文中的占位符…");
    try {
      const response = await fetch("/api/admin/upload/", { method: "POST", body: form, credentials: "same-origin" });
      if (response.status === 401) { goLogin(); throw new Error("登录已过期，请重新登录。"); }
      const data = await response.json().catch(() => ({ error: "图片上传接口响应无法解析" }));
      if (!response.ok) throw new Error(data.error || "图片上传失败");
      const alt = (file.name || "图片").replace(/[\[\]\n\r]/g, " ").trim().slice(0, 100) || "图片";
      const markdown = "![" + alt + "](" + data.imageUrl + ")";
      const field = $("body");
      if (!field.value.includes(marker)) throw new Error("图片已上传，但占位符不见了。请手动插入：" + data.imageUrl);
      field.value = field.value.replace(marker, markdown);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      say("图片上传成功并已插入 Markdown。图片 Commit SHA：" + (data.commitSha || "未返回"));
    } catch (error) {
      const field = $("body");
      if (field.value.includes(marker)) {
        field.value = field.value.replace(marker, "");
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
      say(error instanceof Error ? error.message : "图片上传失败", true);
    }
  }
  $("body")?.addEventListener("paste", event => {
    const files = Array.from(event.clipboardData?.items || [])
      .map(item => item.kind === "file" ? item.getAsFile() : null)
      .filter(file => file && file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    files.forEach(uploadImage);
  });
  $("body")?.addEventListener("dragover", event => {
    if (Array.from(event.dataTransfer?.types || []).includes("Files")) event.preventDefault();
  });
  $("body")?.addEventListener("drop", event => {
    const files = Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith("image/"));
    if (!files.length) return;
    event.preventDefault();
    files.forEach(uploadImage);
  });

  // Four-stage deployment status, with explicit commit and site verification links.
  const links = document.createElement("div");
  links.className = "mt-2 flex flex-wrap gap-3";
  links.innerHTML = '<a id="enhancedCommitLink" class="deploy-link" target="_blank" rel="noopener noreferrer" hidden>查看 GitHub Commit ↗</a><a id="enhancedSiteLink" class="deploy-link" target="_blank" rel="noopener noreferrer" hidden>打开线上网站验证 ↗</a>';
  $("deployLink")?.insertAdjacentElement("afterend", links);
  watchDeployment = async function(sha, attempt = 0) {
    try {
      const response = await fetch("/api/admin/deployment-status/?sha=" + encodeURIComponent(sha), { cache: "no-store" });
      if (response.status === 401) { goLogin(); return; }
      const data = await response.json().catch(() => ({ error: "无法读取部署状态" }));
      if (!response.ok) throw new Error(data.error || "暂时无法查询部署状态");
      const commit = $("enhancedCommitLink");
      commit.href = "https://github.com/07xh/Firefly/commit/" + encodeURIComponent(sha);
      commit.hidden = false;
      if (data.url) { $("deployLink").href = data.url; $("deployLink").hidden = false; }
      if (data.status === "success") {
        $("enhancedSiteLink").href = new URL("/", location.origin).href;
        $("enhancedSiteLink").hidden = false;
        say("阶段 4/4：Cloudflare 构建与部署成功。请打开线上网站验证最终展示。");
        return;
      }
      if (data.status === "failure") { say("阶段 3/4：Cloudflare 构建/部署失败，请打开部署日志检查。", true); return; }
      if (attempt >= 24) { say("阶段 3/4：GitHub 已写入，但部署仍未确认；请查看工作流日志。"); return; }
      say("阶段 3/4：" + (data.status === "running" ? "Cloudflare 正在构建/部署…" : "正在等待 Cloudflare 构建启动…") + " Commit SHA：" + sha);
      setTimeout(() => watchDeployment(sha, attempt + 1), 12000);
    } catch (error) {
      if (attempt >= 24) { say("阶段 3/4：已写入 GitHub，但无法确认部署状态：" + (error?.message || "未知错误"), true); return; }
      say("阶段 3/4：正在查询 Cloudflare 部署状态…");
      setTimeout(() => watchDeployment(sha, attempt + 1), 12000);
    }
  };

  // Refresh the filter options after the initial asynchronous article fetch.
  const initialRefresh = refresh;
  refresh = async function() { await initialRefresh(); populateFilters(); render(); };
  refresh();
})();
