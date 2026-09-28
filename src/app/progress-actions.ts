"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/dates";
import { quarters } from "@/lib/periods";
import { RATING_LABEL } from "@/lib/progressReport";
import { audit, findProgressReport, getStudent, goalsFor, servicesFor, upsertProgressReport, type ProgressEntry } from "@/lib/repo";

export async function saveProgressReport(studentId: string, periodKey: string, formData: FormData) {
  const user = await requireUser();
  const student = getStudent(studentId);
  const period = quarters(today()).find((q) => q.key === periodKey);
  if (!student || !period || !user.discipline || student.district_id !== user.district_id || !servicesFor(studentId).some((s) => s.provider_id === user.id)) redirect("/progress");
  const existing = findProgressReport(studentId, user.discipline, period.from, period.to);
  if (existing?.status === "final") redirect(`/progress/${studentId}?q=${periodKey}`);
  const final = formData.get("intent") === "final";
  if (final && formData.get("attest") !== "on") redirect(`/progress/${studentId}?q=${periodKey}&error=attest`);
  const content: ProgressEntry[] = goalsFor(studentId)
    .filter((g) => g.discipline === user.discipline)
    .map((g) => {
      const rating = String(formData.get(`rating_${g.id}`) ?? "not_enough_data");
      return {
        goal_id: g.id,
        rating: rating in RATING_LABEL ? rating : "not_enough_data",
        narrative: String(formData.get(`narrative_${g.id}`) ?? "").trim().slice(0, 3000),
      };
    });
  const id = upsertProgressReport({ studentId, providerId: user.id, discipline: user.discipline, from: period.from, to: period.to, content, final });
  audit(user.id, final ? "progress.finalized" : "progress.saved", "progress_report", id, { period: periodKey });
  redirect(`/progress/${studentId}?q=${periodKey}${final ? "" : "&saved=1"}`);
}
