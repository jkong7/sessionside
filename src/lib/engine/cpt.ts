import { rulePack, type RulePack } from "../rules";
import type { Attendance, Discipline, Setting } from "../types";

export const CPT_LABELS: Record<string, string> = {
  "92507": "Speech, language, voice, or communication treatment, individual",
  "92508": "Speech, language, voice, or communication treatment, group",
  "97530": "Therapeutic activities, each 15 minutes",
  "97535": "Self-care and home management training, each 15 minutes",
  "97110": "Therapeutic exercise, each 15 minutes",
  "97150": "Therapeutic procedures, group",
  "97799": "Unlisted physical medicine or rehabilitation service",
};

export function timedUnits(minutes: number): number {
  if (minutes < 8) return 0;
  return Math.floor(minutes / 15) + (minutes % 15 >= 8 ? 1 : 0);
}

export type CodeResult = { cpt: string | null; units: number; modifiers: string[] };

export function codeFor(
  discipline: Discipline,
  setting: Setting,
  attendance: Attendance,
  minutes: number | null,
  pack: RulePack = rulePack("IL"),
  assistant = false,
): CodeResult {
  if (attendance !== "present" || !minutes) return { cpt: null, units: 0, modifiers: [] };
  const rule = pack.codes[discipline];
  const cpt = setting === "group" ? rule.group : rule.individual;
  const modifiers = [...rule.modifiers];
  if (assistant && rule.assistantModifier) {
    const i = modifiers.indexOf("U8");
    if (i >= 0) modifiers.splice(i, 1);
    modifiers.push(rule.assistantModifier);
  }
  const timed = setting === "group" ? (rule.groupTimed ?? rule.timed) : rule.timed;
  if (!timed) return { cpt, units: 1, modifiers };
  const units = timedUnits(minutes);
  if (units === 0) return { cpt: null, units: 0, modifiers: [] };
  return { cpt, units, modifiers };
}
