// Firefly backend-only change gate for firefly-admin/* pull requests.
// Fail closed: no public page, content, shared theme, or deployment workflow edits.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const allowed = [
  /^src\/pages\/admin\/[^\0]+$/,
  /^src\/pages\/api\/(?:admin|auth)\/[^\0]+$/,
  /^src\/components\/admin\/[^\0]+$/,
  /^src\/lib\/admin-[^/]+\.ts$/,
  /^src\/lib\/ai-provider-config\.ts$/,
  /^src\/styles\/admin-[^/]+\.(?:css|styl)$/,
  /^public\/admin\/[^\0]+$/,
  /^public\/admin-[^/]+\.(?:css|js)$/,
  /^scripts\/admin-[^/]+\.(?:test\.)?(?:mjs|js|ts)$/,
  /^scripts\/ai-draft\.test\.mjs$/,
  /^docs\/(?:ADMIN_[^/]+|admin-[^/]+)\.md$/,
  /^\.github\/workflows\/admin-only-guard\.yml$/,
  /^scripts\/guard-admin-only-changes(?:\.test)?\.mjs$/,
];

export function checkChangedPaths(paths) {
  return paths.filter((path) =>
    typeof path !== "string" ||
    !path ||
    path.includes("\\") ||
    path.startsWith("/") ||
    path.includes("..") ||
    !allowed.some((pattern) => pattern.test(path))
  );
}

export function changedPathsAgainst(baseSha, head = "HEAD") {
  if (!/^[0-9a-f]{40}$/i.test(baseSha)) {
    throw new Error("ADMIN_SCOPE_BASE must be a full 40-character Git commit SHA");
  }
  const mergeBase = execFileSync("git", ["merge-base", baseSha, head], { encoding: "utf8" }).trim();
  const changed = execFileSync("git", ["diff", "--name-only", "-z", mergeBase, head], { encoding: "utf8" });
  return changed.split("\0").filter(Boolean);
}

function main() {
  try {
    const changed = changedPathsAgainst(process.env.ADMIN_SCOPE_BASE ?? "");
    if (changed.length === 0) throw new Error("No changed files found; refusing an unverified scope");
    const blocked = checkChangedPaths(changed);
    if (blocked.length > 0) {
      console.error("Backend-only PR contains paths outside the allowed admin scope:");
      for (const path of blocked) console.error("  BLOCKED " + path);
      process.exitCode = 1;
      return;
    }
    console.log("PASS: " + changed.length + " changed files are limited to Firefly admin-only scope.");
  } catch (error) {
    console.error("Backend-only scope gate failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
