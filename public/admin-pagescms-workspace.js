// Pages CMS-inspired helpers for the existing Firefly article workspace.
// Keep GitHub state and writes in /api/admin/articles; this file never writes content.
export function tagsFromArticle(article) {
  if (Array.isArray(article?.tags)) return article.tags.map(String).map(x=>x.trim()).filter(Boolean);
  const raw = String(article?.content || "").match(/^tags:\s*(.*?)\s*$/m)?.[1] || "";
  if (!raw) return [];
  try {
    const decoded = JSON.parse(raw);
    if (Array.isArray(decoded)) return decoded.filter(x=>typeof x==="string").map(x=>x.trim()).filter(Boolean);
  } catch {}
  return raw.replace(/^\[|\]$/g,"").split(",").map(x=>x.trim().replace(/^['"]|['"]$/g,"")).filter(Boolean);
}

export function categoryFromArticle(article) {
  if (typeof article?.category === "string" && article.category) return article.category.trim();
  const raw = String(article?.content || "").match(/^category:\s*(.*?)\s*$/m)?.[1] || "";
  try { return JSON.parse(raw) || ""; } catch { return raw.replace(/^['"]|['"]$/g,"").trim(); }
}

export function appendTag(csv, value) {
  const source = String(csv || "").split(/[,，]/).map(x=>x.trim()).filter(Boolean);
  const tag = String(value || "").trim();
  if (!tag || source.some(x=>x.toLocaleLowerCase()===tag.toLocaleLowerCase())) return source.join(", ");
  if (source.length >= 20) return source.join(", ");
  return [...source, tag].join(", ");
}

export function validArticlePath(path) {
  return /^src\/content\/posts\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+\.mdx?$/u.test(String(path||""));
}

export function historyUrl(path) {
  if (!validArticlePath(path)) return "";
  return "https://github.com/07xh/Firefly/commits/master/" +
    path.split("/").map(encodeURIComponent).join("/");
}

function mountWorkspace() {
  const state = window.FireflyAdminContent;
  const byId = id => document.getElementById(id);
  const refreshButton = byId("refresh");
  const tagInput = byId("tags");
  const category = byId("category");
  if (!state || !refreshButton || !tagInput || !category) return;

  const styles = document.createElement("style");
  styles.textContent = [
    ".cms-tools{display:flex;flex-wrap:wrap;gap:7px;padding:3px 0 10px}",
    ".cms-tools .btn{font-size:12px;min-height:34px}",
    ".cms-content-summary{font-size:12px;color:#627b6a;margin:0 0 10px}",
    ".cms-tag-suggestions{display:flex;gap:5px;flex-wrap:wrap;margin:3px 0 10px}",
    ".cms-tag-suggestions button{border:1px solid #cae3d0;border-radius:999px;padding:5px 9px;background:#f3faf5;color:#28734b;cursor:pointer;font-size:12px}",
    ".cms-tag-suggestions button:hover,.cms-tag-suggestions button:focus-visible{border-color:#268a54;outline-offset:2px}",
  ].join("\n");
  document.head.append(styles);

  const tools = document.createElement("div");
  tools.className = "cms-tools";
  tools.setAttribute("aria-label", "统一文章管理操作");
  const exportButton = document.createElement("button");
  exportButton.type = "button"; exportButton.className = "btn";
  exportButton.textContent = "导出当前文章"; exportButton.disabled = true;
  const history = document.createElement("a");
  history.className = "btn"; history.textContent = "历史版本";
  history.href = "#"; history.target = "_blank"; history.rel = "noopener noreferrer";
  history.setAttribute("aria-disabled", "true");
  history.addEventListener("click", event => {
    const path = state.selected()?.path || "";
    if (!validArticlePath(path)) event.preventDefault();
  });
  tools.append(exportButton, history);
  refreshButton.closest("div")?.insertAdjacentElement("afterend", tools);

  const summary = document.createElement("p");
  summary.className = "cms-content-summary";
  summary.setAttribute("aria-live", "polite");
  byId("list")?.insertAdjacentElement("beforebegin", summary);

  const datalist = document.createElement("datalist");
  datalist.id = "cmsArticleCategories";
  category.setAttribute("list", datalist.id);
  category.insertAdjacentElement("afterend", datalist);

  const tagChoices = document.createElement("div");
  tagChoices.className = "cms-tag-suggestions";
  tagChoices.setAttribute("aria-label", "已有标签，点击添加");
  tagInput.insertAdjacentElement("afterend", tagChoices);

  function refreshMetadata() {
    const items = state.articles();
    const categories = [...new Set(items.map(categoryFromArticle).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-CN"));
    const tagCounts = new Map();
    for (const article of items) for (const tag of tagsFromArticle(article)) tagCounts.set(tag,(tagCounts.get(tag)||0)+1);
    datalist.replaceChildren(...categories.map(value=>Object.assign(document.createElement("option"),{value})));
    tagChoices.replaceChildren();
    for (const [tag] of [...tagCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"zh-CN")).slice(0,12)) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = "+" + tag;
      b.addEventListener("click", () => {
        tagInput.value = appendTag(tagInput.value,tag);
        tagInput.dispatchEvent(new Event("input",{bubbles:true}));
      });
      tagChoices.append(b);
    }
    summary.textContent = items.length + " 篇文章 · " + categories.length + " 个分类 · " + tagCounts.size + " 个标签";
    syncSelection();
  }

  function syncSelection() {
    const selected = state.selected();
    const valid = Boolean(selected && validArticlePath(selected.path));
    exportButton.disabled = !valid || typeof selected.content !== "string";
    history.href = valid ? historyUrl(selected.path) : "#";
    history.setAttribute("aria-disabled",String(!valid));
  }

  exportButton.addEventListener("click", () => {
    const article = state.selected();
    if (!article || !validArticlePath(article.path) || typeof article.content !== "string") return;
    const blob = new Blob([article.content],{type:"text/markdown;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = article.path.split("/").pop();
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  byId("list")?.addEventListener("click", () => queueMicrotask(syncSelection));
  byId("new")?.addEventListener("click", () => queueMicrotask(syncSelection));
  window.addEventListener("firefly:articles-refreshed", refreshMetadata);
  window.addEventListener("firefly:save-complete", () => queueMicrotask(syncSelection));
  refreshMetadata();
}
if (typeof document !== "undefined") mountWorkspace();
