import { requireAdmin } from "@/lib/session";
import { getAppSettings } from "@/lib/settings";
import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getAppSettings();

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-zinc-500">App-wide settings, shared by every user.</p>
      </div>
      <form action={saveSettingsAction} className="card space-y-4">
        <h2 className="font-semibold">Job sources</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="linkedinApi" value="1" defaultChecked={settings.linkedinApi} className="mt-0.5" />
          <span>
            <span className="font-medium">Enable LinkedIn Job Search API</span>
            <span className="block text-zinc-500">
              Adds LinkedIn postings to AI matches. Each match run uses 1 of the free plan&apos;s 25 requests a month
              (repeat searches within an hour are cached). Needs the API subscribed on the same RapidAPI key as JSearch.
            </span>
          </span>
        </label>

        <h2 className="pt-2 font-semibold">GitHub</h2>
        <p className="text-sm text-zinc-500">Used by the resume page to read your commits. The token only needs read access.</p>
        <details open={!settings.githubTokenSet} className="rounded-md border border-zinc-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium">How to create a token</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-600">
            <li>
              Open{" "}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-600 underline"
              >
                GitHub → New fine-grained token
              </a>
              .
            </li>
            <li><span className="font-medium">Resource owner:</span> your account (or the org that owns the repos).</li>
            <li><span className="font-medium">Expiration:</span> your choice. Paste a new token here when it expires.</li>
            <li>
              <span className="font-medium">Repository access:</span> &ldquo;All repositories&rdquo;, or &ldquo;Only select
              repositories&rdquo; for just the ones you want scanned.
            </li>
            <li>
              <span className="font-medium">Repository permissions:</span> set <span className="font-medium">Contents</span> to{" "}
              <span className="font-medium">Read-only</span>. <span className="font-medium">Metadata: Read-only</span> is added
              automatically. Leave everything else at &ldquo;No access&rdquo;.
            </li>
            <li><span className="font-medium">Account permissions:</span> none needed.</li>
            <li>
              Click <span className="font-medium">Generate token</span>, copy it (it starts with <code>github_pat_</code>), and
              paste it below.
            </li>
          </ol>
          <p className="mt-2 text-zinc-500">
            Using a classic token instead? Tick the <code>repo</code> scope for private repos, or no scopes for public repos
            only. Fine-grained is safer because it can be read-only.
          </p>
        </details>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Token</span>
          <input
            type="password"
            name="githubToken"
            autoComplete="off"
            placeholder={settings.githubTokenSet ? "Leave blank to keep the saved token" : "github_pat_…"}
            className="input w-full"
          />
          <span className="block text-zinc-500">{settings.githubTokenSet ? "Token saved." : "No token."}</span>
        </label>
        {settings.githubTokenSet && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="clearGithubToken" value="1" />
            Remove token
          </label>
        )}
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Username</span>
          <input name="githubLogin" defaultValue={settings.githubLogin} placeholder="your-github-login" className="input w-full" />
          <span className="block text-zinc-500">Optional. Looked up from the token if blank.</span>
        </label>
        <button className="btn">Save</button>
      </form>
    </main>
  );
}
