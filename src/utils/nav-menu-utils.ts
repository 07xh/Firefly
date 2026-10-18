import { navBarConfig, siteConfig } from "@/config";
import siteSettings from "@/data/settings.json";
import type { NavBarLink } from "@/types/navBarConfig";
import { resolveNavbarLinks } from "@/utils/navbar-i18n";

/** 解析导航栏链接：按 siteConfig.pages 过滤 + i18n 名称解析。Navbar 与 NavMenuPanel 共用。 */
export function resolveNavMenuLinks(): NavBarLink[] {
	const pages = siteConfig.pages;

	function isPageEnabled(link: NavBarLink): boolean {
		if (!link.pageKey) return true;
		return pages[link.pageKey as keyof typeof pages] !== false;
	}

	function filterLinks(link: NavBarLink): NavBarLink | null {
		// 一级分组显隐：桌面导航和移动端菜单共用此过滤器。
		if (
			link.name === "社交" &&
			siteSettings.showNavSocial === false
		) {
			return null;
		}
		if (
			link.name === "我的" &&
			siteSettings.showNavMy === false
		) {
			return null;
		}
		if (
			link.name === "链接" &&
			siteSettings.showNavLinks === false
		) {
			return null;
		}
		if (
			link.name === "关于" &&
			siteSettings.showNavAbout === false
		) {
			return null;
		}

		if (!link.children) {
			if (link.name === "关于我" && siteSettings.showAbout === false) return null;
			return isPageEnabled(link) ? link : null;
		}

		const filteredChildren = link.children.filter((child) => {
			if (!isPageEnabled(child)) return false;
			if (child.name === "关于我" && siteSettings.showAbout === false) return false;
			return true;
		});

		if (filteredChildren.length === 0) return null;
		if (filteredChildren.length === 1) return filteredChildren[0];
		return { ...link, children: filteredChildren };
	}

	return resolveNavbarLinks(
		navBarConfig.links
			.map(filterLinks)
			.filter((link): link is NavBarLink => link !== null),
	);
}
