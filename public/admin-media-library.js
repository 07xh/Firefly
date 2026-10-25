// Read-only media explorer for the Firefly admin route. No deletion or uploads.
(() => {
  const $ = (id) => document.getElementById(id);
  const grid = $("adminMediaList");
  const search = $("adminMediaSearch");
  const status = $("adminMediaStatus");
  const reload = $("adminMediaReload");
  if (!grid || !search || !status || !reload) return;

  let entries = [];
  let loaded = false;
  let loading = false;

  async function copy(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      status.textContent = "内容已复制，可直接粘贴到文章。";
    } catch {
      window.prompt("请复制以下内容：", text);
    }
  }

  function makeAction(label, content) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = label;
    button.addEventListener("click", () => copy(content));
    return button;
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    const matches = entries.filter((item) =>
      item.path.toLocaleLowerCase().includes(query)
    );
    grid.replaceChildren();
    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = loaded ? "没有找到符合条件的仓库图片。" : "尚未读取媒体资源。";
      grid.append(empty);
    }

    for (const item of matches.slice(0, 60)) {
      const card = document.createElement("article");
      card.className = "admin-media-item";
      const preview = document.createElement("a");
      preview.href = item.url;
      preview.target = "_blank";
      preview.rel = "noopener noreferrer";
      preview.setAttribute("aria-label", "查看图片：" + item.name);
      const image = document.createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = item.name;
      image.src = item.url;
      preview.append(image);

      const filename = document.createElement("strong");
      filename.className = "admin-media-filename";
      filename.textContent = item.name;
      filename.title = item.path;
      const location = document.createElement("small");
      location.className = "admin-media-path";
      location.textContent = item.path;
      const actions = document.createElement("div");
      actions.className = "admin-media-actions";
      actions.append(
        makeAction("复制链接", item.url),
        makeAction("复制 Markdown", "![图片](" + item.url.replace(/\(/g, "%28").replace(/\)/g, "%29") + ")"),
      );
      card.append(preview, filename, location, actions);
      grid.append(card);
    }

    if (loaded) {
      status.textContent = "仓库中找到 " + entries.length + " 张图片，当前匹配 " + matches.length
        + " 张" + (matches.length > 60 ? "（为保持流畅，仅显示前 60 张，可缩小搜索范围）" : "。");
    }
  }

  async function load(force = false) {
    if (loading || (loaded && !force)) return;
    loading = true;
    reload.disabled = true;
    status.textContent = "正在读取仓库媒体列表…";
    try {
      const response = await fetch("/api/admin/media/", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        location.assign("/admin/login/?next=%2Fadmin%2F");
        return;
      }
      const data = await response.json().catch(() => ({ error: "无法解析媒体接口响应。" }));
      if (!response.ok || data.readOnly !== true || !Array.isArray(data.items)) {
        throw new Error(data.error || "媒体列表响应不完整，已停止读取。");
      }
      entries = data.items.filter((item) =>
        typeof item.path === "string" &&
        typeof item.name === "string" &&
        typeof item.url === "string" &&
        /^https:\/\/raw\.githubusercontent\.com\//.test(item.url)
      );
      loaded = true;
      render();
    } catch (error) {
      entries = [];
      loaded = false;
      grid.replaceChildren();
      status.textContent = error instanceof Error ? error.message : "媒体列表读取失败。";
    } finally {
      loading = false;
      reload.disabled = false;
    }
  }

  search.addEventListener("input", render);
  reload.addEventListener("click", () => load(true));
  $("tabMedia")?.addEventListener("click", () => load());
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.('[data-admin-go="media"]')) load();
  });
})();
