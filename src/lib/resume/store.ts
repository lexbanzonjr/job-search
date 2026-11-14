import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/lib/db";
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
  id: r.id,
  filename: r.filename,
  text: r.text,
  profile: r.profile_json ? JSON.parse(r.profile_json) : null,
  createdAt: r.created_at,
});

export function getLatestResume(db: DatabaseSync = getDb()): Resume | null {
  const row = db.prepare("SELECT * FROM resumes ORDER BY id DESC LIMIT 1").get() as Row | undefined;
  return row ? toResume(row) : null;
}

export function insertResume(filename: string, text: string, profile: ResumeProfile | null, db: DatabaseSync = getDb()): number {
  const r = db
    .prepare("INSERT INTO resumes (filename, text, profile_json) VALUES (?, ?, ?) RETURNING id")
    .get(filename, text, profile ? JSON.stringify(profile) : null) as { id: number };
  return r.id;
}

export function updateProfile(id: number, profile: ResumeProfile, db: DatabaseSync = getDb()) {
  db.prepare("UPDATE resumes SET profile_json = ? WHERE id = ?").run(JSON.stringify(profile), id);
}
