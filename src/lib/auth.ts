import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { verifyPassword } from "./password";
import { audit, getUser, getUserWithHash } from "./repo";
import type { User } from "./types";

const COOKIE = "ss_session";
const TTL_MS = 12 * 60 * 60 * 1000;
const IDLE_MS = 60 * 60 * 1000;
export const MAX_FAILURES = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isLockedOut(email: string, at = Date.now()): boolean {
  const since = new Date(at - LOCKOUT_MS).toISOString();
  const row = db().prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND ok = 0 AND at >= ?").get(email.toLowerCase(), since) as { n: number };
  return row.n >= MAX_FAILURES;
}

function recordAttempt(email: string, ok: boolean): void {
  db().prepare("INSERT INTO login_attempts (email, ok, at) VALUES (?, ?, ?)").run(email.toLowerCase(), ok ? 1 : 0, new Date().toISOString());
  if (ok) db().prepare("DELETE FROM login_attempts WHERE email = ? AND ok = 0").run(email.toLowerCase());
}

export type SignInResult = { user: User } | { error: "invalid" | "locked" };

export async function signIn(emailRaw: string, password: string): Promise<SignInResult> {
  const email = emailRaw.trim().toLowerCase();
  if (isLockedOut(email)) return { error: "locked" };
  const found = getUserWithHash(email);
  if (!found || !verifyPassword(password, found.password_hash)) {
    recordAttempt(email, false);
    if (found) audit(found.id, "auth.failed", "user", found.id);
    return { error: isLockedOut(email) ? "locked" : "invalid" };
  }
  recordAttempt(email, true);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TTL_MS);
  db().prepare("INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), found.id, expires.toISOString());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.SESSIONSIDE_INSECURE_COOKIES !== "1",
    path: "/",
    expires,
  });
  audit(found.id, "auth.signed_in", "user", found.id);
  const { password_hash: _omit, ...user } = found;
  return { user };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM auth_sessions WHERE token = ?").run(hashToken(token));
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const key = hashToken(token);
  const row = db().prepare("SELECT user_id, expires_at, last_seen_at FROM auth_sessions WHERE token = ?").get(key) as { user_id: string; expires_at: string; last_seen_at: string | null } | undefined;
  const now = Date.now();
  if (!row || row.expires_at < new Date(now).toISOString() || (row.last_seen_at && Date.parse(row.last_seen_at) < now - IDLE_MS)) {
    if (row) db().prepare("DELETE FROM auth_sessions WHERE token = ?").run(key);
    return null;
  }
  db().prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token = ?").run(new Date(now).toISOString(), key);
  return getUser(row.user_id);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}
