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
    title: "校序", category: "ACADEMIC OS · ANDROID / WEB",
    summary: "围绕个人校园学习、课程、任务与信息整合的应用项目。",
    story: "把分散的校园学习信息整理成清晰可用的个人工作流。原生 Android 是当前主要方向，Web 承担辅助与服务端能力；学校平台的真实数据对接需要逐项验收。",
    points: [["校园学习", "课表、任务与校园信息的统一组织"], ["跨平台架构", "Android 界面与 Cloudflare 服务端协作"], ["数据连接", "学习通、教务和第二课堂接入持续验证"], ["验证优先", "真实账号、实际设备与服务端状态分别验收"]],
    accent: "#a5eee0", visual: "#275e59", glow: "#367a6d",
    image: "https://raw.githubusercontent.com/07xh/dorm-os/main/apps/xiaoxu-android/docs/ui-verify/268/home-393dp-imported.webp",
  },
  "engineering-drawing-study": {
    title: "绘序 · DraftAI", category: "ENGINEERING / GEOMETRY",
    summary: "面向工程制图学习的几何推理与动态逐笔作图研究。",
    story: "重点研究图形条件确认、几何约束求解、投影对应以及从数学结果生成逐笔作图步骤。复杂题型的能力必须依据可复核的数学和真题证据确认。",
    points: [["几何求解", "从已确认条件构建可验证的几何结果"], ["投影关联", "理解二维投影与三维结构的对应关系"], ["逐笔作图", "研究具有依赖关系的动态作图步骤"], ["学习导向", "提供可解释、可检查的作图过程"]],
    accent: "#bfd7ff", visual: "#344c81", glow: "#455dab",
  },
  StudyFlow: {
    title: "学序 · StudyFlow", category: "WINDOWS / LEARNING",
    summary: "多个学习平台共用统一 UI 和桌面应用基础架构。",
    story: "将知到、雨课堂等不同平台的真实业务模块统一在桌面软件中，保留原模块边界，区分本地播放或执行状态与平台服务端确认的状态。",
    points: [["统一界面", "紧凑导航与平台无关的公共组件"], ["桌面构建", "React、Tauri 与 Python sidecar 协同"], ["平台适配", "不同学习平台保留各自连接和功能"], ["可核验进度", "将本地事件与服务器状态明确区分"]],
    accent: "#e0caff", visual: "#534272", glow: "#73569a",
  },
  MomoFlow: {
    title: "MomoFlow", category: "ANDROID / LEARNING",
    summary: "围绕背单词体验、通知与前台反馈展开的 Android 个人工具。",
    story: "关注通知交互、今日学习内容读取、离线释义，以及用户明确触发的前台反馈流程。尚未完成的私有接口写回不作为正式能力宣传。",
    points: [["Android 体验", "围绕学习通知和交互展开设计"], ["单词信息", "研究今日词表与离线释义显示"], ["前台反馈", "区分系统点击和官方记录核验"], ["实际边界", "未经真机确认的效果不标记为已实现"]],
    accent: "#f5d8a8", visual: "#7f563e", glow: "#9c6946",
  },
  wordflow: {
    title: "WordFlow", category: "DOCUMENTS / TOOLS",
    summary: "个人文档处理工具的开发与实践。",
    story: "关注常见文档任务的组织、处理与工具化。具体功能和可用版本以仓库公开内容为准。",
    points: [["工具导向", "围绕实际文档处理需求设计"], ["个人项目", "记录功能取舍与实现过程"]],
    accent: "#c2e2ff", visual: "#335e7a", glow: "#456c8d",
  },
  "reqable-bridge": {
    title: "Reqable Bridge", category: "NETWORK / DEVELOPMENT",
    summary: "跨设备查看与管理网络调试数据的个人工具。",
    story: "探索电脑端网络调试与其他设备之间的数据传递、会话查看和记录导出。真实抓包和操作权限应由使用者自行控制。",
    points: [["网络诊断", "面向个人的请求与响应数据查看"], ["跨设备", "研究 Windows 与移动端之间的调试工作流"], ["数据管理", "关注记录导出与会话状态"]],
    accent: "#b0e6e3", visual: "#265a69", glow: "#357b87",
  },
  "kingo-assistant": {
    title: "KingoAssistant", category: "EDUCATION / WINDOWS",
    summary: "青果教务选课辅助与客户端研究。",
    story: "研究真实教务流程、会话管理、查询与状态核验。未验证的线上提交能力不作为已经交付的功能展示。",
    points: [["平台研究", "整理青果教务的客户端接入问题"], ["状态核验", "区分操作提交和服务端最终结果"], ["可靠性", "关注超时、重试与异常信息"]],
    accent: "#e9d29e", visual: "#6a5d37", glow: "#9a8540",
  },
  "zhidao-assistant": {
    title: "知到助手", category: "WINDOWS / LEARNING",
    summary: "知到学习场景下的桌面端个人工具。",
    story: "作为学序整合前的独立项目，保留原有业务模块和研究历史。当前平台真实读取与进度验证需按实际证据判断。",
    points: [["桌面实践", "围绕 Windows 客户端开发和打包"], ["平台接口", "研究登录、课程与任务数据读取"], ["集成关系", "与学序项目存在技术沿革"]],
    accent: "#bce5c3", visual: "#356653", glow: "#42846b",
  },
  "campus-toolkit": {
    title: "Campus Toolkit", category: "CAMPUS / TOOLKIT",
    summary: "校园数据读取、协议诊断和个人工具链实践。",
    story: "围绕校园服务的只读数据同步、协议适配和可视化诊断展开。只展示允许公开的工具说明和通用技术内容。",
    points: [["工具链", "组织校园数据同步的独立工具"], ["协议研究", "整理读取与诊断方法"], ["安全边界", "不公开个人账号或认证材料"]],
    accent: "#b6e1d2", visual: "#366b67", glow: "#3e887c",
  },
  "kingo-live": {
    title: "Kingo Live", category: "EXPERIMENT / RESEARCH",
    summary: "教务协议客户端及网络延迟研究。",
    story: "将网络流程研究和离线延迟模拟分开记录，公开页面只提供非敏感的项目概览，不暴露任何认证样本、账号或会话数据。",
    points: [["协议实践", "实验性 HTTP 客户端研究"], ["离线分析", "不同延迟与运行条件的模拟"], ["研究记录", "保留可核验的技术结论"]],
    accent: "#dfc3fa", visual: "#554773", glow: "#745c8f",
  },
  "ncwu-qiangke": {
    title: "NCWU 选课研究", category: "EXPERIMENT / CAMPUS",
    summary: "围绕高校教务系统展开的协议与流程研究。",
    story: "记录公开允许的技术研究、功能边界与实验结论。项目展示不包含个人账号数据，也不暗示未经验证的线上效果。",
    points: [["流程研究", "梳理教务平台的公开工作流程"], ["调试实践", "实验客户端与错误诊断"], ["研究边界", "不展示敏感请求或凭证"]],
    accent: "#eac49f", visual: "#685541", glow: "#8b6849",
  },
  "yuketang-heartbeat": {
    title: "雨课堂通信诊断", category: "EXPERIMENT / NETWORK",
    summary: "个人网络通信稳定性与日志诊断实验。",
    story: "用于分析本地通信异常和响应处理；离线测试结果不等于平台服务器确认，不宣传未验证的课程进度。",
    points: [["本地诊断", "网络异常分类与日志分析"], ["测试边界", "将模拟响应和真实服务端结果分开"]],
    accent: "#a6def1", visual: "#32647b", glow: "#4281a0",
  },
  Firefly: {
    title: "07xh Space / Firefly", category: "WEBSITE / ENGINEERING",
    summary: "承载这个个人空间的 Astro 网站工程。",
    story: "在现有 Firefly 技术基础上，逐步演进为以个人介绍和真实作品为中心的动态网站。保留博客与后台能力，重新设计双轴展示体验。",
    points: [["站点架构", "Astro 与 Cloudflare 作为现有技术底座"], ["内容体系", "博客、项目、知识专题的独立组织"]],
    accent: "#bbecd9", visual: "#375e63", glow: "#41847c",
  },
  "CloudFlare-ImgBed": {
    title: "CloudFlare-ImgBed", category: "OPEN SOURCE / FORK",
    summary: "公开 Fork 的 Cloudflare 图床与文件托管项目。",
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
    title: "", category: "PUBLIC GITHUB REPOSITORY",
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
  down.addEventListener("click", () => scroll.scrollTo({top: scroll.clientHeight - 70, behavior: "smooth"}));
  append(actions, down, link("GitHub 仓库", repo.url));
  const info = el("div", "project-meta");
  const infoFields = [repo.language || "公开项目", repo.fork ? "Fork · 开源实践" : "个人公开仓库", "GitHub 实时验证"];
  for (const field of infoFields) append(info, el("span", "", field));
  append(copyPanel, eyebrow, h, p, actions, info);

  const visual = el("div", "project-visual" + (copy.image ? " has-photo" : ""));
  if (copy.image) {
    const image = el("img");
    image.src = copy.image;
    image.alt = titleText + " 仓库中的公开界面截图";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
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
    [repo.language || "—", "主要语言"],
    [date, "最近代码更新"],
    [repo.fork ? "Fork" : "Original", "仓库类型"],
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
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
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
  const t = e.changedTouches[0]; if (t) touchStart = {x:t.screenX, y:t.screenY};
}, {passive:true});
stage?.addEventListener("touchend", e => {
  const t = e.changedTouches[0]; if (!t || !touchStart) return;
  const dx = t.screenX - touchStart.x;
  const dy = t.screenY - touchStart.y;
  if (Math.abs(dx) >= 70 && Math.abs(dx) > Math.abs(dy)*1.4) navigate(active + (dx < 0 ? 1 : -1));
  touchStart = null;
}, {passive:true});
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
