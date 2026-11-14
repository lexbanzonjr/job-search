import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "js_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function hmac(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Token format: `<username>.<expiresAtSeconds>.<signature>` */
export function signSession(username: string, now = Date.now(), key = secret()): string {
  const exp = Math.floor(now / 1000) + SESSION_MAX_AGE;
  const payload = `${Buffer.from(username).toString("base64url")}.${exp}`;
  return `${payload}.${hmac(payload, key)}`;
}

export function verifySession(token: string | undefined, now = Date.now(), key = secret()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [user, exp, sig] = parts;
  if (!safeEqual(sig, hmac(`${user}.${exp}`, key))) return null;
  if (Number(exp) * 1000 < now) return null;
  return Buffer.from(user, "base64url").toString();
}
