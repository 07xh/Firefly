import type { APIRoute } from "astro";

export const prerender = false;

const owner = "07xh";
const pageSize = 100;
const cacheDuration = 300_000;

interface GithubRepository {
	name?: string;
	owner?: { login?: string };
	private?: boolean;
	visibility?: string;
	description?: string | null;
	language?: string | null;
	stargazers_count?: number;
	pushed_at?: string | null;
	archived?: boolean;
}

async function loadRepositories() {
	const repositories = [];
	for (let page = 1; ; page++) {
		const response = await fetch(
			`https://api.github.com/users/${owner}/repos?type=owner&sort=full_name&per_page=${pageSize}&page=${page}`,
			{
				headers: {
					Accept: "application/vnd.github+json",
					"User-Agent": "07xh-portfolio",
				},
				signal: AbortSignal.timeout(10000),
			},
		);
		if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
		const items: GithubRepository[] = await response.json();
		if (!Array.isArray(items)) throw new Error("Invalid repository list");
		for (const item of items) {
			if (
				item.private !== false ||
				item.visibility !== "public" ||
				item.owner?.login?.toLowerCase() !== owner ||
				!item.name ||
				!/^[\w.-]+$/.test(item.name)
			)
				continue;
			repositories.push({
				name: item.name,
				description: item.description ?? null,
				language: item.language ?? null,
				stars: item.stargazers_count ?? 0,
				pushedAt: item.pushed_at ?? null,
				archived: item.archived === true,
			});
		}
		if (!response.headers.get("Link")?.includes('rel="next"')) break;
	}
	return { repositories, checkedAt: new Date().toISOString() };
}

let cached: Awaited<ReturnType<typeof loadRepositories>> | undefined;
let expires = 0;
let pending: ReturnType<typeof loadRepositories> | undefined;

export const GET: APIRoute = async () => {
	try {
		if (!cached || expires <= Date.now()) {
			pending ??= loadRepositories();
			try {
				cached = await pending;
				expires = Date.now() + cacheDuration;
			} finally {
				pending = undefined;
			}
		}
		return Response.json(cached, {
			headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
		});
	} catch {
		return Response.json(
			{ error: "GitHub 暂时不可用" },
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		);
	}
};
