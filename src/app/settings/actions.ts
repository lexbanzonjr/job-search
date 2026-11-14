"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { setGitHubConfig, setLinkedInApi } from "@/lib/settings";

export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  await setLinkedInApi(formData.get("linkedinApi") === "1");
  const login = String(formData.get("githubLogin") ?? "").trim();
  await setGitHubConfig({
    token: String(formData.get("githubToken") ?? ""),
    login: /^[A-Za-z0-9-]{1,39}$/.test(login) ? login : "",
    clearToken: formData.get("clearGithubToken") === "1",
  });
  revalidatePath("/settings");
  revalidatePath("/matches");
}
