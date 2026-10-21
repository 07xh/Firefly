import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION = ".github/workflows/deploy-cloudflare.yml";
export const LEGACY_WORKER = ".github/workflows/deploy-worker.yml";
export const MANUAL_PAGES = ".github/workflows/deploy.yml";
export const DISABLED_PAGES = [
	".github/workflows/static.yml",
	".github/workflows/jekyll-gh-pages.yml",
];
export const SCHEDULED = ".github/workflows/publish-scheduled-posts.yml";
export const REQUIRED = [PRODUCTION, LEGACY_WORKER, MANUAL_PAGES, ...DISABLED_PAGES, SCHEDULED];

/**
 * Inspect the top-level "on" stanza, not a string or comment mentioning "push".
 * This intentionally recognizes the repository's fixed workflow layout; changing
 * that layout without updating tests MUST fail closed.
 */
export function onSection(source) {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const index = lines.findIndex((line) => line === "on:");
	if (index === -1) return "";
	let end = index + 1;
	while (
		end < lines.length &&
		(lines[end] === "" || /^\s/.test(lines[end]) || lines[end].startsWith("#"))
	) {
		end++;
	}
	return lines.slice(index + 1, end).join("\n");
}

export function eventEnabled(source, eventName) {
	const block = onSection(source);
	return new RegExp("^  " + eventName + ":", "m").test(block);
}

function isOptIn(source, name) {
	return source.includes("if: " + "$" + "{{ vars." + name + " == 'true' }}");
}

export function deploymentPolicyViolations(files) {
	const failures = [];
	for (const file of REQUIRED) {
		if (typeof files[file] !== "string")
			failures.push(file + ": missing workflow file");
	}
	if (failures.length) return failures;

	const primary = files[PRODUCTION];
	if (eventEnabled(primary, "push") || eventEnabled(primary, "schedule"))
		failures.push("Canonical Cloudflare deployment must not run automatically on master or on a schedule.");
	if (!eventEnabled(primary, "workflow_dispatch"))
		failures.push("Canonical Cloudflare deployment requires manual dispatch.");
	if (!primary.includes("inputs.release_confirmation == 'DEPLOY_VERIFIED'") ||
		!primary.includes("vars.FIREFLY_RELEASE_READY == 'true'")) {
		failures.push("Cloudflare production deployment requires a separate manual approval and repository release gate.");
	}
	if (!/\bgroup:\s*cloudflare-workers\b/.test(primary) || !/cancel-in-progress:\s*false/.test(primary))
		failures.push("Canonical Cloudflare workflow must serialize deployments without cancelling in-flight runs.");
	if (!primary.includes("wrangler deploy"))
		failures.push("Canonical deployment command is missing; audit workflow before release.");

	const oldWorker = files[LEGACY_WORKER];
	if (eventEnabled(oldWorker, "push") || eventEnabled(oldWorker, "schedule"))
		failures.push("Legacy Worker deployment must not run automatically.");
	if (!eventEnabled(oldWorker, "workflow_dispatch") || !isOptIn(oldWorker, "ENABLE_LEGACY_WORKER_DEPLOY"))
		failures.push("Legacy Worker requires an explicit disabled-by-default manual opt-in.");
	if (!/\bgroup:\s*cloudflare-workers\b/.test(oldWorker) || !/cancel-in-progress:\s*false/.test(oldWorker))
		failures.push("Both Worker deployment workflows must share a serial concurrency group.");

	const pages = files[MANUAL_PAGES];
	if (
		eventEnabled(pages, "push") ||
		!eventEnabled(pages, "workflow_dispatch") ||
		eventEnabled(pages, "schedule") ||
		!pages.includes("vars.FIREFLY_RELEASE_READY == 'true'")
	) {
		failures.push("Canonical GitHub Pages workflow must require the manual release gate with no master push trigger.");
	}
	if (!pages.includes("path: dist") || !pages.includes("rm -rf dist/admin"))
		failures.push("GitHub Pages must build dist and exclude private admin pages.");

	for (const file of DISABLED_PAGES) {
		const source = files[file];
		if (eventEnabled(source, "push") || eventEnabled(source, "schedule"))
			failures.push(file + ": obsolete Pages publishing must not run on master or on a schedule.");
		if (!eventEnabled(source, "workflow_dispatch") || !source.includes("if: " + "$" + "{{ false }}"))
			failures.push(file + ": legacy workflow must remain inert.");
		if (/upload-pages-artifact|actions\/deploy-pages|wrangler deploy/.test(source))
			failures.push(file + ": inactive template must contain no deploy/upload action.");
	}

	const scheduled = files[SCHEDULED];
	if (!eventEnabled(scheduled, "schedule"))
		failures.push("Scheduled publishing must retain its scheduled trigger.");
	if (!scheduled.includes("actions/workflows/deploy-cloudflare.yml/dispatches"))
		failures.push("Scheduled publishing must target the canonical Cloudflare workflow.");
	// Existing scheduled publishing may still dispatch the deployment workflow,
	// but must be unable to satisfy its separate approval input by default.
	if (!primary.includes("inputs.release_confirmation == 'DEPLOY_VERIFIED'"))
		failures.push("Scheduled publishing cannot bypass the production release confirmation.");
	return failures;
}

export function readWorkflows(root = process.cwd()) {
	return Object.fromEntries(
		REQUIRED.map((file) => [file, readFileSync(resolve(root, file), "utf8")]),
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		const violations = deploymentPolicyViolations(readWorkflows());
		if (violations.length) {
			for (const item of violations) console.error("FAIL: " + item);
			process.exitCode = 1;
		} else {
			console.log("PASS: Cloudflare and Pages are manual release-gated; legacy deployments remain disabled.");
		}
	} catch (error) {
		console.error("FAIL: unable to audit deployment workflows:", error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
