import { clauses, detectAttendance } from "./local";

export type GroupMember = { id: string; firstName: string };
export type GroupSplit = { shared: string; byStudent: Record<string, string>; absent: string[]; unmatched: string[] };

function nameRe(name: string): RegExp {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}('s)?\\b`, "i");
}

function splitAtNames(clause: string, members: GroupMember[]): string[] {
  const union = new RegExp(`\\b(${members.map((m) => m.firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})('s)?\\b`, "gi");
  const hits: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = union.exec(clause))) hits.push({ start: m.index, end: m.index + m[0].length });
  const cuts: number[] = [];
  for (let i = 0; i < hits.length; i++) {
    if (hits[i].start === 0) continue;
    const between = clause.slice(i === 0 ? 0 : hits[i - 1].end, hits[i].start);
    if (i > 0 && /^\s*(,|and|&|,\s*and)?\s*$/i.test(between)) continue;
    cuts.push(hits[i].start);
  }
  const parts: string[] = [];
  let prev = 0;
  for (const c of cuts) {
    parts.push(clause.slice(prev, c));
    prev = c;
  }
  parts.push(clause.slice(prev));
  return parts.map((p) => p.trim().replace(/^(and|then|also)\s+/i, "")).filter(Boolean);
}

export function splitGroupDictation(transcript: string, members: GroupMember[]): GroupSplit {
  const shared: string[] = [];
  const own: Record<string, string[]> = Object.fromEntries(members.map((m) => [m.id, []]));
  const absent = new Set<string>();
  let current: string | null = null;
  for (const clause of clauses(transcript).flatMap((c) => splitAtNames(c, members))) {
    const named = members.filter((m) => nameRe(m.firstName).test(clause));
    if (named.length > 1) {
      const isAbsence = detectAttendance(clause) === "student_absent";
      for (const m of named) {
        if (isAbsence) absent.add(m.id);
        else own[m.id].push(clause);
      }
      current = null;
      continue;
    }
    if (named.length === 1) current = named[0].id;
    if (current) {
      if (named.length === 1 && detectAttendance(clause) === "student_absent") {
        absent.add(current);
        current = null;
        continue;
      }
      own[current].push(clause);
    } else {
      shared.push(clause);
    }
  }
  const byStudent: Record<string, string> = {};
  for (const m of members) byStudent[m.id] = own[m.id].join(" ");
  return {
    shared: shared.join(" "),
    byStudent,
    absent: [...absent],
    unmatched: members.filter((m) => !absent.has(m.id) && own[m.id].length === 0).map((m) => m.id),
  };
}
