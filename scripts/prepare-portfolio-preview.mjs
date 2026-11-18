import { readFileSync, writeFileSync } from "node:fs";

const configPath = "dist/server/wrangler.json";
const generated = JSON.parse(readFileSync(configPath, "utf8"));
if (generated.main !== "entry.mjs" || generated.assets?.directory !== "../client") {
	throw new Error("Unexpected Astro Worker output");
}

writeFileSync("dist/server/portfolio-preview.mjs", `import app from "./entry.mjs";

const publicApi = new Set([
	"/api/portfolio/repositories.json",
	"/api/dynamic.json",
	"/api/allpostmeta.json",
]);

export default {
	async fetch(request, env, context) {
		const headers = { "X-Robots-Tag": "noindex, nofollow" };
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
		}
		let path;
		try {
			path = decodeURIComponent(new URL(request.url).pathname).toLowerCase().replace(/\\/+$/, "");
		} catch {
			return new Response(null, { status: 400, headers });
		}
		if (path.includes("%") || path.includes("//") || path.includes("/../") || path.includes("/./") ||
			/^\\/(?:admin|manage)(?:\\/|$)/.test(path) ||
			(/^\\/api(?:\\/|$)/.test(path) && !publicApi.has(path))) {
			return new Response(null, { status: 404, headers });
		}
		const result = await app.fetch(request, env, context);
		const response = new Response(result.body, result);
		response.headers.set("X-Robots-Tag", headers["X-Robots-Tag"]);
		return response;
	},
};
`);

writeFileSync("dist/server/wrangler.portfolio-preview.json", JSON.stringify({
	name: "firefly-pr-123",
	main: "portfolio-preview.mjs",
	workers_dev: true,
	preview_urls: false,
	compatibility_date: generated.compatibility_date,
	compatibility_flags: generated.compatibility_flags,
	assets: { directory: "../client", binding: "ASSETS", run_worker_first: true },
	rules: generated.rules,
	images: generated.images,
	no_bundle: true,
}, null, 2) + "\n");
