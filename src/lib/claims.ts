import { addDays, today } from "./dates";
import { claimValue } from "./minutes";
import { assistantsOf, encountersFor, getDistrict, getStudent, getUser, listUsers, ordersFor } from "./repo";
import { evaluate, type Evaluated } from "./status";
import type { User } from "./types";

export const PLACE_OF_SERVICE_SCHOOL = "03";

const REASON_TITLE: Record<string, string> = {
  MEDICAID_ID_MISSING: "Student has no Medicaid ID",
  CONSENT_MISSING: "No parental consent to bill Medicaid",
  CONSENT_REVOKED: "Parent revoked billing consent",
  IEP_NOT_ACTIVE: "Session outside the active IEP",
  NOT_ON_IEP: "Service not on the IEP",
  ORDER_MISSING: "No referral or prescription on file",
  ORDER_EXPIRED: "Referral expired",
  PRESCRIBER_NPI_INVALID: "Prescriber NPI invalid",
  PROVIDER_NPI_INVALID: "Provider NPI invalid",
  LICENSE_EXPIRED: "Provider license not active",
  MINUTES_MISSING: "Minutes not documented",
  CODE_MISSING: "No billable code",
  SUPERVISOR_MISSING: "Assistant has no supervisor",
  SIGNATURE_OVERDUE: "Signature past the state deadline",
};

export type ClaimLine = {
  encounterId: string;
  date: string;
  studentName: string;
  medicaidId: string;
  providerName: string;
  providerNpi: string;
  cpt: string;
  modifiers: string;
  units: number;
  timeStart: string;
  timeEnd: string;
  orderingNpi: string;
  minutes: number;
  setting: string;
  groupSize: number | null;
  pos: string;
  value: number;
};

export function scopeProviders(user: User): string[] {
  if (user.role === "coordinator") return listUsers(user.district_id).filter((u) => u.role !== "coordinator").map((u) => u.id);
  return [user.id, ...assistantsOf(user.id).map((a) => a.id)];
}

export function claimsReport(user: User, from = addDays(today(), -30), to = today()) {
  const rates = getDistrict(user.district_id).settings.rates;
  const encs = encountersFor({ providerIds: scopeProviders(user), from, to }).map(evaluate);
  const billable = encs.filter((e) => e.state === "billable");
  const blocked = encs.filter((e) => e.state === "blocked");
  const pending = encs.filter((e) => e.state === "ready_to_sign" || e.state === "awaiting_cosign");
  const lines: ClaimLine[] = billable.map((e) => toLine(e, rates));
  const reasons = new Map<string, { message: string; count: number; value: number; fix: string }>();
  for (const e of blocked) {
    for (const i of e.issues.filter((x) => x.severity === "block")) {
      const key = i.code;
      const cur = reasons.get(key) ?? { message: REASON_TITLE[i.code] ?? i.message, count: 0, value: 0, fix: i.fix };
      cur.count++;
      cur.value += claimValue(e, rates);
      reasons.set(key, cur);
    }
  }
  return {
    from,
    to,
    lines,
    billableValue: lines.reduce((n, l) => n + l.value, 0),
    blockedCount: blocked.length,
    blockedValue: blocked.reduce((n, e) => n + claimValue(e, rates), 0),
    pendingCount: pending.length,
    pendingValue: pending.reduce((n, e) => n + claimValue(e, rates), 0),
    reasons: [...reasons.entries()].map(([code, r]) => ({ code, ...r })).sort((a, b) => b.value - a.value),
  };
}

function toLine(e: Evaluated, rates: Record<string, number>): ClaimLine {
  const s = getStudent(e.student_id)!;
  const p = getUser(e.provider_id)!;
  return {
    encounterId: e.id,
    date: e.date,
    studentName: `${s.last_name}, ${s.first_name}`,
    medicaidId: s.medicaid_id ?? "",
    providerName: p.name,
    providerNpi: p.npi,
    cpt: e.note.cpt ?? "",
    modifiers: (e.note.modifiers ?? []).join(" "),
    units: e.note.units,
    timeStart: e.note.time_start ?? "",
    timeEnd: e.note.time_end ?? "",
    orderingNpi: ordersFor(s.id).filter((o) => o.discipline === p.discipline && o.signed_on <= e.date).at(-1)?.prescriber_npi ?? "",
    minutes: e.note.minutes ?? 0,
    setting: e.note.setting,
    groupSize: e.note.group_size,
    pos: PLACE_OF_SERVICE_SCHOOL,
    value: claimValue(e, rates),
  };
}

export function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(lines: ClaimLine[]): string {
  const header = ["date_of_service", "student", "medicaid_id", "provider", "provider_npi", "ordering_npi", "procedure_code", "modifiers", "units", "minutes", "time_start", "time_end", "setting", "group_size", "place_of_service", "encounter_id"];
  const rows = lines.map((l) => [l.date, l.studentName, l.medicaidId, l.providerName, l.providerNpi, l.orderingNpi, l.cpt, l.modifiers, l.units, l.minutes, l.timeStart, l.timeEnd, l.setting, l.groupSize, l.pos, l.encounterId].map(csvCell).join(","));
  return [header.join(","), ...rows].join("\n") + "\n";
}
