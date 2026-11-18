type PublicProject = {
  id: string;
  name: string;
  description: string;
  language: string;
  fork: boolean;
  stars: number;
  updatedAt: string | null;
  url: string;
};

type SceneCopy = {
  title: string;
  category: string;
  status: string;
  summary: string;
  story: string;
  points: [string, string][];
  accent: string;
  visual: string;
  glow: string;
  image?: string;
};

const copies: Record<string, SceneCopy> = {
  "dorm-os": {
    title: "校序", category: "ACADEMIC OS · ANDROID / WEB", status: "持续开发 · 真机验收中",
    summary: "个人学业操作系统，以原生 Android 为主入口，整合课程、任务与校园信息。",
    story: "把分散的校园学习信息整理成清晰可用的个人工作流。原生 Android 是当前主要方向，Web 承担辅助与服务端能力；学校平台的真实数据对接需要逐项验收。",
    points: [["校园学习", "课表、任务与校园信息的统一组织"], ["跨平台架构", "Android 界面与 Cloudflare 服务端协作"], ["数据连接", "学习通、教务和第二课堂接入持续验证"], ["验证优先", "真实账号、实际设备与服务端状态分别验收"]],
    accent: "#a5eee0", visual: "#275e59", glow: "#367a6d",
    image: "https://raw.githubusercontent.com/07xh/dorm-os/main/apps/xiaoxu-android/docs/ui-verify/268/home-393dp-imported.webp",
  },
  "engineering-drawing-study": {
    title: "绘序 · DraftAI", category: "ENGINEERING / GEOMETRY", status: "持续开发 · 题型闭环验证中",
    summary: "面向工程制图题图的几何约束推理、投影分析与动态逐笔作图系统。",
    story: "重点研究图形条件确认、几何约束求解、投影对应以及从数学结果生成逐笔作图步骤。复杂题型的能力必须依据可复核的数学和真题证据确认。",
    points: [["几何求解", "从已确认条件构建可验证的几何结果"], ["投影关联", "理解二维投影与三维结构的对应关系"], ["逐笔作图", "研究具有依赖关系的动态作图步骤"], ["学习导向", "提供可解释、可检查的作图过程"]],
    accent: "#bfd7ff", visual: "#344c81", glow: "#455dab",
  },
  StudyFlow: {
    title: "学序 · StudyFlow", category: "WINDOWS / LEARNING", status: "持续开发 · 平台验收中",
    summary: "以 React + Tauri 2 + Python sidecar 构建多学习平台共用的 Windows 桌面客户端。",
    story: "StudyFlow 将知到、长江雨课堂、学习通和 U 校园接入统一导航与 UI，同时保留各平台原有业务模块和执行边界。界面明确区分本机播放器位置、任务进程状态与服务器已核验进度；尚未通过真实账号验收的平台不会被标记为已完成接入。",
    points: [["统一桌面架构", "React、Tauri 2 与 Python sidecar 协作"], ["多平台适配", "知到、雨课堂、学习通与 U 校园独立接入"], ["原版能力保留", "通过独立进程承载原平台业务模块"], ["进度可信", "本机事件与服务端确认分层展示"]],
    accent: "#e0caff", visual: "#534272", glow: "#73569a",
  },
  MomoFlow: {
    title: "MomoFlow", category: "ANDROID / LEARNING", status: "v0.5.5 · 前台反馈实验版",
    summary: "围绕墨墨背单词的通知、今日词表、离线释义与前台反馈验证开发的 Android 工具。",
    story: "当前公开版本保留官方只读数据读取与通知功能，并提供用户主动触发的前台反馈实验。Cortex 私有写回协议仍缺少完整请求与服务器回读证据，发送器保持阻断；不会把按钮点击或本地状态冒充服务器成功。",
    points: [["通知交互", "展示今日词条并提供快捷反馈入口"], ["离线释义", "使用本地词典补充音标与中文释义"], ["前台反馈", "在用户授权并主动触发后进行单次交互尝试"], ["安全门禁", "私有接口写回未验收，当前不发送请求"]],
    accent: "#f5d8a8", visual: "#7f563e", glow: "#9c6946",
  },
  wordflow: {
    title: "WordFlow", category: "ANDROID / VOCABULARY", status: "v0.5.3 · 离线优先",
    summary: "离线优先的 Android 通知背词工具，支持本地词库与学习状态备份。",
    story: "WordFlow 以本地 SQLite 词库为核心，提供词条管理、TXT/CSV 导入导出、通知快捷复习和多种出词模式。它不依赖云端账号，也不宣称实现完整 FSRS；完整学习状态可通过 JSON 备份迁移。",
    points: [["本地词库", "SQLite 存储，支持添加、搜索、编辑和删除"], ["通知背词", "支持不会、记住、下一词等快捷操作"], ["数据迁移", "TXT/CSV 词库导入导出与完整 JSON 备份恢复"], ["离线优先", "无云端账号与联网权限，学习数据留在本机"]],
    accent: "#c2e2ff", visual: "#335e7a", glow: "#456c8d",
  },
  "reqable-bridge": {
    title: "Reqable Bridge", category: "NETWORK / DEVELOPMENT", status: "v0.1 · 端到端真机验证待完成",
    summary: "将 Windows Reqable 已完成的 HTTP 会话转发到 Android 端查看与管理。",
    story: "Reqable Bridge 通过 Reqable Report Server 接收已完成的 HTTP 会话，再经本地桥接服务转发到 Android 接收端并保存到 SQLite。它不是原始 TCP/IP 抓包镜像；失败上传不会自动重试，端到端热点连接仍需真机验证。",
    points: [["会话转发", "接收 Reqable Report Server 已完成的 HTTP 会话"], ["跨设备查看", "Android 端解压、解析并本地保存 HAR 数据"], ["远程控制", "手机端可请求 Windows 桥接端启动或暂停抓包"], ["能力边界", "不是原始数据包镜像，端到端连接需现场验收"]],
    accent: "#b0e6e3", visual: "#265a69", glow: "#357b87",
  },
  "kingo-assistant": {
    title: "KingoAssistant", category: "EDUCATION / WINDOWS", status: "只读监控可用 · 在线提交门禁关闭",
    summary: "面向华北水利水电大学青果教务系统的 Windows 选课辅助客户端。",
    story: "项目已具备 Windows 三页导航、选课计划预检、只读监控和独立状态机等开发能力；但线上提交依赖四项证据门禁，目前 0/4 已登记，实时自动提交保持关闭。查询延迟研究也以实测数据为准，不用离线模拟冒充学校端效果。",
    points: [["Windows 客户端", "选课首页、官网备用入口与工具日志分层"], ["只读监控", "记录请求、解析与总耗时，支持离线诊断"], ["提交安全门禁", "四项证据未齐全前阻止真实写入"], ["状态可靠性", "区分成功、失败与待核验状态"]],
    accent: "#e9d29e", visual: "#6a5d37", glow: "#9a8540",
  },
  "zhidao-assistant": {
    title: "知到助手", category: "WINDOWS / LEARNING", status: "v5.2.9 Beta 2 · 独立前身项目",
    summary: "知到平台的 Windows 桌面学习助手，现有功能与历史版本继续保留。",
    story: "该项目是 StudyFlow 学序的技术前身。公开版本包含扫码与 Cookie 登录入口、课程读取、原版播放器和任务运行记录；服务端进度核验与本机播放状态分开展示。后续统一 UI 与多平台接入转入 StudyFlow。",
    points: [["Windows 客户端", "WPF 桌面界面与安装包构建"], ["登录与课程", "提供扫码、Cookie 导入和课程读取入口"], ["进度证据", "区分本机播放位置、任务状态和服务端核验"], ["项目沿革", "后续统一多平台架构由 StudyFlow 承接"]],
    accent: "#bce5c3", visual: "#356653", glow: "#42846b",
  },
  "kingo-live": {
    title: "Kingo Live", category: "EXPERIMENT / RESEARCH", status: "实验研究 · 不在首页展示",
    summary: "教务协议客户端及网络延迟研究。",
    story: "将网络流程研究和离线延迟模拟分开记录，公开页面只提供非敏感的项目概览，不暴露任何认证样本、账号或会话数据。",
    points: [["协议实践", "实验性 HTTP 客户端研究"], ["离线分析", "不同延迟与运行条件的模拟"], ["研究记录", "保留可核验的技术结论"]],
    accent: "#dfc3fa", visual: "#554773", glow: "#745c8f",
  },
  "yuketang-heartbeat": {
    title: "雨课堂通信诊断", category: "EXPERIMENT / NETWORK", status: "诊断实验 · 不在首页展示",
    summary: "个人网络通信稳定性与日志诊断实验。",
    story: "用于分析本地通信异常和响应处理；离线测试结果不等于平台服务器确认，不宣传未验证的课程进度。",
    points: [["本地诊断", "网络异常分类与日志分析"], ["测试边界", "将模拟响应和真实服务端结果分开"]],
    accent: "#a6def1", visual: "#32647b", glow: "#4281a0",
  },
  Firefly: {
    title: "07xh Space / Firefly", category: "WEBSITE / ENGINEERING", status: "当前网站重构中",
    summary: "承载这个个人空间的 Astro 网站工程。",
    story: "在现有 Firefly 技术基础上，逐步演进为以个人介绍和真实作品为中心的动态网站。保留博客与后台能力，重新设计双轴展示体验。",
    points: [["站点架构", "Astro 与 Cloudflare 作为现有技术底座"], ["内容体系", "博客、项目、知识专题的独立组织"]],
    accent: "#bbecd9", visual: "#375e63", glow: "#41847c",
  },
  "CloudFlare-ImgBed": {
    title: "CloudFlare-ImgBed", category: "OPEN SOURCE / FORK", status: "Fork · 开源学习实践",
    summary: "基于上游开源项目的 Cloudflare 图床与文件托管 Fork。",
    story: "该仓库来自其他开源项目，网站明确标注为 Fork 与学习实践，不将上游成果作为个人原创作品宣传。",
    points: [["开源学习", "研究 Cloudflare 文件托管方案"], ["来源说明", "保留原作者及仓库归属信息"]],
    accent: "#f1d8b1", visual: "#7a6044", glow: "#a27c45",
  },
};

