import type { Note } from "./types";

export type FieldChange = { field: string; from: string; to: string };

const fmtGoal = (g: Note["goals"][number]) =>
  `${g.correct != null && g.trials ? `${g.correct}/${g.trials} ` : ""}${g.percent != null ? `${g.percent}%` : ""}${g.cue ? ` ${g.cue}` : ""}`.trim() || "no data";

export function noteChanges(draft: Note, final: Note, goalName: (id: string) => string = (id) => id): FieldChange[] {
  const out: FieldChange[] = [];
  const cmp = (field: string, a: unknown, b: unknown) => {
    const from = a == null || a === "" ? "(empty)" : String(a);
    const to = b == null || b === "" ? "(empty)" : String(b);
    if (from !== to) out.push({ field, from, to });
  };
  cmp("Attendance", draft.attendance, final.attendance);
  cmp("Minutes", draft.minutes, final.minutes);
  cmp("Setting", draft.setting, final.setting);
  cmp("Group size", draft.group_size, final.group_size);
  cmp("Code", draft.cpt ? `${draft.cpt} x${draft.units}` : null, final.cpt ? `${final.cpt} x${final.units}` : null);
  cmp("Summary", draft.summary, final.summary);
  cmp("Activities", draft.activities.join("; "), final.activities.join("; "));
  cmp("Response", draft.response, final.response);
  cmp("Plan", draft.plan, final.plan);
  const ids = new Set([...draft.goals.map((g) => g.goal_id), ...final.goals.map((g) => g.goal_id)]);
  for (const id of ids) {
    const a = draft.goals.find((g) => g.goal_id === id);
    const b = final.goals.find((g) => g.goal_id === id);
    cmp(`Goal: ${goalName(id)}`, a ? fmtGoal(a) : null, b ? fmtGoal(b) : null);
  }
  return out;
}

export function editRate(pairs: { draft: Note; final: Note }[]): { notes: number; edited: number; fieldsChanged: number } {
  let edited = 0;
  let fieldsChanged = 0;
  for (const p of pairs) {
    const c = noteChanges(p.draft, p.final);
    if (c.length) edited++;
    fieldsChanged += c.length;
  }
  return { notes: pairs.length, edited, fieldsChanged };
}
