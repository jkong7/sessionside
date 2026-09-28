import { addDays, weekday } from "./dates";
import { codeFor } from "./engine/cpt";
import { rulePack } from "./rules";
import { allServices, encountersFor, getDistrict, getStudent, getUser, slotsForProvider } from "./repo";
import { evaluate, type Evaluated } from "./status";
import type { Discipline, Service, Student, User } from "./types";

export type MinutesRow = {
  student: Student;
  provider: User;
  discipline: Discipline;
  mandated: number;
  delivered: number;
  billable: number;
  blockedMinutes: number;
  pendingMinutes: number;
  unlogged: { date: string; start: string; minutes: number }[];
  remaining: number;
  owed: number;
  makeups: number;
  blockedValue: number;
  billableValue: number;
};

export type MinutesReport = {
  weekStart: string;
  weekEnd: string;
  rows: MinutesRow[];
  totals: { mandated: number; delivered: number; billable: number; unloggedSessions: number; owed: number; blockedValue: number; billableValue: number };
};

export const ESTIMATE_MINUTES = 30;

export function claimValue(e: Evaluated, rates: Record<string, number>): number {
  if (e.note.cpt) return (rates[e.note.cpt] ?? 0) * e.note.units;
  if (e.note.attendance !== "present") return 0;
  const discipline = getUser(e.provider_id)?.discipline;
  if (!discipline) return 0;
  const provider = getUser(e.provider_id)!;
  const est = codeFor(discipline, e.note.setting, "present", ESTIMATE_MINUTES, rulePack(getDistrict(provider.district_id).settings.state));
  return est.cpt ? (rates[est.cpt] ?? 0) * est.units : 0;
}

export function weekReport(opts: { districtId: string; providerIds?: string[]; weekStart: string; today: string }): MinutesReport {
  const { districtId, weekStart, today } = opts;
  const weekEnd = addDays(weekStart, 4);
  const rates = getDistrict(districtId).settings.rates;
  const services = allServices(districtId).filter((s) => !opts.providerIds || opts.providerIds.includes(s.provider_id));
  const providerIds = [...new Set(services.map((s) => s.provider_id))];
  const encs = encountersFor({ providerIds, from: weekStart, to: weekEnd }).map(evaluate);
  const slotCache = new Map(providerIds.map((p) => [p, slotsForProvider(p)]));

  const rows: MinutesRow[] = services.map((sv: Service) => {
    const student = getStudent(sv.student_id)!;
    const provider = getUser(sv.provider_id)!;
    const mine = encs.filter((e) => e.student_id === sv.student_id && (e.provider_id === sv.provider_id || getUser(e.provider_id)?.discipline === sv.discipline));
    const present = mine.filter((e) => e.note.attendance === "present");
    const delivered = present.reduce((n, e) => n + (e.note.minutes ?? 0), 0);
    const billableEncs = present.filter((e) => e.state === "billable");
    const blockedEncs = present.filter((e) => e.state === "blocked");
    const billable = billableEncs.reduce((n, e) => n + (e.note.minutes ?? 0), 0);
    const blockedMinutes = blockedEncs.reduce((n, e) => n + (e.note.minutes ?? 0), 0);
    const pendingMinutes = present.filter((e) => e.state === "ready_to_sign" || e.state === "awaiting_cosign").reduce((n, e) => n + (e.note.minutes ?? 0), 0);
    const slots = (slotCache.get(sv.provider_id) ?? []).filter((s) => s.student_id === sv.student_id);
    const unlogged: MinutesRow["unlogged"] = [];
    let remaining = 0;
    for (let i = 0; i < 5; i++) {
      const date = addDays(weekStart, i);
      for (const s of slots.filter((x) => x.weekday === weekday(date))) {
        const logged = mine.some((e) => e.date === date && e.start === s.start);
        if (date < today && !logged) unlogged.push({ date, start: s.start, minutes: s.minutes });
        else if (date >= today && !logged) remaining += s.minutes;
      }
    }
    const makeups = mine.filter((e) => e.note.attendance === "provider_absent" || e.note.attendance === "school_closed").length;
    const owed = Math.max(0, sv.minutes_per_week - delivered - remaining);
    return {
      student,
      provider,
      discipline: sv.discipline,
      mandated: sv.minutes_per_week,
      delivered,
      billable,
      blockedMinutes,
      pendingMinutes,
      unlogged,
      remaining,
      owed,
      makeups,
      blockedValue: blockedEncs.reduce((n, e) => n + claimValue(e, rates), 0),
      billableValue: billableEncs.reduce((n, e) => n + claimValue(e, rates), 0),
    };
  });

  rows.sort((a, b) => b.owed - a.owed || b.unlogged.length - a.unlogged.length || a.student.last_name.localeCompare(b.student.last_name));
  const sum = (f: (r: MinutesRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  return {
    weekStart,
    weekEnd,
    rows,
    totals: {
      mandated: sum((r) => r.mandated),
      delivered: sum((r) => r.delivered),
      billable: sum((r) => r.billable),
      unloggedSessions: sum((r) => r.unlogged.length),
      owed: sum((r) => r.owed),
      blockedValue: sum((r) => r.blockedValue),
      billableValue: sum((r) => r.billableValue),
    },
  };
}
