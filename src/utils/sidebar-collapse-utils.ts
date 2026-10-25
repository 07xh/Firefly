/**
 * 侧栏展开/收起偏好。与主题、壁纸及后台布局配置完全独立。
 * 仅在实际点击后写入 localStorage；无法访问存储时优雅退回默认状态。
 */
export type SidebarSide = "left" | "right";
export type SidebarDisplayState = "collapsed" | "expanded";
export type SidebarCollapseState = Record<SidebarSide, SidebarDisplayState>;

const KEYS: Record<SidebarSide, string> = {
	left: "firefly:sidebar:left:v1",
	right: "firefly:sidebar:right:v1",
};
const DEFAULTS: SidebarCollapseState = { left: "collapsed", right: "expanded" };
// 存储被禁用时，当前标签页仍可在内存中保持收缩状态。
const transient: Partial<SidebarCollapseState> = {};

export function getSidebarCollapseState(): SidebarCollapseState {
	const read = (side: SidebarSide): SidebarDisplayState => {
		const cached = transient[side];
		if (cached) return cached;
		try {
			const value = localStorage.getItem(KEYS[side]);
			return value === "collapsed" || value === "expanded"
				? value
				: DEFAULTS[side];
		} catch {
			return DEFAULTS[side];
		}
	};
	return { left: read("left"), right: read("right") };
}

export function syncSidebarToggleButtons(state: SidebarCollapseState): void {
	document
		.querySelectorAll<HTMLButtonElement>("[data-sidebar-toggle]")
		.forEach((button) => {
			const side = button.dataset.sidebarToggle;
			if (side !== "left" && side !== "right") return;
			const expanded = state[side] === "expanded";
			const label = `${expanded ? "收起" : "展开"}${side === "left" ? "左" : "右"}侧栏`;
			button.setAttribute("aria-label", label);
			button.setAttribute("title", label);
			button.setAttribute("aria-expanded", String(expanded));
		});
}

let isBound = false;

/** 事件委托：左右独立、跨 Swup 页面复用、其它标签页同步。 */
export function initSidebarCollapse(onChange: () => void): void {
	if (isBound) return;
	isBound = true;
	document.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const button = target.closest<HTMLButtonElement>("[data-sidebar-toggle]");
		const side = button?.dataset.sidebarToggle;
		if (side !== "left" && side !== "right") return;
		const current = getSidebarCollapseState();
		const next = current[side] === "expanded" ? "collapsed" : "expanded";
		transient[side] = next;
		try {
			localStorage.setItem(KEYS[side], next);
		} catch {
			// 存储受限时仍可切换；只是不保证下次访问保留。
		}
		onChange();
	});
	window.addEventListener("storage", (event) => {
		if (event.key === null || Object.values(KEYS).includes(event.key)) {
			// 其它标签页是最新来源，不能让当前标签页内存覆盖它。
			delete transient.left;
			delete transient.right;
			onChange();
		}
	});
}
