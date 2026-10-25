import { validateImageSource } from "./admin-editor-commands.js";

/** Ignore fenced/inline code: image-looking text in tutorials is not a media asset. */
function stripCodeFromBody(body) {
  const lines = String(body || "").split(/\r?\n/);
  let fence = null;
  const visible = [];
  for (const line of lines) {
    const opening = line.match(/^ {0,3}(\x60{3,}|~{3,})(.*)$/);
    if (fence) {
      if (opening && opening[1][0] === fence.char && opening[1].length >= fence.length && !opening[2].trim()) fence = null;
      visible.push("");
      continue;
    }
    if (opening) {
      fence = { char: opening[1][0], length: opening[1].length };
      visible.push("");
      continue;
    }
    let result = "";
    for (let i = 0; i < line.length;) {
      if (line[i] !== "\x60") { result += line[i]; i++; continue; }
      let length = 1;
      while (line[i + length] === "\x60") length++;
      const fenceToken = "\x60".repeat(length);
      const closing = line.indexOf(fenceToken, i + length);
      if (closing < 0) { result += line.slice(i,i + length); i += length; continue; }
      result += " ".repeat(closing + length - i);
      i = closing + length;
    }
    visible.push(result);
  }
  return visible.join("\n");
}

function stripFrontmatter(source) {
  const match = String(source || "").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return {
    frontmatter: match?.[1] || "",
    body: match ? source.slice(match[0].length) : String(source || ""),
  };
}

