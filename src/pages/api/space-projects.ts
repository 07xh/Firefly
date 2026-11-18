import type { APIRoute } from "astro";

export const prerender = false;

// Public endpoint only. Never authenticate this request: a token with private-repo
// scope would make it possible to accidentally disclose private repository metadata.
const OWNER = "07xh";
const API_URL = "https://api.github.com/users/" + OWNER + "/repos";

type GitHubRepo = {
  name?: unknown;
  description?: unknown;
  html_url?: unknown;
  language?: unknown;
  fork?: unknown;
  private?: unknown;
  visibility?: unknown;
  pushed_at?: unknown;
  stargazers_count?: unknown;
  owner?: { login?: unknown };
};

function publicProject(repo: GitHubRepo) {
  if (
    !repo || repo.private !== false ||
    (repo.visibility !== undefined && repo.visibility !== "public") ||
    String(repo.owner?.login ?? "").toLowerCase() !== OWNER ||
    typeof repo.name !== "string" ||
    !/^[A-Za-z0-9_.-]+$/.test(repo.name)
  ) return null;

  return {
    id: repo.name,
    name: repo.name,
    description: typeof repo.description === "string" ? repo.description.slice(0, 320) : "",
    language: typeof repo.language === "string" ? repo.language : "",
    fork: repo.fork === true,
    stars: Number.isSafeInteger(repo.stargazers_count) ? repo.stargazers_count : 0,
    updatedAt: typeof repo.pushed_at === "string" ? repo.pushed_at : null,
    url: "https://github.com/" + OWNER + "/" + repo.name,
  };
}

export const GET: APIRoute = async () => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  try {
    const projects: NonNullable<ReturnType<typeof publicProject>>[] = [];
    for (let page = 1; page <= 5; page++) {
      const url = API_URL + "?type=public&per_page=100&sort=updated&page=" + page;
      const response = await fetch(url, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "07xh-Space-Public-Showcase" },
        signal: AbortSignal.timeout(8500),
      });
      if (!response.ok) throw new Error("GitHub public list HTTP " + response.status);
      const batch: unknown = await response.json();
      if (!Array.isArray(batch)) throw new Error("Invalid public repository list");
      for (const item of batch) {
        const project = publicProject(item as GitHubRepo);
        if (project) projects.push(project);
      }
      if (batch.length < 100) break;
    }
    return new Response(JSON.stringify({ projects, refreshedAt: new Date().toISOString() }), {
      status: 200, headers,
    });
  } catch {
    // Fail closed: never serve an unverified stale list after a visibility change.
    return new Response(JSON.stringify({ projects: [], error: "public_repositories_unavailable" }), {
      status: 503, headers,
    });
  }
};
