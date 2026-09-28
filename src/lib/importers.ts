import { z } from "zod";
import { toRecords } from "./csv";
import { db } from "./db";
import { uid } from "./ids";
import { isValidNpi } from "./npi";

export type ImportKind = "students" | "services" | "goals" | "consents" | "orders" | "attendance";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");
const optDate = z.union([date, z.literal("")]).transform((v) => v || null);
const discipline = z.enum(["slp", "ot", "pt"], { message: "must be slp, ot, or pt" });

const SCHEMAS = {
  students: z.object({
    student_id: z.string().min(1, "required"),
    first_name: z.string().min(1, "required"),
    last_name: z.string().min(1, "required"),
    dob: date,
    school: z.string().min(1, "required"),
    grade: z.string().min(1, "required"),
    medicaid_id: z.string().default("").transform((v) => v || null),
    iep_start: date,
    iep_end: date,
  }),
  services: z.object({
    student_id: z.string().min(1, "required"),
    discipline,
    minutes_per_week: z.coerce.number().int().min(1).max(1200),
    setting: z.enum(["individual", "group"], { message: "must be individual or group" }),
    provider_email: z.string().email("must be an email"),
  }),
  goals: z.object({
    student_id: z.string().min(1, "required"),
    discipline,
    area: z.string().min(1, "required"),
    text: z.string().min(1, "required"),
    keywords: z.string().default(""),
  }),
  consents: z.object({ student_id: z.string().min(1, "required"), signed_on: date, revoked_on: optDate }),
  orders: z.object({
    student_id: z.string().min(1, "required"),
    discipline,
    prescriber: z.string().min(1, "required"),
    prescriber_npi: z.string().refine(isValidNpi, "is not a valid NPI"),
    signed_on: date,
    expires_on: date,
  }),
  attendance: z.object({ student_id: z.string().min(1, "required"), date, status: z.enum(["present", "absent", "partial"], { message: "must be present, absent, or partial" }) }),
} as const;

export const IMPORT_COLUMNS: Record<ImportKind, string[]> = Object.fromEntries(
  Object.entries(SCHEMAS).map(([k, s]) => [k, Object.keys(s.shape)]),
) as Record<ImportKind, string[]>;

export type ImportResult = { kind: ImportKind; total: number; valid: number; errors: { row: number; message: string }[]; committed: boolean };

function studentByLocalId(districtId: string, localId: string): string | null {
  const r = db().prepare("SELECT id FROM students WHERE district_id = ? AND local_id = ?").get(districtId, localId) as { id: string } | undefined;
  return r?.id ?? null;
}

