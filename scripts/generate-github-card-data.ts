import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";
import matter from "gray-matter";
import { isValidGithubRepository } from "../src/utils/github-card-utils";

const OUTPUT_FILE = "src/constants/github-card-data.json";
const CONTENT_GLOB = "src/content/**/*.{md,mdx}";
const GITHUB_DIRECTIVE_PATTERN =
	/::github\s*\{[^}]*\brepo\s*=\s*["']([^"']+)["'][^}]*\}/g;

interface GithubCardData {
	description: string | null;
	language: string | null;
	avatarUrl: string | null;
	license: string | null;
	stars?: number;
	pushedAt?: string;
	checkedAt?: string;
	release?: { tag: string; url: string; prerelease: boolean } | null;
}

type GithubCardCache = Record<string, GithubCardData>;

async function readCache(): Promise<GithubCardCache> {
	try {
		return JSON.parse(await fs.readFile(OUTPUT_FILE, "utf-8"));
	} catch {
		return {};
	}
}

async function findRepositories(): Promise<
	Map<string, { repo: string; project: boolean }>
> {
	const repositories = new Map<string, { repo: string; project: boolean }>();
	const contentFiles = await glob(CONTENT_GLOB);

	for (const file of contentFiles) {
		const content = await fs.readFile(file, "utf-8");
		for (const match of content.matchAll(GITHUB_DIRECTIVE_PATTERN)) {
			const repo = match[1];
			if (isValidGithubRepository(repo)) {
				const key = repo.toLowerCase();
				if (!repositories.has(key))
					repositories.set(key, { repo, project: false });
			}
		}
		if (file.replaceAll("\\", "/").startsWith("src/content/projects/")) {
			const { repository } = matter(content).data;
			if (
				typeof repository === "string" &&
				isValidGithubRepository(repository)
			) {
				repositories.set(repository.toLowerCase(), {
					repo: repository,
					project: true,
				});
			}
		}
	}

	return repositories;
}

async function fetchRepositoryData(
	repo: string,
	project: boolean,
	cached?: GithubCardData,
): Promise<GithubCardData> {
	const [owner, name] = repo.split("/");
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const token = process.env.GITHUB_TOKEN?.trim();
	if (token) headers.Authorization = `Bearer ${token}`;

	const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
	const request = (suffix = "") =>
		fetch(endpoint + suffix, { headers, signal: AbortSignal.timeout(12000) });
	const response = await request();
	if (!response.ok) {
		throw new Error(
			`GitHub API returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
		);
	}

	const data = await response.json();
	const result: GithubCardData = {
		description:
			typeof data.description === "string"
				? data.description.replace(/:[a-zA-Z0-9_]+:/g, "")
				: null,
		language: typeof data.language === "string" ? data.language : null,
		avatarUrl:
			typeof data.owner?.avatar_url === "string" ? data.owner.avatar_url : null,
		license:
			typeof data.license?.spdx_id === "string" ? data.license.spdx_id : null,
	};
	if (!project) return result;

	result.stars =
		typeof data.stargazers_count === "number"
			? data.stargazers_count
			: undefined;
	result.pushedAt =
		typeof data.pushed_at === "string" ? data.pushed_at : undefined;
	result.checkedAt = new Date().toISOString();
	result.release = cached?.release;
	try {
		const releases = await request("/releases?per_page=5");
		if (!releases.ok) throw new Error(`GitHub API returned ${releases.status}`);
		const items = await releases.json();
		const latest = items.find((item: { draft: boolean }) => !item.draft);
		result.release =
			latest &&
			typeof latest.tag_name === "string" &&
			typeof latest.html_url === "string"
				? {
						tag: latest.tag_name,
						url: latest.html_url,
						prerelease: Boolean(latest.prerelease),
					}
				: null;
	} catch (error) {
		console.warn(
			`[GITHUB-CARD] Failed to refresh releases for ${repo}; retaining the last known release.`,
			error,
		);
	}
	return result;
}

async function main() {
	const existingCache = await readCache();
	const repositories = await findRepositories();
	const nextCache: GithubCardCache = {};
	let updated = 0;

	const entries = [...repositories];
	for (let offset = 0; offset < entries.length; offset += 4) {
		await Promise.all(
			entries
				.slice(offset, offset + 4)
				.map(async ([cacheKey, { repo, project }]) => {
					try {
						nextCache[cacheKey] = await fetchRepositoryData(
							repo,
							project,
							existingCache[cacheKey],
						);
						updated++;
					} catch (error) {
						if (existingCache[cacheKey]) {
							nextCache[cacheKey] = existingCache[cacheKey];
							console.warn(
								`[GITHUB-CARD] Failed to refresh ${repo}; keeping cached data.`,
								error,
							);
						} else {
							console.warn(
								`[GITHUB-CARD] Failed to load ${repo}; the card will use its fallback state.`,
								error,
							);
						}
					}
				}),
		);
	}

	const sortedCache = Object.fromEntries(
		Object.entries(nextCache).sort(([a], [b]) => a.localeCompare(b)),
	);
	await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
	await fs.writeFile(
		OUTPUT_FILE,
		`${JSON.stringify(sortedCache, null, "\t")}\n`,
	);
	console.log(
		`[GITHUB-CARD] Cached ${Object.keys(sortedCache).length} repositories (${updated} refreshed).`,
	);
}

main();
