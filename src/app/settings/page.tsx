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
        <button className="btn">Save</button>
      </form>
    </main>
  );
}
