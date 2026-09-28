"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canCosign, canEdit } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { codeFor } from "@/lib/engine/cpt";
import { addAddendum, audit, deleteEncounter, encountersFor, getEncounter, goalsFor, markCosigned, markSigned, updateEncounterNote } from "@/lib/repo";
import { evaluate } from "@/lib/status";
import type { Attendance, GoalData, Note, Setting } from "@/lib/types";
import { validateNote } from "@/lib/validate";
import { canView } from "@/lib/access";

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function saveNote(id: string, formData: FormData) {
  const user = await requireUser();
  const enc = getEncounter(id);
  if (!enc || !canEdit(user, enc) || !user.discipline) redirect("/review");
  const attendance = String(formData.get("attendance") ?? enc.note.attendance) as Attendance;
  const setting = String(formData.get("setting") ?? enc.note.setting) as Setting;
  const minutes = attendance === "present" ? num(formData.get("minutes")) : 0;
  const goals: GoalData[] = [];
  for (const g of goalsFor(enc.student_id).filter((x) => x.discipline === user.discipline)) {
    const correct = num(formData.get(`goal_${g.id}_correct`));
    const trials = num(formData.get(`goal_${g.id}_trials`));
    let percent = num(formData.get(`goal_${g.id}_percent`));
    const cue = String(formData.get(`goal_${g.id}_cue`) ?? "").trim() || null;
    if (correct != null && trials && percent == null) percent = Math.round((correct / trials) * 100);
    if (percent == null && cue == null) continue;
    const prev = enc.note.goals.find((x) => x.goal_id === g.id);
    goals.push({ goal_id: g.id, correct, trials, percent, cue, evidence: prev?.evidence ?? "Entered on review" });
  }
  const { cpt, units } = codeFor(user.discipline, setting, attendance, minutes);
  const lines = (k: string) =>
    String(formData.get(k) ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  const note: Note = {
    ...enc.note,
    summary: String(formData.get("summary") ?? enc.note.summary).trim(),
    activities: lines("activities"),
    response: String(formData.get("response") ?? "").trim(),
    plan: String(formData.get("plan") ?? "").trim(),
    goals,
    minutes,
    minutes_source: minutes == null ? "missing" : minutes === enc.note.minutes && enc.note.minutes_source !== "missing" ? enc.note.minutes_source : "entered",
    setting,
    group_size: setting === "group" ? num(formData.get("group_size")) : null,
    attendance,
    cpt,
    units,
    uncertain: [],
  };
  const errors = validateNote(note);
  if (errors.length) redirect(`/review/${id}?invalid=${encodeURIComponent(errors.join(" "))}`);
  updateEncounterNote(id, note);
  audit(user.id, "note.edited", "encounter", id, { minutes, cpt, goals: goals.length });
  revalidatePath(`/review/${id}`);
  redirect(`/review/${id}?saved=1`);
}

export async function signNote(id: string, formData: FormData) {
  const user = await requireUser();
  const enc = getEncounter(id);
  if (!enc || !canEdit(user, enc)) redirect("/review");
  if (formData.get("attest") !== "on") redirect(`/review/${id}?error=attest`);
  if (enc.note.attendance === "present" && (enc.note.minutes == null || enc.note.minutes_source === "missing")) redirect(`/review/${id}?error=minutes`);
  const status = user.role === "assistant" ? "cosign_pending" : "signed";
  markSigned(id, user.id, status);
  audit(user.id, "note.signed", "encounter", id, { attestation: attestationText(user.name, enc.date), status });
  redirect(String(formData.get("next") || "/review"));
}

export async function cosignNote(id: string, formData: FormData) {
  const user = await requireUser();
  const enc = getEncounter(id);
  if (!enc || !canCosign(user, enc)) redirect("/review");
  if (formData.get("attest") !== "on") redirect(`/review/${id}?error=attest`);
  markCosigned(id, user.id);
  audit(user.id, "note.cosigned", "encounter", id, { attestation: `${user.name} reviewed this note as supervising clinician.` });
  redirect("/review");
}

export async function signAllClean(formData: FormData) {
  const user = await requireUser();
  if (formData.get("attest") !== "on") redirect("/review?error=attest");
  const drafts = encountersFor({ providerIds: [user.id], status: ["draft"] }).map(evaluate);
  const clean = drafts.filter((e) => e.state === "ready_to_sign" && e.issues.length === 0 && e.note.uncertain.length === 0);
  const status = user.role === "assistant" ? "cosign_pending" : "signed";
  for (const e of clean) {
    markSigned(e.id, user.id, status);
    audit(user.id, "note.signed", "encounter", e.id, { attestation: attestationText(user.name, e.date), status, batch: true });
  }
  redirect(`/review?signed=${clean.length}`);
}

export async function discardDraft(id: string) {
  const user = await requireUser();
  const enc = getEncounter(id);
  if (!enc || !canEdit(user, enc)) redirect("/review");
  deleteEncounter(id);
  audit(user.id, "draft.discarded", "encounter", id, { date: enc.date, student_id: enc.student_id });
  redirect("/today");
}

export async function addendumAction(id: string, formData: FormData) {
  const user = await requireUser();
  const enc = getEncounter(id);
  if (!enc || enc.status === "draft" || !canView(user, enc) || user.role === "coordinator") redirect("/review");
  const text = String(formData.get("text") ?? "").trim().slice(0, 4000);
  if (!text) redirect(`/review/${id}`);
  const addendumId = addAddendum(id, user.id, text);
  audit(user.id, "note.addendum", "encounter", id, { addendum: addendumId });
  redirect(`/review/${id}`);
}

function attestationText(name: string, date: string): string {
  return `${name} attests they personally provided this service on ${date} and the documentation is accurate.`;
}
