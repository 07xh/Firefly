import siteSettings from "../data/settings.json";
import type { ProfileConfig } from "../types/profileConfig";

const profileLinks: ProfileConfig["links"] = [
	...(siteSettings.showGithub
		? [
				{
					name: "GitHub",
					icon: "fa7-brands:github",
					url: siteSettings.githubUrl.trim() || "https://github.com/CuteLeaf",
					showName: false,
				},
			]
		: []),
	...(siteSettings.showEmail
		? [
				{
					name: "Email",
					icon: "fa7-solid:envelope",
					url: siteSettings.email.trim()
						? `mailto:${siteSettings.email.trim()}`
						: "mailto:xiaye@msn.com",
					showName: false,
				},
			]
		: []),
	{
		name: "RSS",
		icon: "fa7-solid:rss",
		url: "/rss/",
		showName: false,
	},
	{
		name: "Atom",
		icon: "fa7-solid:atom",
		url: "/atom/",
		showName: false,
	},
];

export const profileConfig: ProfileConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/" 开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	avatar: siteSettings.avatar.trim() || "assets/images/avatar.avif",

	// 名字
	name: siteSettings.nickname.trim() || "XiaYe",

	// 个人签名
	bio: siteSettings.bio,

	// GitHub、邮箱的地址和显隐由后台设置控制；RSS / Atom 保留主题默认入口。
	links: profileLinks,
};
