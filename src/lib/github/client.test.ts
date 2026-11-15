import { beforeEach, describe, expect, it, vi } from "vitest";
const config = vi.hoisted(() => ({ token: "t" as string | null, login: "me" as string | null }));
vi.mock("@/lib/settings", () => ({ getGitHubConfig: async () => ({ ...config }) }));

import { buildCommitSearchQuery, getCommitDetail, isNoiseCommit, searchMyCommits, trimPatch } from "./client";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("github client", () => {
  beforeEach(() => {
    config.token = "t";
    config.login = "me";
  });

  it("builds a search query", () => {
    expect(buildCommitSearchQuery("me", { repo: "o/r", since: "2026-01-01" })).toBe("author:me repo:o/r author-date:2026-01-01..*");
  });

  it("flags merges and lockfile-only commits as noise", () => {
    expect(isNoiseCommit("Merge branch 'x' into y")).toBe(true);
    expect(isNoiseCommit("Bump deps", [{ filename: "package-lock.json", additions: 9, deletions: 9 }])).toBe(true);
    expect(isNoiseCommit("Add cache", [{ filename: "src/cache.ts", additions: 9, deletions: 0 }])).toBe(false);
  });

  it("trims patches and skips generated files", () => {
    const files = [
      { filename: "yarn.lock", additions: 1, deletions: 1, patch: "LOCK" },
      { filename: "a.ts", additions: 1, deletions: 0, patch: "x".repeat(50) },
      { filename: "b.ts", additions: 1, deletions: 0, patch: "y".repeat(50) },
    ];
    const out = trimPatch(files, 80);
    expect(out).not.toContain("LOCK");
    expect(out).toContain("--- a.ts");
    expect(out).toContain("[diff truncated]");
  });

  it("lists the user's commits without merges", async () => {
    const f = vi.fn(async () =>
      json([
        { sha: "1", commit: { message: "Add search", author: { date: "2026-02-01" } }, parents: [{}] },
        { sha: "2", commit: { message: "Merge pull request #3" }, parents: [{}, {}] },
      ]),
    );
    const out = await searchMyCommits({ repo: "o/r", since: "2026-01-01" }, f as unknown as typeof fetch);
    expect(out).toEqual([{ repo: "o/r", sha: "1", message: "Add search", committedAt: "2026-02-01" }]);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/repos/o/r/commits?author=me");
  });

  it("asks for a token on Settings when none is saved", async () => {
    config.token = null;
    await expect(getCommitDetail("o/r", "1", vi.fn() as unknown as typeof fetch)).rejects.toThrow("Settings");
  });

  it("fetches commit detail", async () => {
    const f = vi.fn(async () =>
      json({ sha: "1", commit: { message: "m" }, stats: { additions: 3, deletions: 1 }, files: [{ filename: "a.ts", additions: 3, deletions: 1, patch: "@@" }] }),
    );
    const d = await getCommitDetail("o/r", "1", f as unknown as typeof fetch);
    expect(d.additions).toBe(3);
    expect(d.patch).toContain("--- a.ts");
  });
});
