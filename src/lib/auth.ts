import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { verifyPassword } from "./password";
import { getUser, getUserWithHash } from "./repo";
import type { User } from "./types";

const COOKIE = "ss_session";
const TTL_MS = 12 * 60 * 60 * 1000;

export async function signIn(email: string, password: string): Promise<User | null> {
  const found = getUserWithHash(email.trim());
  if (!found || !verifyPassword(password, found.password_hash)) return null;
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TTL_MS);
  db().prepare("INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, found.id, expires.toISOString());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.SESSIONSIDE_INSECURE_COOKIES !== "1",
    path: "/",
    expires,
  });
  const { password_hash: _omit, ...user } = found;
  return user;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = db().prepare("SELECT user_id, expires_at FROM auth_sessions WHERE token = ?").get(token) as { user_id: string; expires_at: string } | undefined;
  if (!row || row.expires_at < new Date().toISOString()) return null;
  return getUser(row.user_id);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