const featured = ["dorm-os", "engineering-drawing-study", "StudyFlow", "MomoFlow", "wordflow", "reqable-bridge", "kingo-assistant", "zhidao-assistant"];
const app = document.getElementById("space-app");
const rail = document.getElementById("space-rail");
const counter = document.getElementById("space-current");
const total = document.getElementById("space-total");
const nameLabel = document.getElementById("scene-name");
const loading = document.getElementById("space-loading");
const modal = document.getElementById("space-index") as HTMLDialogElement | null;
const indexList = document.getElementById("index-projects");
if (!app || !rail || !counter || !total || !nameLabel || !loading || !modal || !indexList) {
  throw new Error("Space scene container is incomplete");
}

const projects: PublicProject[] = [];
let active = 0;
let slideLocked = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", value?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
}
function append(parent: HTMLElement, ...children: (HTMLElement | null)[]) {
  for (const child of children) if (child) parent.appendChild(child);
}
function link(label: string, url: string, primary = false) {
  const a = el("a", "space-button " + (primary ? "primary" : "muted"));
  a.textContent = label + " ↗";
  a.href = url;
  if (url.startsWith("https://")) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  return a;
}
function createSection(kicker: string, heading: string, text: string, extra?: HTMLElement) {
  const section = el("section", "space-section project-detail-section");
  const side = el("div", "section-kicker", kicker);
  const body = el("div", "section-main");
  append(body, el("h2", "", heading), el("p", "", text), extra ?? null);
  append(section, side, body);
  return section;
}
function paletteFor(index: number): SceneCopy {
  const colors = [
    ["#afe5e2", "#315968", "#448b8a"],
    ["#cbd9ff", "#43527e", "#5a75a9"],
    ["#e6d1fa", "#644e7c", "#8c66a1"],
    ["#f5d9af", "#7a5945", "#9e7855"],
  ];
  const p = colors[index % colors.length];
  return {
    title: "", category: "PUBLIC GITHUB REPOSITORY", status: "公开项目 · 以仓库记录为准",
    summary: "公开 GitHub 项目，详细能力与进展以仓库说明为准。",
    story: "这个公开仓库记录了具体开发实践。可以通过下方 GitHub 链接查看其 README、提交和发布记录。",
    points: [["公开仓库", "由 GitHub 公开接口实时验证可见性"], ["开发记录", "通过代码与提交历史了解项目"]],
    accent: p[0], visual: p[1], glow: p[2],
  };
}
function createScene(repo: PublicProject, idx: number) {
  const copy = copies[repo.id] ?? paletteFor(idx);
  const titleText = copy.title || repo.name;
  const scene = el("article", "space-scene project-scene");
  scene.dataset.project = repo.id;
  scene.setAttribute("aria-label", titleText + " 项目介绍");
  scene.style.setProperty("--scene-accent", copy.accent);
  scene.style.setProperty("--scene-visual", copy.visual);
  scene.style.setProperty("--scene-glow", copy.glow);

  const scroll = el("div", "space-scroll");
  const hero = el("section", "space-hero project-hero");
  const copyPanel = el("div", "hero-copy");
  const eyebrow = el("span", "hero-eyebrow project-overline", (repo.fork ? "FORK / " : "") + copy.category);
  const h = el("h1");
  const hAccent = el("em", "", titleText);
  h.appendChild(hAccent);
  const p = el("p", "hero-lead", copy.summary);
  const actions = el("div", "hero-ctas");
  const down = el("button", "space-button primary", "深入了解 ↓");
  down.type = "button";
  down.addEventListener("click", () => scroll.scrollTo({
    top: scroll.clientHeight - 70,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  }));
  append(actions, down, link("GitHub 仓库", repo.url), link("README", repo.url + "#readme"));
  const info = el("div", "project-meta");
  const infoFields = [repo.language || "语言未标注", repo.fork ? "Fork · 来源已标注" : "个人公开仓库", copy.status];
  for (const field of infoFields) append(info, el("span", "", field));
  append(copyPanel, eyebrow, h, p, actions, info);

  const visual = el("div", "project-visual" + (copy.image ? " has-photo" : ""));
  if (copy.image) {
    const image = el("img");
    image.src = copy.image;
    image.alt = titleText + " 仓库中的公开界面截图";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      visual.classList.remove("has-photo");
      image.remove();
    }, { once: true });
    visual.appendChild(image);
  }
  append(visual, el("span", "visual-wordmark", titleText));
  const visualBottom = el("div", "visual-small");
  append(visualBottom, el("span", "", "07XH / " + repo.id.toUpperCase()), el("span", "", "PUBLIC PROJECT"));
  visual.appendChild(visualBottom);
  append(hero, copyPanel, visual);

  const points = el("div", "project-points");
  copy.points.forEach(([heading, detail], index) => {
    const item = el("div", "project-point");
    append(item, el("span", "", String(index + 1).padStart(2, "0")), el("h3", "", heading), el("p", "", detail));
    points.appendChild(item);
  });
  const sectionOne = createSection("01 / BACKGROUND", "为什么做这个项目？", copy.story);
  const sectionTwo = createSection("02 / EXPLORATION", "功能与研究方向", "以下为项目主要方向与研究内容，具体交付状态以仓库 README 和测试证据为准。", points);

  const stats = el("div", "project-stats");
  const date = repo.updatedAt && !Number.isNaN(Date.parse(repo.updatedAt)) ? new Date(repo.updatedAt).toLocaleDateString("zh-CN") : "未提供";
  const values = [
    [String(repo.stars), "GitHub Stars"],
    [date, "最近代码更新"],
    [repo.language || "未标注", repo.fork ? "主要语言 · Fork" : "主要语言"],
  ];
  for (const [value, label] of values) {
    const stat = el("div");
    append(stat, el("strong", "", value), el("small", "", label));
    stats.appendChild(stat);
  }
  const last = el("div");
  append(last, stats);
  const footerActions = el("div", "home-bottom-actions");
  append(footerActions, link("查看 GitHub 源码与文档", repo.url, true));
  const next = el("button", "space-button muted", "切换到下一个项目 →");
  next.type = "button";
  next.dataset.next = "";
  footerActions.appendChild(next);
  append(last, footerActions);
  const sectionThree = createSection("03 / GITHUB", "持续更新的公开项目", repo.description || "GitHub 项目元数据来自公开接口。未公开和不可用的仓库不会进入作品展示。", last);
  const footer = el("footer", "scene-footer");
  append(footer, el("span", "", "07xh Space / " + repo.id), el("span", "", "项目内容与线上验证状态以公开证据为准"));
  append(scroll, hero, sectionOne, sectionTwo, sectionThree, footer);
  scene.appendChild(scroll);
  return scene;
}

