import { addDays, weekday, weekStart } from "./dates";
import { allServices, encountersFor, getStudent, getUser, slotsForProvider } from "./repo";
import type { Discipline, Encounter, Service, Slot, Student, User } from "./types";

export type LedgerWeek = { weekStart: string; mandated: number; delivered: number; excused: number; shortfall: number; surplus: number };

export type LedgerRow = {
  student: Student;
  provider: User;
  discipline: Discipline;
  weeks: LedgerWeek[];
  mandated: number;
  delivered: number;
  excused: number;
  owed: number;
};

export function weeklyLedger(opts: { service: Service; slots: Slot[]; encounters: Encounter[]; from: string; throughWeekEnding: string }): LedgerWeek[] {
  const { service, slots, encounters } = opts;
  const out: LedgerWeek[] = [];
  for (let ws = weekStart(opts.from); addDays(ws, 4) <= opts.throughWeekEnding; ws = addDays(ws, 7)) {
    const we = addDays(ws, 4);
    const inWeek = encounters.filter((e) => e.date >= ws && e.date <= we && e.student_id === service.student_id);
    const delivered = inWeek.filter((e) => e.note.attendance === "present").reduce((n, e) => n + (e.note.minutes ?? 0), 0);
    let excused = 0;
    for (const e of inWeek.filter((x) => x.note.attendance === "student_absent")) {
      const slot = slots.find((s) => s.student_id === service.student_id && s.start === e.start && s.weekday === weekday(e.date));
      excused += slot?.minutes ?? 0;
    }
    const mandated = service.minutes_per_week;
    const shortfall = Math.max(0, mandated - delivered - excused);
    const surplus = Math.max(0, delivered - mandated);
    out.push({ weekStart: ws, mandated, delivered, excused, shortfall, surplus });
  }
  return out;
}

export function owedBalance(weeks: LedgerWeek[]): number {
  let owed = 0;
  for (const w of weeks) owed = Math.max(0, owed + w.shortfall - w.surplus);
  return owed;
}

export function ledgerReport(opts: { districtId: string; providerIds?: string[]; today: string }): LedgerRow[] {
  const lastFullWeekEnd = addDays(weekStart(opts.today), -3);
  const services = allServices(opts.districtId).filter((s) => !opts.providerIds || opts.providerIds.includes(s.provider_id));
  const rows: LedgerRow[] = [];
  for (const sv of services) {
    const student = getStudent(sv.student_id)!;
    const provider = getUser(sv.provider_id)!;
    const from = student.iep_start > addDays(opts.today, -365) ? student.iep_start : addDays(opts.today, -365);
    const encs = encountersFor({ studentId: sv.student_id, from, to: lastFullWeekEnd }).filter((e) => getUser(e.provider_id)?.discipline === sv.discipline);
    const weeks = weeklyLedger({ service: sv, slots: slotsForProvider(sv.provider_id), encounters: encs, from, throughWeekEnding: lastFullWeekEnd });
    const firstLogged = encs.map((e) => e.date).sort()[0];
    const tracked = firstLogged ? weeks.filter((w) => addDays(w.weekStart, 4) >= firstLogged) : [];
    rows.push({
      student,
      provider,
      discipline: sv.discipline,
      weeks: tracked,
      mandated: tracked.reduce((n, w) => n + w.mandated, 0),
      delivered: tracked.reduce((n, w) => n + w.delivered, 0),
      excused: tracked.reduce((n, w) => n + w.excused, 0),
      owed: owedBalance(tracked),
    });
  }
  return rows.sort((a, b) => b.owed - a.owed || a.student.last_name.localeCompare(b.student.last_name));
}
