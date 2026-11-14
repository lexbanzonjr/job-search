/** Minimal GitHub REST client for reading the user's own commits. */

const API = "https://api.github.com";
export const MAX_PATCH_CHARS = 12_000;

export type CommitSummary = { repo: string; sha: string; message: string; committedAt: string | null };
export type CommitFile = { filename: string; additions: number; deletions: number; patch?: string };
export type CommitDetail = CommitSummary & { additions: number; deletions: number; files: CommitFile[]; patch: string };

type Fetch = typeof fetch;

function token(): string {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is not set.");
  return t;
}

async function gh<T>(pathAndQuery: string, f: Fetch = fetch): Promise<T> {
  const res = await f(`${API}${pathAndQuery}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

const GENERATED = [
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock)$/,
  /(^|\/)(dist|build|\.next|node_modules|vendor)\//,
  /\.min\.(js|css)$/,
  /\.(map|snap)$/,
];

export const isGeneratedFile = (name: string) => GENERATED.some((r) => r.test(name));

/** Merge commits and commits that only touch generated files aren't resume material. */
export function isNoiseCommit(message: string, files?: CommitFile[]): boolean {
  if (/^Merge (branch|pull request|remote-tracking)/i.test(message)) return true;
  if (files && files.length > 0 && files.every((f) => isGeneratedFile(f.filename))) return true;
  return false;
}

export async function getLogin(f?: Fetch): Promise<string> {
  if (process.env.GITHUB_LOGIN) return process.env.GITHUB_LOGIN;
  return (await gh<{ login: string }>("/user", f)).login;
}

export async function listMyRepos(f?: Fetch): Promise<string[]> {
  const repos = await gh<{ full_name: string }[]>("/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member", f);
  return repos.map((r) => r.full_name);
}

export function buildCommitSearchQuery(login: string, opts: { repo?: string; since?: string; until?: string }): string {
  const q = [`author:${login}`];
  if (opts.repo) q.push(`repo:${opts.repo}`);
  if (opts.since || opts.until) q.push(`author-date:${opts.since ?? "*"}..${opts.until ?? "*"}`);
  return q.join(" ");
}

type ApiCommit = { sha: string; commit: { message: string; author?: { date?: string } }; parents?: unknown[]; repository?: { full_name: string } };

/** The user's commits in a repo (newest first), skipping merges. */
export async function searchMyCommits(
  opts: { repo: string; since?: string; until?: string; limit?: number },
  f?: Fetch,
): Promise<CommitSummary[]> {
  const login = await getLogin(f);
  const limit = opts.limit ?? 50;
  const params = new URLSearchParams({ author: login, per_page: String(Math.min(limit, 100)) });
  if (opts.since) params.set("since", new Date(opts.since).toISOString());
  if (opts.until) params.set("until", new Date(opts.until).toISOString());
  // The per-repo endpoint covers private repos and all branches' default history reliably;
  // commit search only indexes default branches of public/accessible repos.
  const list = await gh<ApiCommit[]>(`/repos/${opts.repo}/commits?${params}`, f);
  return list
    .filter((c) => (c.parents?.length ?? 1) <= 1 && !isNoiseCommit(c.commit.message))
    .slice(0, limit)
    .map((c) => ({ repo: opts.repo, sha: c.sha, message: c.commit.message, committedAt: c.commit.author?.date ?? null }));
}

/** Join file patches, skipping generated files, capped at `max` characters. */
export function trimPatch(files: CommitFile[], max = MAX_PATCH_CHARS): string {
  let out = "";
  for (const file of files) {
    if (isGeneratedFile(file.filename) || !file.patch) continue;
    const chunk = `--- ${file.filename}\n${file.patch}\n`;
    if (out.length + chunk.length > max) {
      out += chunk.slice(0, Math.max(0, max - out.length)) + "\n[diff truncated]\n";
      break;
    }
    out += chunk;
  }
  return out;
}

export async function getCommitDetail(repo: string, sha: string, f?: Fetch): Promise<CommitDetail> {
  const c = await gh<ApiCommit & { stats?: { additions: number; deletions: number }; files?: CommitFile[] }>(
    `/repos/${repo}/commits/${sha}`,
    f,
  );
  const files = (c.files ?? []).map(({ filename, additions, deletions, patch }) => ({ filename, additions, deletions, patch }));
  return {
    repo,
    sha: c.sha,
    message: c.commit.message,
    committedAt: c.commit.author?.date ?? null,
    additions: c.stats?.additions ?? 0,
    deletions: c.stats?.deletions ?? 0,
    files,
    patch: trimPatch(files),
  };
}