function sceneNodes() { return Array.from(rail!.children) as HTMLElement[]; }
function navigate(index: number, updateUrl = true) {
  const nodes = sceneNodes();
  const next = Math.max(0, Math.min(index, nodes.length - 1));
  active = next;
  rail!.style.transform = "translate3d(-" + (100 * next) + "%,0,0)";
  nodes.forEach((node, i) => {
    const isCurrent = i === next;
    node.classList.toggle("is-current", isCurrent);
    node.toggleAttribute("inert", !isCurrent);
    node.setAttribute("aria-hidden", String(!isCurrent));
  });
  counter!.textContent = String(next + 1).padStart(2, "0");
  total!.textContent = String(nodes.length).padStart(2, "0");
  const project = nodes[next]?.dataset.project || "home";
  const name = next === 0 ? "07xh Space · 个人空间" : copies[project]?.title || project;
  nameLabel!.textContent = name;
  app!.querySelectorAll<HTMLButtonElement>("[data-prev]").forEach(b => { b.disabled = active === 0; });
  app!.querySelectorAll<HTMLButtonElement>("[data-next]").forEach(b => { b.disabled = active >= nodes.length - 1; });
  indexList!.querySelectorAll<HTMLButtonElement>("[data-go-project]").forEach(b => { b.setAttribute("aria-current", String(b.dataset.goProject === project)); });
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (project === "home") url.searchParams.delete("project");
    else url.searchParams.set("project", project);
    const nextUrl = url.pathname + url.search + url.hash;
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (nextUrl !== currentUrl) window.history.pushState({ project }, "", nextUrl);
  }
}
function goToId(id: string, update = true) {
  const found = sceneNodes().findIndex(node => node.dataset.project === id);
  if (found !== -1) navigate(found, update);
}

