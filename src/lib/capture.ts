import { today } from "./dates";
import { splitGroupDictation } from "./engine/group";
import { uid } from "./ids";
import { draftNote } from "./draft";
import { audit, createEncounter, encounterForSlot, getDistrict, getStudent, goalsFor, servicesFor } from "./repo";
import { rulePack } from "./rules";
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
  timeStart?: string;
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
  const pack = rulePack(getDistrict(user.district_id).settings.state);
  const enteredStart = /^\d{2}:\d{2}$/.test(input.timeStart ?? "") ? input.timeStart! : /^\d{2}:\d{2}$/.test(input.start) ? input.start : null;
  const note = await draftNote({ transcript, discipline: user.discipline, goals: goalsFor(input.studentId), scheduledSetting: setting, enteredMinutes, enteredAttendance, enteredStart, pack, assistant: user.role === "assistant" });
  const enc = createEncounter({ studentId: input.studentId, providerId: user.id, date, start: input.start, transcript, note });
  audit(user.id, "draft.created", "encounter", enc.id, { engine: note.engine, minutes_source: note.minutes_source });
  return { id: enc.id };
}

export type GroupCaptureInput = {
  studentIds: string[];
  absentIds: string[];
  date: string;
  start: string;
  transcript: string;
  minutes: string;
};

export async function createGroupDraft(user: User, input: GroupCaptureInput): Promise<{ groupKey: string; ids: string[] } | { error: string }> {
  if (!user.discipline) return { error: "not-a-provider" };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : today();
  if (date > today()) return { error: "future" };
  const ids = [...new Set(input.studentIds)].slice(0, 12);
  if (ids.length < 2) return { error: "group-too-small" };
  const students = ids.map((id) => getStudent(id));
  if (students.some((s) => !s || s.district_id !== user.district_id || !servicesFor(s.id).some((sv) => sv.provider_id === user.id))) return { error: "not-on-caseload" };
  const members = students.map((s) => ({ id: s!.id, firstName: s!.first_name }));
  const split = splitGroupDictation(input.transcript, members);
  const absent = new Set([...split.absent, ...input.absentIds.filter((id) => ids.includes(id))]);
  const minutesRaw = input.minutes.trim();
  const enteredMinutes = minutesRaw && /^\d+$/.test(minutesRaw) ? Math.min(240, Number(minutesRaw)) : null;
  const presentCount = ids.length - absent.size;
  const groupKey = uid("grp");
  const created: string[] = [];
  for (const s of students) {
    const student = s!;
    if (input.start && encounterForSlot(user.id, student.id, date, input.start)) continue;
    const isAbsent = absent.has(student.id);
    const own = split.byStudent[student.id] ?? "";
    const transcript = isAbsent ? `${student.first_name} was absent.` : [split.shared, own].filter(Boolean).join(" ");
    const note = await draftNote({
      transcript,
      discipline: user.discipline,
      goals: goalsFor(student.id),
      pack: rulePack(getDistrict(user.district_id).settings.state),
      assistant: user.role === "assistant",
      enteredStart: /^\d{2}:\d{2}$/.test(input.start) ? input.start : null,
      scheduledSetting: "group",
      enteredMinutes: isAbsent ? null : enteredMinutes,
      enteredAttendance: isAbsent ? "student_absent" : null,
    });
    if (!isAbsent) {
      note.setting = "group";
      if (!note.group_size || note.group_size < 2) note.group_size = presentCount >= 2 ? presentCount : null;
      if (!own) note.uncertain.push(`The dictation did not mention ${student.first_name} by name. Add their goal data.`);
      note.uncertain = note.uncertain.filter((u) => !u.startsWith("Group session but group size"));
    }
    const enc = createEncounter({ studentId: student.id, providerId: user.id, date, start: input.start, transcript, note, groupKey });
    audit(user.id, "draft.created", "encounter", enc.id, { engine: note.engine, group: groupKey });
    created.push(enc.id);
  }
  if (!created.length) return { error: "already-logged" };
  return { groupKey, ids: created };
}
