import { one, dbOr, type Db } from "@/lib/db";
import type { User } from "@/lib/users";

export type UsageKind = "match" | "cover";

const DEFAULTS: Record<UsageKind, number> = { match: 5, cover: 20 };
const ENV: Record<UsageKind, string> = { match: "MATCH_DAILY_LIMIT", cover: "COVER_DAILY_LIMIT" };

export function dailyLimit(kind: UsageKind): number {
  const raw = process.env[ENV[kind]]?.trim();
  return raw && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULTS[kind];
}

const LABEL: Record<UsageKind, string> = { match: "match runs", cover: "cover letters" };

export class LimitError extends Error {}

/** Count one use of `kind` for today (UTC). Throws LimitError when the user is out. Admins are unlimited. */
export async function consume(user: User, kind: UsageKind, db?: Db, now = new Date()): Promise<void> {
  if (user.isAdmin) return;
  const limit = dailyLimit(kind);
  const day = now.toISOString().slice(0, 10);
  const row =
    limit > 0
      ? await one<{ count: number }>(
          await dbOr(db),
          `INSERT INTO usage (user_id, day, kind, count) VALUES (?, ?, ?, 1)
           ON CONFLICT(user_id, day, kind) DO UPDATE SET count = count + 1 WHERE count < ?
           RETURNING count`,
          [user.id, day, kind, limit],
        )
      : undefined;
  if (!row) throw new LimitError(`You've used all ${limit} ${LABEL[kind]} for today. Try again tomorrow.`);
}