export function collectArticleMedia(articles) {
  const found = new Map();
  const add = (value, alt, article, kind) => {
    const src = validateImageSource(value);
    if (!src || found.size > 300) return;
    const path = typeof article?.path === "string" ? article.path : "";
    const title = String(article?.title || path.split("/").pop() || "未命名文章").slice(0,200);
    let item = found.get(src);
    if (!item) {
      item = { src, alt: String(alt || "").slice(0,160), kind, sources: [] };
      found.set(src,item);
    }
    if (!item.sources.some(source => source.path === path)) item.sources.push({ path, title });
    if (!item.alt && alt) item.alt = String(alt).slice(0,160);
  };
  for (const article of Array.isArray(articles) ? articles : []) {
    const content = typeof article?.content === "string" ? article.content : "";
    if (!content) continue;
    const {frontmatter,body} = stripFrontmatter(content);
    const cover = frontmatter.match(/^image:\s*(.+?)\s*$/m)?.[1]?.trim();
    if (cover) {
      let parsed = cover;
      try { if (cover.startsWith('"')) parsed = JSON.parse(cover); }
      catch { parsed = ""; }
      if (parsed.startsWith("'") && parsed.endsWith("'")) parsed = parsed.slice(1,-1).replace(/''/g,"'");
      add(parsed, "文章封面", article, "cover");
    }
    const visible = stripCodeFromBody(body);
    const markdownImage = /!\[([^\]\r\n]{0,160})\]\(((?:https:\/\/|\/(?!\/))[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;
    for (const match of visible.matchAll(markdownImage)) {
      const position = match.index ?? 0;
      let escapes=0;
      for(let i=position-1;i>=0 && visible[i]==="\\";i--) escapes++;
      if (escapes % 2 === 1) continue;
      add(match[2],match[1],article,"markdown");
    }
    const htmlImage=/<img\b[^>]{0,2000}>/gi;
    for (const match of visible.matchAll(htmlImage)) {
      const attrs = match[0];
      const srcMatch=attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
      if (!srcMatch) continue; // Expressions and unquoted attributes are not evaluated.
      const altMatch=attrs.match(/\balt\s*=\s*(["'])(.*?)\1/i);
      add(srcMatch[2], altMatch?.[2] || "", article, "html");
    }
  }
  return [...found.values()];
}

export function filterArticleMedia(media, query) {
  const q=String(query || "").trim().normalize("NFKC").toLocaleLowerCase();
  if(!q)return [...media];
  return media.filter(x=>[x.src,x.alt,...(x.sources || []).flatMap(source=>[source.title,source.path])]
    .join(" ").normalize("NFKC").toLocaleLowerCase().includes(q));
}

function mountMediaLibrary() {
  const host=document.getElementById("adminMediaLibrary");
  const state=window.FireflyAdminContent;
  if(!host || !state) return;
  host.replaceChildren();
  const style=document.createElement("style");
  style.textContent=[
    ".firefly-media-library{display:grid;gap:12px;margin-top:18px}",
    ".firefly-media-library h3{font-size:17px;font-weight:750;margin:0}",
    ".firefly-media-library__intro,.firefly-media-library__status{font-size:12px;line-height:1.6;color:#617367;margin:0}",
    ".firefly-media-library__search{width:100%;max-width:480px;padding:10px 12px;border:1px solid #d0e0d2;border-radius:9px;background:#fff;color:#24382b;font:14px system-ui}",
    ".firefly-media-library__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}",
    ".firefly-media-library__item{border:1px solid #dce8df;border-radius:12px;overflow:hidden;background:#fff;min-width:0}",
    ".firefly-media-library__thumb{display:flex;height:126px;align-items:center;justify-content:center;background:#f3f7f4;overflow:hidden}",
    ".firefly-media-library__thumb img{max-width:100%;max-height:100%;object-fit:contain}",
    ".firefly-media-library__details{padding:10px;display:grid;gap:7px}",
    ".firefly-media-library__caption{font-size:12px;font-weight:650;color:#334d3c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".firefly-media-library__source{font-size:11px;color:#718579;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".firefly-media-library__actions{display:flex;flex-wrap:wrap;gap:6px}",
    ".firefly-media-library__actions button,.firefly-media-library__actions a,.firefly-media-library__more{font-size:12px;cursor:pointer;padding:6px 8px;border:1px solid #c7dfce;background:#f5faf6;color:#246942;border-radius:7px;text-decoration:none}",
    ".firefly-media-library__actions button:disabled{opacity:.45;cursor:not-allowed}",
    ".firefly-media-library__manual-copy{font-size:12px;display:grid;gap:4px}",
    ".firefly-media-library__manual-copy[hidden]{display:none!important}",
    ".firefly-media-library__manual-copy input{max-width:100%;font:12px system-ui;padding:7px;border:1px solid #c8d7ca;border-radius:6px}",
    "@media(prefers-color-scheme:dark){.firefly-media-library__item{background:#202b22;border-color:#4a6650}.firefly-media-library__thumb{background:#1e3023}.firefly-media-library__caption{color:#e2efe5}.firefly-media-library__source{color:#a6b9ac}}",
  ].join("\n");
  document.head.append(style);
  host.className="firefly-media-library";
  const heading=document.createElement("h3");
  heading.textContent="文章引用图片库";
  const note=document.createElement("p");
  note.className="firefly-media-library__intro";
  note.textContent="自动整理 Firefly 文章中的图片引用和封面。只读浏览，不代表已连接图床全部文件；删除请前往图床管理。";
  const search=document.createElement("input");
  search.type="search";
  search.className="firefly-media-library__search";
  search.placeholder="搜索图片地址、描述或来源文章";
  search.setAttribute("aria-label","搜索文章引用图片");
  const status=document.createElement("p");
  status.className="firefly-media-library__status";
  status.setAttribute("role","status");
  status.setAttribute("aria-live","polite");
  const grid=document.createElement("div");
  grid.className="firefly-media-library__grid";
  const more=document.createElement("button");
  more.type="button";more.className="firefly-media-library__more";
  more.textContent="显示更多图片";
  const manual=document.createElement("label");
  manual.className="firefly-media-library__manual-copy";
  manual.textContent="无法自动复制时，请在这里手动复制链接：";
  manual.hidden=true;
  const manualInput=document.createElement("input");
  manualInput.readOnly=true;manual.append(manualInput);
  host.append(heading,note,search,status,grid,more,manual);
  let allMedia=[];
  let displayed=40;
  async function copyUrl(url) {
    try {
      if(!navigator.clipboard?.writeText)throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      manual.hidden=true;
      status.textContent="图片链接已复制。";
    } catch {
      manual.hidden=false;
      manualInput.value=url;
      manualInput.focus();
      manualInput.select();
      status.textContent="浏览器未授予自动复制权限，请从下方文本框手动复制。";
    }
  }
  function paint() {
    const filtered=filterArticleMedia(allMedia,search.value);
    grid.replaceChildren();
    const hasCurrent=Boolean(state.selected()?.path);
    for(const item of filtered.slice(0,displayed)) {
      const card=document.createElement("article");
      card.className="firefly-media-library__item";
      const thumb=document.createElement("div");
      thumb.className="firefly-media-library__thumb";
      const image=document.createElement("img");
      image.loading="lazy";image.decoding="async";image.src=item.src;image.alt=item.alt || "文章图片";
      thumb.append(image);
      const detail=document.createElement("div");
      detail.className="firefly-media-library__details";
      const title=document.createElement("div");
      title.className="firefly-media-library__caption";
      title.textContent=item.alt || "未填写图片说明";
      title.title=item.src;
      const source=document.createElement("div");
      source.className="firefly-media-library__source";
      source.textContent=item.sources.map(x=>x.title).join("、");
      const actions=document.createElement("div");
      actions.className="firefly-media-library__actions";
      const copy=document.createElement("button");
      copy.type="button";copy.textContent="复制链接";
      copy.addEventListener("click",()=>void copyUrl(item.src));
      const cover=document.createElement("button");
      cover.type="button";cover.textContent="设为当前文章封面";
      cover.disabled=!hasCurrent;
      cover.title=hasCurrent?"只修改当前文章表单，保存时才写入 GitHub":"请先在文章管理中选择一篇文章";
      cover.addEventListener("click",()=>{
        if(!state.selected()?.path)return;
        const input=document.getElementById("image");
        if(!input)return;
        input.value=item.src;
        input.dispatchEvent(new Event("input",{bubbles:true}));
        document.getElementById("tabEditor")?.click();
        status.textContent="已填入文章封面，尚未保存或发布。";
      });
      const external=document.createElement("a");
      external.href=item.src;external.target="_blank";external.rel="noopener noreferrer";
      external.textContent="查看原图";
      actions.append(copy,cover,external);
      detail.append(title,source,actions);
      card.append(thumb,detail);
      grid.append(card);
    }
    more.hidden=filtered.length<=displayed;
    status.textContent="已扫描 "+state.articles().length+" 篇文章，找到 "+allMedia.length+" 个不同图片引用；当前匹配 "+filtered.length+" 个。";
  }
  function refresh() {
    allMedia=collectArticleMedia(state.articles());
    displayed=40;
    paint();
  }
  search.addEventListener("input",()=>{displayed=40;paint();});
  more.addEventListener("click",()=>{displayed+=40;paint();});
  window.addEventListener("firefly:articles-refreshed",refresh);
  window.addEventListener("firefly:save-complete",()=>queueMicrotask(refresh));
  refresh();
}
if (typeof document !== "undefined") mountMediaLibrary();
