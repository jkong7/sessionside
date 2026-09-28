export function today(): string {
  const fixed = process.env.SESSIONSIDE_TODAY;
  if (fixed) return fixed;
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function weekday(s: string): number {
  return parseISODate(s).getDay();
}

export function weekStart(s: string): string {
  const wd = weekday(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function businessDaysBetween(a: string, b: string): number {
  if (b <= a) return 0;
  let n = 0;
  let cur = a;
  while (cur < b) {
    cur = addDays(cur, 1);
    const wd = weekday(cur);
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export function formatDate(s: string): string {
  return parseISODate(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
