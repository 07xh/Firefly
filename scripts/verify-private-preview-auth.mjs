/**
 * Read-only, anonymous preview Worker smoke checks.
 * No login, cookies, secrets, private article content, or write requests.
 * NEVER run against production or an arbitrary URL.
 */
export function requirePreviewOrigin(value) {
	if (typeof value !== "string") throw new Error("Preview URL is required.");
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("Preview URL is invalid.");
	}
	const host = url.hostname.toLowerCase();
	const isCloudflare = host.endsWith(".workers.dev") || host.endsWith(".pages.dev");
	const isNamedPreview = /(?:^|[-.])(preview|staging|stage|pr-[0-9]+)(?:[-.]|$)/i.test(host);
	if (
		url.protocol !== "https:" ||
		!isCloudflare ||
		!isNamedPreview ||
		url.port ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash ||
		host === "firefly.3267597860.workers.dev" ||
		host === "0701000.xyz"
	) {
		throw new Error("Only a clearly named, HTTPS Cloudflare preview/staging host is permitted.");
	}
	return url.origin;
}

function ensure(condition, path, expected, actual) {
	if (!condition) {
		throw new Error(path + ": expected " + expected + ", observed " + actual);
	}
}

async function readOnlyFetch(fetcher, url, path) {
	const response = await fetcher(url + path, {
		method: "GET",
		credentials: "omit",
		redirect: "manual",
		cache: "no-store",
		headers: { "Accept": "application/json, text/html" },
		signal: AbortSignal.timeout(12000),
	});
	return response;
}

const ADMIN_PAGES = ["/admin/", "/admin/system/"];
const PROTECTED_APIS = [
	"/api/admin/articles/",
	"/api/admin/ai-providers/",
	"/api/admin/system-health/",
	"/api/admin/private-drafts/",
	"/api/admin/private-draft-history/?slug=preview-auth-check",
	"/api/admin/private-draft-backups/?slug=preview-auth-check",
	"/api/admin/private-draft-audit/?slug=preview-auth-check",
];

export async function verifyAnonymousPreview(previewUrl, fetcher = fetch) {
	const origin = requirePreviewOrigin(previewUrl);
	const checks = [];

	const login = await readOnlyFetch(fetcher, origin, "/admin/login/");
	ensure(login.status === 200, "/admin/login/", "200", login.status);
	ensure((login.headers.get("content-type") || "").includes("text/html"),
		"/admin/login/", "HTML content type", "not HTML");
	const loginText = await login.text();
	ensure(loginText.includes('id="loginForm"'), "/admin/login/", "login form", "missing");
	checks.push("Anonymous login page is available.");

	for (const path of ADMIN_PAGES) {
		const response = await readOnlyFetch(fetcher, origin, path);
		const location = response.headers.get("location") || "";
		ensure(response.status === 302, path, "302 redirect", response.status);
		ensure(location.includes("/admin/login/"), path, "login redirect", "different destination");
		ensure((response.headers.get("cache-control") || "").includes("no-store"),
			path, "no-store response", "missing cache control");
		checks.push(path + ": anonymous access denied.");
	}

	for (const path of PROTECTED_APIS) {
		const response = await readOnlyFetch(fetcher, origin, path);
		// Do not consume or display the response body on unexpected success.
		ensure(response.status === 401, path, "401", response.status);
		ensure((response.headers.get("content-type") || "").includes("application/json"),
			path, "JSON", "different content type");
		ensure((response.headers.get("cache-control") || "").includes("no-store"),
			path, "no-store", "missing cache control");
		checks.push(path.split("?")[0] + ": anonymous access denied.");
	}
	return { ok: true, count: checks.length, checks };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
	const previewUrl = process.env.FIREFLY_PREVIEW_URL;
	try {
		const report = await verifyAnonymousPreview(previewUrl);
		for (const check of report.checks) console.log("PASS: " + check);
		console.log("PASS: " + report.count + " anonymous read-only preview checks.");
	} catch (error) {
		console.error("FAIL: " + (error instanceof Error ? error.message : String(error)));
		process.exitCode = 1;
	}
}
