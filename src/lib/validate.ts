import type { Note } from "./types";

export const MAX_MINUTES = 240;
export const MAX_GROUP = 12;

export function validateNote(note: Note): string[] {
  const errors: string[] = [];
  if (note.minutes != null && (!Number.isInteger(note.minutes) || note.minutes < 0 || note.minutes > MAX_MINUTES)) errors.push(`Minutes must be a whole number from 0 to ${MAX_MINUTES}.`);
  if (note.attendance === "present" && note.minutes === 0) errors.push("A delivered session needs more than 0 minutes.");
  if (note.group_size != null && (!Number.isInteger(note.group_size) || note.group_size < 2 || note.group_size > MAX_GROUP)) errors.push(`Group size must be from 2 to ${MAX_GROUP}.`);
  for (const g of note.goals) {
    if (g.trials != null && (!Number.isInteger(g.trials) || g.trials < 1 || g.trials > 500)) errors.push("Trials must be a whole number from 1 to 500.");
    if (g.correct != null && (!Number.isInteger(g.correct) || g.correct < 0)) errors.push("Correct must be a whole number of 0 or more.");
    if (g.correct != null && g.trials != null && g.correct > g.trials) errors.push("Correct cannot be more than trials.");
    if (g.percent != null && (g.percent < 0 || g.percent > 100)) errors.push("Percent must be from 0 to 100.");
    if (g.cue && g.cue.length > 60) errors.push("Cue description is too long.");
  }
  if (note.summary.length > 2000 || note.response.length > 4000 || note.plan.length > 4000) errors.push("Note text is too long.");
  if (note.activities.length > 30) errors.push("Too many activities.");
  return [...new Set(errors)];
}
