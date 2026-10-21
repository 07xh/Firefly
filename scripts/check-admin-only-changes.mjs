import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Conservative, file-level freeze for the visitor-facing Firefly site.
 * Only admin-focused pull requests are subject to this repository policy.
 * This complements, but does not replace, screenshot and route regression tests.
 */
export function isAdminFocusedBranch(name) {
	return /^(?:feat\/(?:private-draft|admin-system-health|cloudflare-imgbed-admin)|fix\/(?:admin-data-safety|imgbed)|ci\/admin-only-frontend-freeze|docs\/admin-implementation)/.test(name);
}

export function changesVisitorFrontend(path) {
	const normalized = String(path).replaceAll("\\", "/");
	if (
		normalized.startsWith("src/components/") ||
		normalized.startsWith("src/layouts/") ||
		normalized.startsWith("src/styles/") ||
		normalized.startsWith("src/assets/") ||
		normalized.startsWith("src/content/") ||
		normalized.startsWith("src/i18n/") ||
		normalized.startsWith("src/data/settings.json") ||
		normalized.startsWith("src/config/")
	) return true;
	if (normalized.startsWith("src/pages/")) {
		return !(
			normalized.startsWith("src/pages/admin/") ||
			normalized.startsWith("src/pages/api/admin/") ||
			normalized.startsWith("src/pages/api/auth/")
		);
	}
	if (normalized.startsWith("public/")) {
		return !/^public\/admin(?:[-/]|$)/.test(normalized);
	}
	if (
		/^(?:astro\.config\.|tailwind\.config\.|postcss\.config\.|package\.json$|pnpm-lock\.yaml$|vite\.config\.)/.test(normalized)
	) return true;
	return false;
}

export function forbiddenVisitorChanges(paths) {
	return paths.filter(changesVisitorFrontend);
}

export function validateAdminOnlyChanges(paths) {
	const forbidden = forbiddenVisitorChanges(paths);
	if (forbidden.length) {
		throw new Error(
			"后台专属 PR 不允许修改前台文件。请分离或撤销以下改动：\n" +
				forbidden.join("\n"),
		);
	}
	return paths.length;
}

function main() {
	if (process.env.GITHUB_EVENT_NAME !== "pull_request") {
		console.log("Skipping visitor UI freeze: not a pull request.");
		return;
	}
	const head = process.env.GITHUB_HEAD_REF || "";
	if (!isAdminFocusedBranch(head)) {
		console.log("Skipping admin-only visitor UI freeze for a non-admin branch.");
		return;
	}
	const base = process.env.GITHUB_BASE_REF || "master";
	if (!/^[\w./-]+$/.test(base)) throw new Error("PR base branch is invalid.");
	const output = execFileSync(
		"git",
		["diff", "--name-only", "--diff-filter=ACMR", "origin/" + base + "...HEAD"],
		{ encoding: "utf8" },
	);
	const paths = output.split(/\r?\n/).filter(Boolean);
	validateAdminOnlyChanges(paths);
	console.log("PASS: " + paths.length + " modified files; no visitor-facing Firefly UI files.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
