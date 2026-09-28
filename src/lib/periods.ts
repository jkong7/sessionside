import { addDays, parseISODate, toISODate } from "./dates";

export type Period = { key: string; label: string; from: string; to: string };

export function schoolYearStart(date: string): number {
  const d = parseISODate(date);
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}

export function quarters(date: string): Period[] {
  const y = schoolYearStart(date);
  const q = (n: number, from: string, to: string): Period => ({ key: `${y}-q${n}`, label: `Q${n} ${y}-${String(y + 1).slice(2)}`, from, to });
  return [
    q(1, `${y}-08-15`, `${y}-10-31`),
    q(2, `${y}-11-01`, `${y + 1}-01-15`),
    q(3, `${y + 1}-01-16`, `${y + 1}-03-31`),
    q(4, `${y + 1}-04-01`, `${y + 1}-06-15`),
  ];
}

export function currentQuarter(date: string): Period {
  const qs = quarters(date);
  return qs.find((q) => date >= q.from && date <= q.to) ?? qs.find((q) => date < q.from) ?? qs[3];
}

export function clampToToday(p: Period, today: string): Period {
  return p.to > today ? { ...p, to: today } : p;
}

export function daysLeft(p: Period, today: string): number {
  return Math.max(0, Math.round((parseISODate(p.to).getTime() - parseISODate(today).getTime()) / 86_400_000));
}

export { addDays, toISODate };
