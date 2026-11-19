import siteSettings from "../data/settings.json";
import type { ProfileConfig } from "../types/profileConfig";

const githubUrl = siteSettings.githubUrl.trim() || "https://github.com/07xh";
const email = siteSettings.email.trim();

const profileLinks: ProfileConfig["links"] = [
	...(siteSettings.showGithub
		? [
				{
					name: "GitHub",
					icon: "fa7-brands:github",
					url: githubUrl,
					showName: false,
				},
			]
		: []),
	...(siteSettings.showEmail && email
		? [
				{
					name: "Email",
					icon: "fa7-solid:envelope",
					url: `mailto:${email}`,
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
	// Use this site's identity when optional editor settings are blank.
	// Never fall back to the template author's name, address or portrait.
	avatar: siteSettings.avatar.trim() || "/brand/07xh-mark.svg",
	name: siteSettings.nickname.trim() || "07xh",
	bio: siteSettings.bio,
	links: profileLinks,
};
