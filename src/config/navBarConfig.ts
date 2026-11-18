import {
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

// ============================================================================
// 导航栏配置 - 根据顺序动态生成导航栏链接
// NavBar Configuration - Dynamically generate navigation bar links based on order
// ============================================================================
const getDynamicNavBarConfig = (): NavBarConfig => {
	const links: NavBarLink[] = [
		LinkPresets.Home,
		{
			name: "博客",
			url: "/blog/",
			icon: "material-symbols:article",
		},
		{
			name: "项目档案",
			url: "/projects/",
			icon: "material-symbols:rocket-launch",
		},
		{
			name: "知识专题",
			url: "/series/",
			icon: "material-symbols:layers",
		},
		LinkPresets.About,
		{
			name: "更多",
			url: "#",
			icon: "material-symbols:more-horiz",
			children: [
				LinkPresets.Archive,
				LinkPresets.Categories,
				LinkPresets.Tags,
				LinkPresets.Dynamic,
				LinkPresets.Friends,
				LinkPresets.Guestbook,
				LinkPresets.Gallery,
				LinkPresets.Booknav,
				LinkPresets.Bilibili,
				LinkPresets.Bangumi,
				LinkPresets.VNDB,
				LinkPresets.MAL,
				LinkPresets.Sponsor,
			],
		},
		{
			name: "链接",
			url: "#",
			icon: "material-symbols:link",
			children: [
				{
					name: "我的 GitHub",
					url: "https://github.com/07xh",
					external: true,
					icon: "fa7-brands:github",
				},
				{
					name: "Firefly 模板源码",
					url: "https://github.com/CuteLeaf/Firefly",
					external: true,
					icon: "fa7-brands:github",
				},
				{
					name: "Firefly 文档",
					url: "https://docs-firefly.cuteleaf.cn",
					external: true,
					icon: "material-symbols:docs",
				},
			],
		},
	];

	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

// ============================================================================
// 链接预设 - 可自由自定义导航栏链接的名称、图标和URL
// Link Presets - Allows free customization of the name, icon, and URL of navigation bar links
// ============================================================================
export const LinkPresets: Record<string, NavBarLink> = {
	Home: {
		name: "个人空间",
		url: "/",
		icon: "material-symbols:home",
	},
	Archive: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	Categories: {
		name: "分类",
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	Tags: {
		name: "标签",
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	Series: {
		name: "系列",
		url: "/series/",
		icon: "material-symbols:layers",
	},
	Friends: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:link-2-rounded",
		pageKey: "friends",
	},
	Guestbook: {
		name: "留言",
		url: "/guestbook/",
		icon: "material-symbols:chat",
		pageKey: "guestbook",
	},
	Dynamic: {
		name: "动态",
		url: "/dynamic/",
		icon: "material-symbols:forum-rounded",
		pageKey: "dynamic",
	},
	Projects: {
		name: "项目档案",
		url: "/projects/",
		icon: "material-symbols:rocket-launch",
		pageKey: "projects",
	},
	Gallery: {
		name: "相册",
		url: "/gallery/",
		icon: "material-symbols:photo-library",
		pageKey: "gallery",
	},
	Booknav: {
		name: "书签导航",
		url: "/booknav/",
		icon: "material-symbols:bookmarks",
		pageKey: "booknav",
	},
	Bilibili: {
		name: "哔哩哔哩",
		url: "/bilibili/",
		icon: "fa7-brands:bilibili",
		pageKey: "bilibili",
	},
	Bangumi: {
		name: "番组计划",
		url: "/bangumi/",
		icon: "material-symbols:movie",
		pageKey: "bangumi",
	},
	VNDB: {
		name: "VNDB",
		url: "/vndb/",
		icon: "material-symbols:chrome-reader-mode-rounded",
		pageKey: "vndb",
	},
	MAL: {
		name: "AnimeList",
		url: "/myanimelist/",
		icon: "material-symbols:menu-book",
		pageKey: "mal",
	},
	Sponsor: {
		name: "打赏",
		url: "/sponsor/",
		icon: "material-symbols:favorite",
		pageKey: "sponsor",
	},
	About: {
		name: "关于我",
		url: "/about/",
		icon: "material-symbols:person",
	},
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
