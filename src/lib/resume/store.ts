import { one, dbOr, type Db } from "@/lib/db";
import type { ResumeProfile } from "@/lib/ai/profile";

export interface Resume {
  id: number;
  filename: string;
  text: string;
  profile: ResumeProfile | null;
  createdAt: string;
}

interface Row {
  id: number;
  filename: string;
  text: string;
  profile_json: string | null;
  created_at: string;
}

const toResume = (r: Row): Resume => ({
  id: Number(r.id),
  filename: r.filename,
  text: r.text,
  profile: r.profile_json ? JSON.parse(r.profile_json) : null,
  createdAt: r.created_at,
});

export async function getLatestResume(userId: number, db?: Db): Promise<Resume | null> {
  const row = await one<Row>(await dbOr(db), "SELECT * FROM resumes WHERE user_id = ? ORDER BY id DESC LIMIT 1", [userId]);
  return row ? toResume(row) : null;
}

export async function insertResume(userId: number, filename: string, text: string, profile: ResumeProfile | null, db?: Db): Promise<number> {
  const r = await one<{ id: number }>(
    await dbOr(db),
    "INSERT INTO resumes (user_id, filename, text, profile_json) VALUES (?, ?, ?, ?) RETURNING id",
    [userId, filename, text, profile ? JSON.stringify(profile) : null],
  );
  return Number(r!.id);
}

export async function updateProfile(userId: number, id: number, profile: ResumeProfile, db?: Db) {
  await (await dbOr(db)).execute({
    sql: "UPDATE resumes SET profile_json = ? WHERE id = ? AND user_id = ?",
    args: [JSON.stringify(profile), id, userId],
  });
}