app.addEventListener("click", event => {
  const target = event.target as Element;
  if (target.closest("[data-prev]")) navigate(active - 1);
  else if (target.closest("[data-next]")) navigate(active + 1);
  else if (target.closest("[data-open-index]")) modal.showModal();
  else if (target.closest("#close-index")) modal.close();
  else if (target === modal) modal.close();
  else {
    const b = target.closest<HTMLElement>("[data-go-project]");
    if (b?.dataset.goProject) { goToId(b.dataset.goProject); modal.close(); }
  }
});

document.addEventListener("keydown", event => {
  if (modal.open || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
  if (event.key === "ArrowRight") { event.preventDefault(); navigate(active + 1); }
  if (event.key === "ArrowLeft") { event.preventDefault(); navigate(active - 1); }
});
const stage = document.getElementById("main");
let touchStart: {x:number;y:number} | null = null;
stage?.addEventListener("touchstart", e => {
  const target = e.target as Element;
  if (target.closest("a, button, input, textarea, select, [role=button]")) {
    touchStart = null;
    return;
  }
  const t = e.changedTouches[0]; if (t) touchStart = {x:t.screenX, y:t.screenY};
}, {passive:true});
stage?.addEventListener("touchend", e => {
  const t = e.changedTouches[0]; if (!t || !touchStart) return;
  const dx = t.screenX - touchStart.x;
  const dy = t.screenY - touchStart.y;
  if (Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy)*1.4) navigate(active + (dx < 0 ? 1 : -1));
  touchStart = null;
}, {passive:true});
stage?.addEventListener("touchcancel", () => { touchStart = null; }, {passive:true});
stage?.addEventListener("wheel", e => {
  if (Math.abs(e.deltaX) < 60 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)*1.3 || slideLocked) return;
  slideLocked = true;
  navigate(active + (e.deltaX > 0 ? 1 : -1));
  window.setTimeout(() => {slideLocked = false;}, 650);
}, {passive:true});

