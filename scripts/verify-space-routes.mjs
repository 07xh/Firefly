import { setTimeout as delay } from "node:timers/promises";

const rawBase = process.argv[2];
if (!rawBase) {
	throw new Error("Usage: node scripts/verify-space-routes.mjs https://site.example");
}
const base = new URL(rawBase);
if (!["https:", "http:"].includes(base.protocol)) {
	throw new Error("Expected an HTTP(S) website URL");
}

const checks = [
	{
		path: "/",
		name: "first visit shows 校序",
		title: "校序",
		markers: ["space-project-hero", 'id="project-title"', 'id="project-details"', "data-next", "data-previous"],
		forbidden: ["portfolio-project-grid"],
	},
	{
		path: "/projects/",
		name: "Projects entry shows 校序, not the project directory",
		title: "校序",
		markers: ["space-project-hero", 'id="project-details"', "data-next"],
		forbidden: ["portfolio-project-grid"],
	},
	{
		path: "/projects/dorm-os/",
		name: "校序 deep link remains available",
		title: "校序",
		markers: ["space-project-hero", 'id="project-details"', "data-next"],
		forbidden: ["portfolio-project-grid"],
	},
	{
		path: "/projects/studyflow/",
		name: "next project keeps independent showcase and details",
		title: "学序",
		markers: ["space-project-hero", 'id="project-details"', "data-next"],
		forbidden: ["portfolio-project-grid"],
	},
	{
		path: "/projects/all/",
		name: "project directory is only available from the explicit route",
		title: "全部项目",
		markers: ["portfolio-project-grid", "portfolio-project-filters"],
		forbidden: ["space-project-hero"],
	},
];

const revision = (process.env.GITHUB_SHA || "manual").slice(0, 12);

async function inspect(check, attempt) {
	const target = new URL(check.path, base);
	target.searchParams.set("space_verify", revision + "-" + attempt);
	const response = await fetch(target, {
		redirect: "follow",
		headers: {
			Accept: "text/html",
			"Cache-Control": "no-cache",
		},
		signal: AbortSignal.timeout(12000),
	});
	const contentType = response.headers.get("content-type") || "";
	if (response.status !== 200 || !contentType.includes("text/html")) {
		throw new Error(`HTTP ${response.status} (${contentType})`);
	}
	const html = await response.text();
	const title = new RegExp(`<h1\\b[^>]*>\\s*${check.title}\\s*</h1>`, "i");
	if (!title.test(html)) {
		throw new Error(`expected h1 ${check.title}; received a different page`);
	}
	for (const marker of check.markers) {
		if (!html.includes(marker)) throw new Error(`missing ${marker}`);
	}
	for (const marker of check.forbidden) {
		if (html.includes(marker)) throw new Error(`unexpected ${marker}`);
	}
	return check.path;
}

let failures = 0;
for (const check of checks) {
	let error;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const path = await inspect(check, attempt);
			console.log(`PASS ${path}: ${check.name}`);
			error = undefined;
			break;
		} catch (cause) {
			error = cause;
			if (attempt < 3) await delay(1300);
		}
	}
	if (error) {
		failures++;
		console.error(`FAIL ${check.path}: ${check.name}: ${error.message}`);
	}
}
if (failures) {
	throw new Error(`${failures} of ${checks.length} 07xh Space route checks failed on ${base.origin}`);
}
console.log(`PASS: all ${checks.length} public project routes verified on ${base.origin}`);
