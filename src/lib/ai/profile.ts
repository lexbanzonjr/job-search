import { generateText, Output } from "ai";
import { z } from "zod";
import { getModel } from "./model";

export const profileSchema = z.object({
  name: z.string().describe("Candidate name, or empty string if absent"),
  summary: z.string().describe("2-3 sentence professional summary"),
  targetTitles: z.array(z.string()).describe("3-6 job titles this person is a strong fit for, most likely first"),
  skills: z.array(z.string()).describe("Key hard skills, tools, languages, frameworks (max 25)"),
  yearsExperience: z.number().describe("Total years of professional experience"),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "principal", "executive"]),
  locations: z.array(z.string()).describe("Locations mentioned or implied as current/preferred"),
  industries: z.array(z.string()),
  experience: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        location: z.string().describe("City/region or 'Remote', or empty string"),
        startDate: z.string().describe("e.g. 'Jan 2020' or '2020'"),
        endDate: z.string().describe("'Present' if current role"),
        highlights: z.array(z.string()).describe("2-5 concise accomplishments"),
      }),
    )
    .default([])
    .describe("Work history roles, most recent first"),
  projects: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().describe("Project or repo link, or empty string"),
        tech: z.array(z.string()).describe("Main languages/frameworks used"),
        startDate: z.string().describe("e.g. 'Jan 2024', or empty string"),
        endDate: z.string().describe("'Present' if ongoing, or empty string"),
        highlights: z.array(z.string()).describe("1-4 concise accomplishments"),
      }),
    )
    .default([])
    .describe("Personal, side, open-source, or academic projects (not paid roles)"),
});

export type ResumeProfile = z.infer<typeof profileSchema>;
export type ExperienceEntry = ResumeProfile["experience"][number];
export type ProjectEntry = ResumeProfile["projects"][number];

/** Fill in fields added after a profile was saved (e.g. `projects`). */
export function normalizeProfile(raw: unknown): ResumeProfile {
  const p = (raw ?? {}) as Partial<ResumeProfile>;
  return { ...(p as ResumeProfile), experience: p.experience ?? [], projects: p.projects ?? [] };
}

export async function extractProfile(resumeText: string): Promise<ResumeProfile> {
  const { output } = await generateText({
    model: getModel(),
    instructions:
      "You are a technical recruiter. Read the resume and extract a structured candidate profile. " +
      "Only use facts supported by the resume; infer seniority and target titles from experience. " +
      "Put paid roles in experience and personal, side, open-source, or academic projects in projects.",
    prompt: `<resume>\n${resumeText.slice(0, 30_000)}\n</resume>`,
    output: Output.object({ schema: profileSchema }),
  });
  return output;
}
