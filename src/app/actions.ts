"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createDraft } from "@/lib/capture";
import { today } from "@/lib/dates";

export async function captureSession(formData: FormData) {
  const user = await requireUser();
  const result = await createDraft(user, {
    studentId: String(formData.get("studentId") ?? ""),
    date: String(formData.get("date") || today()),
    start: String(formData.get("start") ?? ""),
    transcript: String(formData.get("transcript") ?? ""),
    minutes: String(formData.get("minutes") ?? ""),
    attendance: String(formData.get("attendance") ?? ""),
    setting: String(formData.get("setting") ?? ""),
  });
  if ("error" in result) redirect(result.error === "not-a-provider" ? "/minutes" : `/today?error=${result.error}`);
  redirect(`/review/${result.id}`);
}
