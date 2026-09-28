"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/dates";
import { draftNote } from "@/lib/draft";
import { audit, createEncounter, encounterForSlot, goalsFor, servicesFor } from "@/lib/repo";
import type { Attendance, Setting } from "@/lib/types";

const ATTENDANCE = new Set(["present", "student_absent", "provider_absent", "school_closed"]);

export async function captureSession(formData: FormData) {
  const user = await requireUser();
  if (!user.discipline) redirect("/minutes");
  const studentId = String(formData.get("studentId") ?? "");
  const date = String(formData.get("date") || today());
  const start = String(formData.get("start") ?? "");
  const transcript = String(formData.get("transcript") ?? "").trim();
  const minutesRaw = String(formData.get("minutes") ?? "").trim();
  const attendanceRaw = String(formData.get("attendance") ?? "");
  const service = servicesFor(studentId).find((s) => s.provider_id === user.id || (s.discipline === user.discipline && user.role === "assistant"));
  if (!service) redirect("/today?error=not-on-caseload");
  if (date > today()) redirect("/today?error=future");
  if (start) {
    const existing = encounterForSlot(user.id, studentId, date, start);
    if (existing) redirect(`/review/${existing.id}`);
  }
  const enteredMinutes = minutesRaw ? Math.max(0, Math.min(240, Number(minutesRaw))) : null;
  const enteredAttendance = ATTENDANCE.has(attendanceRaw) && attendanceRaw !== "present" ? (attendanceRaw as Attendance) : null;
  const note = await draftNote({
    transcript: transcript || (enteredAttendance ? "" : ""),
    discipline: user.discipline,
    goals: goalsFor(studentId),
    scheduledSetting: (String(formData.get("setting") || service.setting) as Setting) ?? "individual",
    enteredMinutes,
    enteredAttendance,
  });
  const enc = createEncounter({ studentId, providerId: user.id, date, start, transcript, note });
  audit(user.id, "draft.created", "encounter", enc.id, { engine: note.engine, minutes_source: note.minutes_source });
  redirect(`/review/${enc.id}`);
}
