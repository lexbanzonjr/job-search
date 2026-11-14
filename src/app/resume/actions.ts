"use server";

import { revalidatePath } from "next/cache";
import { extractProfile, profileSchema } from "@/lib/ai/profile";
import { extractResumeText } from "@/lib/resume/parse";
import { getLatestResume, insertResume, updateProfile } from "@/lib/resume/store";
import { requireUser } from "@/lib/session";

export type ActionState = { error?: string; ok?: string } | null;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function uploadResumeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a resume file first." };
  try {
    const text = await extractResumeText(Buffer.from(await file.arrayBuffer()), file.name, file.type);
    const id = await insertResume(user.id, file.name, text, null);
    try {
      await updateProfile(user.id, id, await extractProfile(text));
    } catch (e) {
      revalidatePath("/resume");
      return { error: `Resume saved, but the AI profile failed: ${errMsg(e)}` };
    }
    revalidatePath("/resume");
    return { ok: "Resume analyzed." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function parseJson(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(v ?? "[]"));
  } catch {
    return [];
  }
}

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const resume = await getLatestResume(user.id);
  if (!resume) return { error: "Upload a resume first." };
  const parsed = profileSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    summary: String(formData.get("summary") ?? ""),
    targetTitles: list(formData.get("targetTitles")),
    skills: list(formData.get("skills")),
    yearsExperience: Number(formData.get("yearsExperience")) || 0,
    seniority: String(formData.get("seniority")),
    locations: list(formData.get("locations")),
    industries: list(formData.get("industries")),
    experience: parseJson(formData.get("experience")),
    projects: parseJson(formData.get("projects")),
  });
  if (!parsed.success) return { error: "Invalid profile: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  await updateProfile(user.id, resume.id, parsed.data);
  revalidatePath("/resume");
  return { ok: "Profile saved." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function reanalyzeAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const resume = await getLatestResume(user.id);
  if (!resume) return { error: "Upload a resume first." };
  try {
    await updateProfile(user.id, resume.id, await extractProfile(resume.text));
    revalidatePath("/resume");
    return { ok: "Profile regenerated." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
