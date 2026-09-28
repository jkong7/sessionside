"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { FIELD_LABELS, type ExportField, type ExportProfile } from "@/lib/exportProfiles";
import { audit, getDistrict, updateDistrictSettings } from "@/lib/repo";

export async function saveExportProfile(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "coordinator") redirect("/exports");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) redirect("/exports?error=name");
  const columns = (Object.keys(FIELD_LABELS) as ExportField[])
    .filter((f) => formData.get(`use_${f}`) === "on")
    .map((f) => ({ field: f, header: String(formData.get(`header_${f}`) || FIELD_LABELS[f]).slice(0, 60), order: Number(formData.get(`order_${f}`)) || 99 }))
    .sort((a, b) => a.order - b.order)
    .map(({ field, header }) => ({ field, header }));
  if (columns.length === 0) redirect("/exports?error=columns");
  const district = getDistrict(user.district_id);
  const profile: ExportProfile = {
    id: `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    name,
    description: "Custom profile built by your district.",
    columns,
    onlySigned: formData.get("onlySigned") === "on",
    includeAbsences: formData.get("includeAbsences") === "on",
  };
  const others = (district.settings.exportProfiles ?? []).filter((p) => p.id !== profile.id);
  updateDistrictSettings(district.id, { ...district.settings, exportProfiles: [...others, profile] });
  audit(user.id, "export.profile_saved", "district", district.id, { profile: profile.id, columns: columns.length });
  redirect("/exports?saved=1");
}