export function runImport(districtId: string, kind: ImportKind, csv: string, commit: boolean): ImportResult {
  const { headers, records } = toRecords(csv);
  const schema = SCHEMAS[kind];
  const errors: ImportResult["errors"] = [];
  const missing = IMPORT_COLUMNS[kind].filter((c) => !headers.includes(c) && !(schema.shape as Record<string, z.ZodType>)[c].safeParse(undefined).success);
  if (missing.length) return { kind, total: records.length, valid: 0, errors: [{ row: 1, message: `Missing columns: ${missing.join(", ")}` }], committed: false };
  if (records.length > 5000) return { kind, total: records.length, valid: 0, errors: [{ row: 1, message: "Import at most 5,000 rows at a time." }], committed: false };

  const pending: (() => void)[] = [];
  const localIdsInFile = new Set(kind === "students" ? records.map((r) => r.student_id) : []);
  records.forEach((raw, i) => {
    const row = i + 2;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row, message: parsed.error.issues.map((x) => `${String(x.path[0] ?? "row")} ${x.message}`).join("; ") });
      return;
    }
    const d = parsed.data as Record<string, unknown>;
    const localId = String(d.student_id);
    if (kind === "students") {
      if (String(d.iep_end) < String(d.iep_start)) {
        errors.push({ row, message: "iep_end is before iep_start" });
        return;
      }
      pending.push(() => {
        const existing = studentByLocalId(districtId, localId);
        if (existing) {
          db().prepare("UPDATE students SET first_name = ?, last_name = ?, dob = ?, school = ?, grade = ?, medicaid_id = ?, iep_start = ?, iep_end = ? WHERE id = ?").run(String(d.first_name), String(d.last_name), String(d.dob), String(d.school), String(d.grade), (d.medicaid_id as string | null) ?? null, String(d.iep_start), String(d.iep_end), existing);
        } else {
          db().prepare("INSERT INTO students (id, district_id, first_name, last_name, dob, school, grade, medicaid_id, iep_start, iep_end, local_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(uid("stu"), districtId, String(d.first_name), String(d.last_name), String(d.dob), String(d.school), String(d.grade), (d.medicaid_id as string | null) ?? null, String(d.iep_start), String(d.iep_end), localId);
        }
      });
      return;
    }
    const studentId = studentByLocalId(districtId, localId);
    if (!studentId && !localIdsInFile.has(localId)) {
      errors.push({ row, message: `No student with student_id ${localId} in this district. Import students first.` });
      return;
    }
    const sid = studentId!;
    if (kind === "services") {
      const provider = db().prepare("SELECT id, discipline FROM users WHERE district_id = ? AND lower(email) = lower(?)").get(districtId, String(d.provider_email)) as { id: string; discipline: string | null } | undefined;
      if (!provider) {
        errors.push({ row, message: `No staff account for ${d.provider_email}` });
        return;
      }
      if (provider.discipline !== d.discipline) {
        errors.push({ row, message: `${d.provider_email} is not a ${String(d.discipline).toUpperCase()} provider` });
        return;
      }
      pending.push(() => {
        db().prepare("DELETE FROM services WHERE student_id = ? AND discipline = ?").run(sid, String(d.discipline));
        db().prepare("INSERT INTO services (id, student_id, discipline, minutes_per_week, setting, provider_id) VALUES (?, ?, ?, ?, ?, ?)").run(uid("svc"), sid, String(d.discipline), Number(d.minutes_per_week), String(d.setting), provider.id);
      });
    } else if (kind === "goals") {
      const keywords = String(d.keywords)
        .split(/[;|]/)
        .map((k) => k.trim())
        .filter(Boolean);
      pending.push(() => {
        db().prepare("INSERT INTO goals (id, student_id, discipline, area, text, keywords) VALUES (?, ?, ?, ?, ?, ?)").run(uid("goal"), sid, String(d.discipline), String(d.area), String(d.text), JSON.stringify(keywords.length ? keywords : String(d.area).toLowerCase().split(/\s+/)));
      });
    } else if (kind === "consents") {
      pending.push(() => {
        db().prepare("INSERT INTO consents (id, student_id, kind, signed_on, revoked_on) VALUES (?, ?, 'medicaid_billing', ?, ?)").run(uid("con"), sid, String(d.signed_on), (d.revoked_on as string | null) ?? null);
      });
    } else if (kind === "orders") {
      if (String(d.expires_on) < String(d.signed_on)) {
        errors.push({ row, message: "expires_on is before signed_on" });
        return;
      }
      pending.push(() => {
        db().prepare("INSERT INTO orders (id, student_id, discipline, prescriber, prescriber_npi, signed_on, expires_on) VALUES (?, ?, ?, ?, ?, ?, ?)").run(uid("ord"), sid, String(d.discipline), String(d.prescriber), String(d.prescriber_npi), String(d.signed_on), String(d.expires_on));
      });
    } else if (kind === "attendance") {
      pending.push(() => {
        db().prepare("INSERT INTO school_attendance (student_id, date, status) VALUES (?, ?, ?) ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status").run(sid, String(d.date), String(d.status));
      });
    }
  });

  const result: ImportResult = { kind, total: records.length, valid: pending.length, errors, committed: false };
  if (commit && errors.length === 0 && pending.length) {
    db().exec("BEGIN");
    try {
      for (const p of pending) p();
      db().exec("COMMIT");
      result.committed = true;
    } catch (e) {
      db().exec("ROLLBACK");
      result.errors.push({ row: 0, message: `Import failed and was rolled back: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  return result;
}
