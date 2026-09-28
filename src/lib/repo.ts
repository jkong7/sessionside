import type { SQLInputValue } from "node:sqlite";
import type { CheckContext } from "./checks";
import { db, now, uid } from "./db";
import { today } from "./dates";
import type { Consent, District, Encounter, EncounterStatus, Goal, Note, Order, Service, Slot, Student, User } from "./types";

type Row = Record<string, unknown>;

function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

function one<T>(sql: string, ...params: SQLInputValue[]): T | null {
  return (db().prepare(sql).get(...params) as T | undefined) ?? null;
}

function toDistrict(r: Row): District {
  return { id: String(r.id), name: String(r.name), state: String(r.state), settings: JSON.parse(String(r.settings)) };
}

function toGoal(r: Row): Goal {
  return { ...(r as unknown as Goal), keywords: JSON.parse(String(r.keywords)) };
}

function toEncounter(r: Row): Encounter {
  return { ...(r as unknown as Encounter), note: JSON.parse(String(r.note)) as Note };
}

const USER_COLS = "id, district_id, email, name, role, discipline, credential, npi, license_number, license_expires, supervisor_id";

export function getDistrict(id: string): District {
  const r = one<Row>("SELECT * FROM districts WHERE id = ?", id);
  if (!r) throw new Error(`district ${id} not found`);
  return toDistrict(r);
}

export function getUser(id: string): User | null {
  return one<User>(`SELECT ${USER_COLS} FROM users WHERE id = ?`, id);
}

export function getUserWithHash(email: string): (User & { password_hash: string }) | null {
  return one<User & { password_hash: string }>(`SELECT ${USER_COLS}, password_hash FROM users WHERE lower(email) = lower(?)`, email);
}

export function listUsers(districtId: string): User[] {
  return all<User>(`SELECT ${USER_COLS} FROM users WHERE district_id = ? ORDER BY role, name`, districtId);
}

export function assistantsOf(supervisorId: string): User[] {
  return all<User>(`SELECT ${USER_COLS} FROM users WHERE supervisor_id = ? ORDER BY name`, supervisorId);
}

export function getStudent(id: string): Student | null {
  return one<Student>("SELECT * FROM students WHERE id = ?", id);
}

export function listStudents(districtId: string): Student[] {
  return all<Student>("SELECT * FROM students WHERE district_id = ? ORDER BY last_name, first_name", districtId);
}

export function caseload(providerId: string): Student[] {
  return all<Student>(
    "SELECT DISTINCT st.* FROM students st JOIN services sv ON sv.student_id = st.id WHERE sv.provider_id = ? ORDER BY st.last_name, st.first_name",
    providerId,
  );
}

export function servicesFor(studentId: string): Service[] {
  return all<Service>("SELECT * FROM services WHERE student_id = ? ORDER BY discipline", studentId);
}

export function servicesForProvider(providerId: string): Service[] {
  return all<Service>("SELECT * FROM services WHERE provider_id = ?", providerId);
}

export function allServices(districtId: string): Service[] {
  return all<Service>("SELECT sv.* FROM services sv JOIN students st ON st.id = sv.student_id WHERE st.district_id = ?", districtId);
}

export function goalsFor(studentId: string): Goal[] {
  return all<Row>("SELECT * FROM goals WHERE student_id = ? ORDER BY discipline, area", studentId).map(toGoal);
}

export function consentsFor(studentId: string): Consent[] {
  return all<Consent>("SELECT * FROM consents WHERE student_id = ? ORDER BY signed_on", studentId);
}

export function ordersFor(studentId: string): Order[] {
  return all<Order>("SELECT * FROM orders WHERE student_id = ? ORDER BY signed_on", studentId);
}

export function slotsOn(providerId: string, weekday: number): (Slot & { first_name: string; last_name: string })[] {
  return all(
    "SELECT sl.*, st.first_name, st.last_name FROM slots sl JOIN students st ON st.id = sl.student_id WHERE sl.provider_id = ? AND sl.weekday = ? ORDER BY sl.start, st.last_name",
    providerId,
    weekday,
  );
}

export function slotsForProvider(providerId: string): Slot[] {
  return all<Slot>("SELECT * FROM slots WHERE provider_id = ?", providerId);
}

export function getEncounter(id: string): Encounter | null {
  const r = one<Row>("SELECT * FROM encounters WHERE id = ?", id);
  return r ? toEncounter(r) : null;
}

