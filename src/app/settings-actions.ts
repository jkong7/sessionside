"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit, getDistrict, updateDistrictSettings } from "@/lib/repo";
import { RULE_PACKS, type StateCode } from "@/lib/rules";

export async function saveDistrictSettings(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "coordinator") redirect("/today");
  const district = getDistrict(user.district_id);
  const state = String(formData.get("state") ?? "");
  const deadlineRaw = String(formData.get("noteDeadlineDays") ?? "").trim();
  const deadline = deadlineRaw === "" ? undefined : Math.max(0, Math.min(30, Math.round(Number(deadlineRaw))));
  if (!(state in RULE_PACKS) || (deadline != null && Number.isNaN(deadline))) redirect("/settings?error=1");
  const settings = { ...district.settings, state: state as StateCode, noteDeadlineDays: deadline };
  updateDistrictSettings(district.id, settings);
  audit(user.id, "district.settings_changed", "district", district.id, { from: district.settings.state, to: state, noteDeadlineDays: deadline ?? null });
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
