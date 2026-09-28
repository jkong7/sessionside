import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS districts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  district_id TEXT NOT NULL REFERENCES districts(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  discipline TEXT,
  credential TEXT NOT NULL DEFAULT '',
  npi TEXT NOT NULL DEFAULT '',
  license_number TEXT NOT NULL DEFAULT '',
  license_expires TEXT NOT NULL DEFAULT '',
  supervisor_id TEXT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  district_id TEXT NOT NULL REFERENCES districts(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  school TEXT NOT NULL,
  grade TEXT NOT NULL,
  medicaid_id TEXT,
  iep_start TEXT NOT NULL,
  iep_end TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  discipline TEXT NOT NULL,
  minutes_per_week INTEGER NOT NULL,
  setting TEXT NOT NULL,
  provider_id TEXT NOT NULL REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  discipline TEXT NOT NULL,
  area TEXT NOT NULL,
  text TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  signed_on TEXT NOT NULL,
  revoked_on TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  discipline TEXT NOT NULL,
  prescriber TEXT NOT NULL,
  prescriber_npi TEXT NOT NULL,
  signed_on TEXT NOT NULL,
  expires_on TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES users(id),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  start TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  setting TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  start TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  signed_at TEXT,
  signed_by TEXT,
  cosigned_at TEXT,
  cosigned_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS encounters_provider_date ON encounters(provider_id, date);
CREATE INDEX IF NOT EXISTS encounters_student_date ON encounters(student_id, date);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL
);
`;

type Global = { __sessionsideDb?: DatabaseSync };
const g = globalThis as Global;

export function dbPath(): string {
  return process.env.SESSIONSIDE_DB ?? path.join(process.cwd(), "data", "sessionside.db");
}

export function openDb(file = dbPath()): DatabaseSync {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return db;
}

export function db(): DatabaseSync {
  if (!g.__sessionsideDb) g.__sessionsideDb = openDb();
  return g.__sessionsideDb;
}

export function setDb(instance: DatabaseSync): void {
  g.__sessionsideDb = instance;
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function now(): string {
  return new Date().toISOString();
}
