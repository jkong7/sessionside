import type { Attendance, Discipline, Setting } from "../types";

export const CPT_LABELS: Record<string, string> = {
  "92507": "Speech, language, voice, or communication treatment, individual",
  "92508": "Speech, language, voice, or communication treatment, group",
  "97530": "Therapeutic activities, each 15 minutes",
  "97110": "Therapeutic exercise, each 15 minutes",
  "97150": "Therapeutic procedures, group",
};

export function timedUnits(minutes: number): number {
  if (minutes < 8) return 0;
  return Math.floor(minutes / 15) + (minutes % 15 >= 8 ? 1 : 0);
}

export function codeFor(
  discipline: Discipline,
  setting: Setting,
  attendance: Attendance,
  minutes: number | null,
): { cpt: string | null; units: number } {
  if (attendance !== "present" || !minutes) return { cpt: null, units: 0 };
  if (discipline === "slp") return { cpt: setting === "group" ? "92508" : "92507", units: 1 };
  if (setting === "group") return { cpt: "97150", units: 1 };
  const units = timedUnits(minutes);
  if (units === 0) return { cpt: null, units: 0 };
  return { cpt: discipline === "ot" ? "97530" : "97110", units };
}
