import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { all, one, dbOr, type Db } from "@/lib/db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

interface Row {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
}

const toUser = (r: Row): User => ({ id: Number(r.id), username: r.username, isAdmin: !!Number(r.is_admin) });

/** Format: `scrypt$<salt b64>$<hash b64>` */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await scrypt(password, salt, 64)).toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function findUser(username: string, db?: Db): Promise<User | null> {
  const r = await one<Row>(await dbOr(db), "SELECT * FROM users WHERE username = ?", [username]);
  return r ? toUser(r) : null;
}

async function putUser(db: Db, username: string, hash: string, isAdmin: boolean): Promise<User> {
  const r = await one<Row>(
    db,
    `INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, is_admin = excluded.is_admin
     RETURNING *`,
    [username, hash, isAdmin ? 1 : 0],
  );
  return toUser(r!);
}

/** Create a user, or reset the password of an existing one. */
export async function upsertUser(username: string, password: string, isAdmin = false, db?: Db): Promise<User> {
  const name = username.trim();
  if (!name || password.length < 8) throw new Error("Username is required and password must be at least 8 characters.");
  return putUser(await dbOr(db), name, await hashPassword(password), isAdmin);
}

/**
 * The AUTH_USERNAME/AUTH_PASSWORD env user is the admin. Create it if missing (its password always follows the env)
 * and hand it any data from before accounts existed.
 */
export async function ensureAdmin(db?: Db): Promise<User | null> {
  const username = process.env.AUTH_USERNAME?.trim();
  const password = process.env.AUTH_PASSWORD ?? "";
  if (!username || !password) return null;
  const c = await dbOr(db);
  const existing = await one<Row>(c, "SELECT * FROM users WHERE username = ?", [username]);
  // The env password always wins (no minimum length, so existing setups keep working).
  const admin =
    existing && Number(existing.is_admin) && (await verifyPassword(password, existing.password_hash))
      ? toUser(existing)
      : await putUser(c, username, await hashPassword(password), true);
  await c.batch(
    [
      { sql: "UPDATE resumes SET user_id = ? WHERE user_id IS NULL", args: [admin.id] },
      { sql: "UPDATE saved_jobs SET user_id = ? WHERE user_id = 0", args: [admin.id] },
    ],
    "write",
  );
  return admin;
}

/** Check a login. Returns the user, or null. */
export async function authenticate(username: string, password: string, db?: Db): Promise<User | null> {
  const c = await dbOr(db);
  await ensureAdmin(c);
  const r = await one<Row>(c, "SELECT * FROM users WHERE username = ?", [username.trim()]);
  if (!r) {
    await hashPassword(password); // similar timing whether or not the user exists
    return null;
  }
  return (await verifyPassword(password, r.password_hash)) ? toUser(r) : null;
}

export async function listUsers(db?: Db): Promise<(User & { createdAt: string })[]> {
  const rows = await all<Row & { created_at: string }>(await dbOr(db), "SELECT * FROM users ORDER BY username");
  return rows.map((r) => ({ ...toUser(r), createdAt: r.created_at }));
}

/** Delete a user and everything that belongs to them (matches go with their resumes). */
export async function deleteUser(id: number, db?: Db) {
  await (await dbOr(db)).batch(
    [
      { sql: "DELETE FROM matches WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)", args: [id] },
      { sql: "DELETE FROM resumes WHERE user_id = ?", args: [id] },
      { sql: "DELETE FROM saved_jobs WHERE user_id = ?", args: [id] },
      { sql: "DELETE FROM users WHERE id = ?", args: [id] },
    ],
    "write",
  );
}
