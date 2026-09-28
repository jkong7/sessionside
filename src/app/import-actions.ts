"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { IMPORT_COLUMNS, runImport, type ImportKind, type ImportResult } from "@/lib/importers";
import { audit } from "@/lib/repo";

export type ImportState = { result: ImportResult | null; error: string | null };

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  if (user.role !== "coordinator") return { result: null, error: "Only district coordinators can import data." };
  const kind = String(formData.get("kind")) as ImportKind;
  if (!(kind in IMPORT_COLUMNS)) return { result: null, error: "Choose what to import." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { result: null, error: "Choose a CSV file." };
  if (file.size > 5 * 1024 * 1024) return { result: null, error: "Files must be under 5 MB." };
  const commit = formData.get("intent") === "commit";
  const result = runImport(user.district_id, kind, await file.text(), commit);
  if (result.committed) {
    audit(user.id, "import.committed", "district", user.district_id, { kind, rows: result.valid });
    revalidatePath("/", "layout");
  }
  return { result, error: null };
}
