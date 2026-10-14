import { describe, expect, it } from "vitest";
import { GithubRepo, filterActiveRepos, formatPushedAgo } from "./githubRepos";

const NOW = new Date("2026-10-14T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();

const repo = (name: string, over: Partial<GithubRepo> = {}): GithubRepo => ({
  name,
  full_name: `jowikroon/${name}`,
  description: null,
  html_url: `https://github.com/jowikroon/${name}`,
  homepage: null,
  language: null,
  pushed_at: daysAgo(1),
  fork: false,
  archived: false,
  stargazers_count: 0,
  ...over,
});

describe("filterActiveRepos", () => {
  it("keeps recent own repos, newest first", () => {
    const result = filterActiveRepos([repo("old", { pushed_at: daysAgo(30) }), repo("new", { pushed_at: daysAgo(2) })], NOW);
    expect(result.map((r) => r.name)).toEqual(["new", "old"]);
  });

  it("drops archived and stale repos, keeps active forks", () => {
    const result = filterActiveRepos([
      repo("fork", { fork: true, pushed_at: daysAgo(3) }),
      repo("archived", { archived: true }),
      repo("stale", { pushed_at: daysAgo(200) }),
      repo("keep"),
    ], NOW);
    expect(result.map((r) => r.name)).toEqual(["keep", "fork"]);
  });
});

describe("formatPushedAgo", () => {
  it("formats minutes, hours and days", () => {
    expect(formatPushedAgo(new Date(NOW - 5 * 60000).toISOString(), NOW)).toBe("5m ago");
    expect(formatPushedAgo(new Date(NOW - 3 * 3600000).toISOString(), NOW)).toBe("3h ago");
    expect(formatPushedAgo(daysAgo(4), NOW)).toBe("4d ago");
  });
});
