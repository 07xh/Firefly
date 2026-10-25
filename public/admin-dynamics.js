(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const endpoint = "/api/admin/dynamics/";
  const state = { items: [], selected: null, dirty: false, busy: false };
  const fields = ["published", "location", "pinned", "body"];

  function say(message, bad = false) {
    const el = $("status");
    el.textContent = message;
    el.classList.toggle("bad", bad);
  }

  function localNow() {
    const zone = document.documentElement.dataset.siteTimezone || "Asia/Shanghai";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return values.year + "-" + values.month + "-" + values.day + "T" +
      values.hour + ":" + values.minute + ":" + values.second;
  }

  function setBusy(value) {
    state.busy = value;
    ["save", "remove", "new", "reset", "refresh", "imageFile", "insertImage"].forEach((id) => {
      $(id).disabled = value;
    });
  }

  async function api(method, payload, query = "") {
    const response = await fetch(endpoint + query, {
      method,
      credentials: "same-origin",
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify(payload) }),
    });
    const data = await response.json().catch(() => ({ error: "接口没有返回有效 JSON（HTTP " + response.status + "）" }));
    if (response.status === 401) {
      window.location.assign("/admin/login/?next=" + encodeURIComponent(window.location.pathname));
      throw new Error("登录已失效");
    }
    if (!response.ok) throw new Error(data.error || "请求失败（HTTP " + response.status + "）");
    return data;
  }

  function maybeLeave() {
    return !state.dirty || window.confirm("当前有尚未保存的修改，确定放弃并切换吗？");
  }

  function toNew() {
    state.selected = null;
    state.dirty = false;
    $("editor").reset();
    $("published").value = localNow();
    $("editorTitle").textContent = "发布新动态";
    $("save").textContent = "发布动态";
    $("remove").hidden = true;
    $("commitDetails").hidden = true;
    showEdit();
    renderList();
    say("可以编写新动态，图片可上传或插入外链。");
  }

  function currentPayload() {
    return {
      published: $("published").value,
      location: $("location").value,
      pinned: $("pinned").checked,
      body: $("body").value,
    };
  }

  function showEdit() {
    $("body").hidden = false;
    $("preview").hidden = true;
    $("edit").classList.add("soft");
    $("previewButton").classList.remove("soft");
  }

  async function showPreview() {
    $("body").hidden = true;
    $("preview").hidden = false;
    $("edit").classList.remove("soft");
    $("previewButton").classList.add("soft");
    $("preview").textContent = "正在生成 Markdown 预览…";
    try {
      const response = await fetch("/api/admin/preview/", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: $("body").value }),
      });
      const data = await response.json();
      if (response.status === 401) {
        window.location.assign("/admin/login/?next=" + encodeURIComponent(window.location.pathname));
        return;
      }
      if (!response.ok) throw new Error(data.error || "预览失败");
      $("preview").innerHTML = data.html || "<p>暂无内容</p>";
    } catch (error) {
      $("preview").textContent = error instanceof Error ? error.message : "预览失败";
    }
  }

  function renderList() {
    const query = $("search").value.trim().toLocaleLowerCase();
    const entries = state.items.filter((item) => [item.preview, item.location, item.published].join(" ").toLocaleLowerCase().includes(query));
    $("count").textContent = "（" + state.items.length + " 条）";
    const list = $("list");
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = state.items.length ? "没有符合条件的动态。" : "暂无动态，可从右侧发布第一条。";
      list.append(empty);
      return;
    }
    for (const item of entries) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "item" + (state.selected?.path === item.path ? " selected" : "");
      const top = document.createElement("small");
      top.textContent = item.published.replace("T", " ") + (item.location ? " · " + item.location : "");
      const preview = document.createElement("strong");
      preview.textContent = item.preview || "（仅图片或空文本）";
      btn.append(top, preview);
      if (item.pinned) {
        const pin = document.createElement("span");
        pin.className = "pill";
        pin.textContent = "置顶";
        btn.append(pin);
      }
      btn.addEventListener("click", () => void choose(item));
      list.append(btn);
    }
  }

  async function loadList() {
    $("list").textContent = "正在读取 GitHub 动态列表…";
    try {
      state.items = await api("GET", null);
      if (!Array.isArray(state.items)) throw new Error("动态列表格式不正确");
      renderList();
    } catch (error) {
      say(error instanceof Error ? error.message : "动态列表加载失败", true);
      $("list").textContent = "加载失败，请确认网络与 GitHub 写入权限，然后重试。";
    }
  }

  async function choose(item) {
    if (state.busy || !maybeLeave()) return;
    setBusy(true);
    try {
      const full = await api("GET", null, "?path=" + encodeURIComponent(item.path));
      state.selected = { path: full.path, sha: full.sha };
      $("published").value = full.published;
      $("location").value = full.location || "";
      $("pinned").checked = Boolean(full.pinned);
      $("body").value = full.body || "";
      $("editorTitle").textContent = "编辑已发布动态";
      $("save").textContent = "保存修改";
      $("remove").hidden = false;
      $("commitDetails").hidden = true;
      state.dirty = false;
      showEdit();
      renderList();
      say("已载入原始 Markdown。保存后会触发站点重新部署。");
    } catch (error) {
      say(error instanceof Error ? error.message : "读取动态失败", true);
    } finally {
      setBusy(false);
    }
  }

  function showCommit(data, message) {
    say(message);
    if (typeof data.commitUrl === "string" && data.commitUrl.startsWith("https://github.com/")) {
      $("commitLink").href = data.commitUrl;
      $("commitDetails").hidden = false;
    } else {
      $("commitDetails").hidden = true;
    }
  }

  async function save(event) {
    event.preventDefault();
    if (state.busy) return;
    if (!$("editor").reportValidity()) return;
    const payload = currentPayload();
    if (!payload.body.trim()) { say("动态内容不能为空。", true); return; }
    setBusy(true);
    try {
      const updating = Boolean(state.selected);
      const data = await api(updating ? "PUT" : "POST", updating ? { ...payload, ...state.selected } : payload);
      state.selected = { path: data.path, sha: data.sha };
      state.dirty = false;
      $("remove").hidden = false;
      $("editorTitle").textContent = "编辑已发布动态";
      $("save").textContent = "保存修改";
      showCommit(data, "已成功写入 GitHub。请留意 Cloudflare 工作流部署，完成后前台动态才会更新。");
      await loadList();
    } catch (error) {
      say(error instanceof Error ? error.message : "保存失败", true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!state.selected || state.busy) return;
    const message = "确定永久删除这条动态吗？\n文件：" + state.selected.path + "\n删除需要重新部署才能从前台消失。";
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      const data = await api("DELETE", state.selected);
      toNew();
      showCommit(data, "GitHub 动态文件已删除。等待 Cloudflare 部署完成后，前台才会同步删除。");
      await loadList();
    } catch (error) {
      say(error instanceof Error ? error.message : "删除失败", true);
    } finally {
      setBusy(false);
    }
  }

  function insertMarkdown(text) {
    showEdit();
    const box = $("body");
    const start = box.selectionStart;
    const end = box.selectionEnd;
    const prefix = box.value.slice(0, start);
    const suffix = box.value.slice(end);
    const before = prefix && !prefix.endsWith("\n") ? "\n" : "";
    box.value = prefix + before + text + "\n" + suffix;
    const caret = (prefix + before + text + "\n").length;
    box.setSelectionRange(caret, caret);
    box.focus();
    state.dirty = true;
  }

  async function uploadImage() {
    const file = $("imageFile").files?.[0];
    if (!file || state.busy) return;
    if (file.size > 4 * 1024 * 1024) { say("图片不能超过 4 MiB。", true); return; }
    setBusy(true);
    say("正在上传图片到已有图床接口…");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/upload/", { method: "POST", credentials: "same-origin", body: form });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        window.location.assign("/admin/login/?next=" + encodeURIComponent(window.location.pathname));
        return;
      }
      if (!response.ok || !data.imageUrl) throw new Error(data.error || "图片上传失败");
      const alt = file.name.replace(/[\]\[\n\r]/g, "");
      insertMarkdown("![" + alt + "](" + data.imageUrl + ")");
      say("图片上传成功，Markdown 链接已插入正文。保存动态后才会发布。");
    } catch (error) {
      say(error instanceof Error ? error.message : "上传失败", true);
    } finally {
      $("imageFile").value = "";
      setBusy(false);
    }
  }

  fields.forEach((id) => $(id).addEventListener(id === "pinned" ? "change" : "input", () => { state.dirty = true; }));
  $("editor").addEventListener("submit", (event) => void save(event));
  $("remove").addEventListener("click", () => void remove());
  $("new").addEventListener("click", () => { if (!state.busy && maybeLeave()) toNew(); });
  $("reset").addEventListener("click", () => { if (!state.busy && maybeLeave()) toNew(); });
  $("refresh").addEventListener("click", () => { if (!state.busy && maybeLeave()) { toNew(); void loadList(); } });
  $("search").addEventListener("input", renderList);
  $("previewButton").addEventListener("click", () => void showPreview());
  $("edit").addEventListener("click", showEdit);
  $("imageFile").addEventListener("change", () => void uploadImage());
  $("insertImage").addEventListener("click", () => {
    const value = window.prompt("输入图片 HTTPS 地址（支持现有图床的直链）");
    if (value === null) return;
    if (!/^https:\/\//i.test(value) || /[\s<>()]/.test(value)) { say("请输入无空格的 HTTPS 图片直链。", true); return; }
    insertMarkdown("![动态图片](" + value + ")");
  });
  window.addEventListener("beforeunload", (event) => {
    if (state.dirty) { event.preventDefault(); event.returnValue = ""; }
  });
  toNew();
  void loadList();
})();