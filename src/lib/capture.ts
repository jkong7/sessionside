import { today } from "./dates";
import { draftNote } from "./draft";
import { audit, createEncounter, encounterForSlot, goalsFor, servicesFor } from "./repo";
import type { Attendance, Setting, User } from "./types";

const ATTENDANCE = new Set(["present", "student_absent", "provider_absent", "school_closed"]);

export type CaptureInput = {
  studentId: string;
  date: string;
  start: string;
  transcript: string;
  minutes: string;
  attendance: string;
  setting: string;
};

export async function createDraft(user: User, input: CaptureInput): Promise<{ id: string; existing?: boolean } | { error: string }> {
  if (!user.discipline) return { error: "not-a-provider" };
  const service = servicesFor(input.studentId).find((s) => s.provider_id === user.id);
  if (!service) return { error: "not-on-caseload" };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : today();
  if (date > today()) return { error: "future" };
  if (input.start) {
    const existing = encounterForSlot(user.id, input.studentId, date, input.start);
    if (existing) return { id: existing.id, existing: true };
  }
  const minutesRaw = input.minutes.trim();
  const enteredMinutes = minutesRaw && /^\d+$/.test(minutesRaw) ? Math.min(240, Number(minutesRaw)) : null;
  const enteredAttendance = ATTENDANCE.has(input.attendance) && input.attendance !== "present" ? (input.attendance as Attendance) : null;
  const setting: Setting = input.setting === "group" || input.setting === "individual" ? input.setting : service.setting;
  const transcript = input.transcript.trim();
  const note = await draftNote({ transcript, discipline: user.discipline, goals: goalsFor(input.studentId), scheduledSetting: setting, enteredMinutes, enteredAttendance });
  const enc = createEncounter({ studentId: input.studentId, providerId: user.id, date, start: input.start, transcript, note });
  audit(user.id, "draft.created", "encounter", enc.id, { engine: note.engine, minutes_source: note.minutes_source });
  return { id: enc.id };
}
