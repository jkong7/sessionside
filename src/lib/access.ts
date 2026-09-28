import type { Encounter, User } from "./types";
import { getStudent, getUser } from "./repo";

type EncRef = Pick<Encounter, "provider_id" | "student_id">;

function sameDistrict(user: User, enc: EncRef): boolean {
  return getStudent(enc.student_id)?.district_id === user.district_id;
}

export function canView(user: User, enc: EncRef): boolean {
  if (!sameDistrict(user, enc)) return false;
  if (enc.provider_id === user.id) return true;
  if (user.role === "coordinator") return true;
  return getUser(enc.provider_id)?.supervisor_id === user.id;
}

export function canEdit(user: User, enc: EncRef & Pick<Encounter, "status">): boolean {
  return sameDistrict(user, enc) && enc.provider_id === user.id && enc.status === "draft";
}

export function canCosign(user: User, enc: EncRef & Pick<Encounter, "status">): boolean {
  if (enc.status !== "cosign_pending" || !sameDistrict(user, enc)) return false;
  return getUser(enc.provider_id)?.supervisor_id === user.id;
}