export function encountersFor(opts: { providerIds?: string[]; studentId?: string; from?: string; to?: string; status?: EncounterStatus[] }): Encounter[] {
  const where: string[] = [];
  const params: SQLInputValue[] = [];
  if (opts.providerIds) {
    if (opts.providerIds.length === 0) return [];
    where.push(`provider_id IN (${opts.providerIds.map(() => "?").join(",")})`);
    params.push(...opts.providerIds);
  }
  if (opts.studentId) {
    where.push("student_id = ?");
    params.push(opts.studentId);
  }
  if (opts.from) {
    where.push("date >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    where.push("date <= ?");
    params.push(opts.to);
  }
  if (opts.status) {
    where.push(`status IN (${opts.status.map(() => "?").join(",")})`);
    params.push(...opts.status);
  }
  const sql = `SELECT * FROM encounters ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY date DESC, start DESC`;
  return all<Row>(sql, ...params).map(toEncounter);
}

export function encounterForSlot(providerId: string, studentId: string, date: string, start: string): Encounter | null {
  const r = one<Row>("SELECT * FROM encounters WHERE provider_id = ? AND student_id = ? AND date = ? AND start = ?", providerId, studentId, date, start);
  return r ? toEncounter(r) : null;
}

export function createEncounter(input: { studentId: string; providerId: string; date: string; start: string; transcript: string; note: Note; groupKey?: string | null }): Encounter {
  const id = uid("enc");
  const ts = now();
  db()
    .prepare("INSERT INTO encounters (id, student_id, provider_id, date, start, transcript, note, status, group_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)")
    .run(id, input.studentId, input.providerId, input.date, input.start, input.transcript, JSON.stringify(input.note), input.groupKey ?? null, ts, ts);
  return getEncounter(id)!;
}

export function updateEncounterNote(id: string, note: Note, transcript?: string): void {
  if (transcript != null) db().prepare("UPDATE encounters SET note = ?, transcript = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(note), transcript, now(), id);
  else db().prepare("UPDATE encounters SET note = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(note), now(), id);
}

export function markSigned(id: string, userId: string, status: EncounterStatus, at = now()): void {
  db().prepare("UPDATE encounters SET status = ?, signed_at = ?, signed_by = ?, updated_at = ? WHERE id = ?").run(status, at, userId, now(), id);
}

export function markCosigned(id: string, userId: string, at = now()): void {
  db().prepare("UPDATE encounters SET status = 'signed', cosigned_at = ?, cosigned_by = ?, updated_at = ? WHERE id = ?").run(at, userId, now(), id);
}

export function encountersInGroup(groupKey: string): Encounter[] {
  return all<Row>("SELECT * FROM encounters WHERE group_key = ? ORDER BY created_at", groupKey).map(toEncounter);
}

export function deleteEncounter(id: string): void {
  db().prepare("DELETE FROM encounters WHERE id = ?").run(id);
}

export function contextFor(enc: Pick<Encounter, "student_id" | "provider_id" | "date" | "note" | "status" | "signed_at" | "cosigned_at">): CheckContext {
  const student = getStudent(enc.student_id)!;
  const provider = getUser(enc.provider_id)!;
  return {
    encounter: enc,
    student,
    provider,
    services: servicesFor(student.id),
    consents: consentsFor(student.id),
    orders: ordersFor(student.id),
    settings: getDistrict(student.district_id).settings,
    today: today(),
  };
}

export type ProgressEntry = { goal_id: string; rating: string; narrative: string };
export type ProgressReportRow = {
  id: string;
  student_id: string;
  provider_id: string;
  discipline: string;
  period_start: string;
  period_end: string;
  content: ProgressEntry[];
  status: "draft" | "final";
  signed_at: string | null;
  updated_at: string;
};

function toReport(r: Row): ProgressReportRow {
  return { ...(r as unknown as ProgressReportRow), content: JSON.parse(String(r.content)) };
}

export function progressReportsFor(studentId: string): ProgressReportRow[] {
  return all<Row>("SELECT * FROM progress_reports WHERE student_id = ? ORDER BY period_end DESC", studentId).map(toReport);
}

export function findProgressReport(studentId: string, discipline: string, from: string, to: string): ProgressReportRow | null {
  const r = one<Row>("SELECT * FROM progress_reports WHERE student_id = ? AND discipline = ? AND period_start = ? AND period_end = ?", studentId, discipline, from, to);
  return r ? toReport(r) : null;
}

export function upsertProgressReport(input: { studentId: string; providerId: string; discipline: string; from: string; to: string; content: ProgressEntry[]; final: boolean }): string {
  const existing = findProgressReport(input.studentId, input.discipline, input.from, input.to);
  const ts = now();
  if (existing) {
    db()
      .prepare("UPDATE progress_reports SET content = ?, status = ?, signed_at = ?, provider_id = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(input.content), input.final ? "final" : "draft", input.final ? ts : null, input.providerId, ts, existing.id);
    return existing.id;
  }
  const id = uid("prg");
  db()
    .prepare("INSERT INTO progress_reports (id, student_id, provider_id, discipline, period_start, period_end, content, status, signed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, input.studentId, input.providerId, input.discipline, input.from, input.to, JSON.stringify(input.content), input.final ? "final" : "draft", input.final ? ts : null, ts, ts);
  return id;
}

export type Addendum = { id: string; encounter_id: string; author_id: string; text: string; created_at: string; author_name: string };

export function addendaFor(encounterId: string): Addendum[] {
  return all<Addendum>("SELECT a.*, u.name AS author_name FROM addenda a JOIN users u ON u.id = a.author_id WHERE a.encounter_id = ? ORDER BY a.created_at", encounterId);
}

export function addAddendum(encounterId: string, authorId: string, text: string): string {
  const id = uid("add");
  db().prepare("INSERT INTO addenda (id, encounter_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)").run(id, encounterId, authorId, text, now());
  return id;
}

export function audit(userId: string | null, action: string, entity: string, entityId: string, detail: Record<string, unknown> = {}): void {
  db().prepare("INSERT INTO audit (user_id, action, entity, entity_id, detail, at) VALUES (?, ?, ?, ?, ?, ?)").run(userId, action, entity, entityId, JSON.stringify(detail), now());
}

export type AuditRow = { id: number; user_id: string | null; action: string; entity: string; entity_id: string; detail: string; at: string; user_name: string | null };

export function auditFor(entity: string, entityId: string): AuditRow[] {
  return all<AuditRow>(
    "SELECT a.*, u.name AS user_name FROM audit a LEFT JOIN users u ON u.id = a.user_id WHERE a.entity = ? AND a.entity_id = ? ORDER BY a.id",
    entity,
    entityId,
  );
}
