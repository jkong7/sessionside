import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seed } from "./seed";

export { now, uid } from "./ids";

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
  expires_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ok INTEGER NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_email_at ON login_attempts(email, at);
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
  group_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS encounters_provider_date ON encounters(provider_id, date);
CREATE INDEX IF NOT EXISTS encounters_student_date ON encounters(student_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS encounters_slot ON encounters(provider_id, student_id, date, start) WHERE start != '';
CREATE TRIGGER IF NOT EXISTS encounters_signed_immutable
BEFORE UPDATE OF note, transcript, date, start, student_id, provider_id ON encounters
WHEN OLD.status != 'draft'
BEGIN SELECT RAISE(ABORT, 'signed encounters cannot be changed; add an addendum'); END;
CREATE TRIGGER IF NOT EXISTS encounters_no_unsign
BEFORE UPDATE OF status ON encounters
WHEN OLD.status != 'draft' AND NEW.status = 'draft'
BEGIN SELECT RAISE(ABORT, 'signed encounters cannot be reopened'); END;
CREATE TRIGGER IF NOT EXISTS encounters_no_delete_signed
BEFORE DELETE ON encounters
WHEN OLD.status != 'draft'
BEGIN SELECT RAISE(ABORT, 'signed encounters cannot be deleted'); END;
CREATE TABLE IF NOT EXISTS addenda (
  id TEXT PRIMARY KEY,
  encounter_id TEXT NOT NULL REFERENCES encounters(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS addenda_append_only_u BEFORE UPDATE ON addenda BEGIN SELECT RAISE(ABORT, 'addenda are append-only'); END;
CREATE TRIGGER IF NOT EXISTS addenda_append_only_d BEFORE DELETE ON addenda BEGIN SELECT RAISE(ABORT, 'addenda are append-only'); END;
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_append_only_u BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_append_only_d BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
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
  migrate(db);
  return db;
}

const COLUMNS: [string, string, string][] = [
  ["auth_sessions", "last_seen_at", "TEXT"],
  ["encounters", "group_key", "TEXT"],
];

function migrate(database: DatabaseSync): void {
  for (const [table, column, type] of COLUMNS) {
    const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export function db(): DatabaseSync {
  if (!g.__sessionsideDb) {
    const instance = openDb();
    const row = instance.prepare("SELECT COUNT(*) AS n FROM districts").get() as { n: number };
    if (row.n === 0 && process.env.SESSIONSIDE_SEED !== "0") seed(instance);
    g.__sessionsideDb = instance;
  }
  return g.__sessionsideDb;
}

export function setDb(instance: DatabaseSync): void {
  g.__sessionsideDb = instance;
}