window.addEventListener("popstate", () => {
  const project = new URLSearchParams(location.search).get("project") || "home";
  goToId(project, false);
});

async function init() {
  try {
    const response = await fetch("/api/space-projects", {cache:"no-store"});
    if (!response.ok) throw new Error("GitHub public project discovery unavailable");
    const data: unknown = await response.json();
    if (typeof data !== "object" || !data || !("projects" in data) || !Array.isArray(data.projects)) throw new Error("Invalid project response");
    for (const item of data.projects) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" ||
          typeof item.url !== "string" || !/^https:\/\/github\.com\/07xh\/[A-Za-z0-9_.-]+$/.test(item.url)) continue;
      projects.push(item as PublicProject);
    }
    const weight = (id: string) => { const n=featured.indexOf(id); return n === -1 ? 100 : n; };
    projects.sort((a,b) => weight(a.id)-weight(b.id) || a.id.localeCompare(b.id,"zh-CN"));
    projects.forEach((project, i) => {
      rail!.appendChild(createScene(project,i));
      const b = el("button");
      b.type = "button";
      b.dataset.goProject = project.id;
      append(b, el("span", "", String(i+2).padStart(2,"0")), el("strong", "", copies[project.id]?.title || project.name), el("small", "", project.fork?"Fork":"GitHub"));
      indexList!.appendChild(b);
    });
    loading!.textContent = projects.length ? "" : "当前没有可展示的公开仓库。";
    const requested = new URLSearchParams(window.location.search).get("project") || "home";
    goToId(requested, false);
    if (!sceneNodes().some(n => n.dataset.project === requested)) navigate(0, false);
    else navigate(active, false);
  } catch {
    loading!.textContent = "公开项目暂时无法加载；为保护隐私，不展示未验证的缓存。";
    navigate(0, false);
  }
}
void init();
