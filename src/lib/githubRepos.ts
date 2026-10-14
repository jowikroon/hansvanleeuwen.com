export const GITHUB_USER = "jowikroon";

/** A repo counts as active when it was pushed to within this many days. */
export const ACTIVE_WINDOW_DAYS = 90;

const CACHE_KEY = "hvl_github_repos";
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface GithubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
}

export function filterActiveRepos(repos: GithubRepo[], now = Date.now()): GithubRepo[] {
  const cutoff = now - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return repos
    .filter((r) => !r.archived && new Date(r.pushed_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());
}

export function formatPushedAgo(pushedAt: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(pushedAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Public repos of GITHUB_USER, cached per browser session to stay under the unauthenticated rate limit. */
export async function fetchRepos(): Promise<GithubRepo[]> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { at, repos } = JSON.parse(cached) as { at: number; repos: GithubRepo[] };
      if (Date.now() - at < CACHE_TTL_MS) return repos;
    }
  } catch {
    // Unreadable or blocked storage: fetch fresh.
  }

  const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=100&type=owner`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const repos = (await res.json()) as GithubRepo[];

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    // Caching is best-effort.
  }
  return repos;
}
