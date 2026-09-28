import type { Encounter, User } from "./types";
import { getUser } from "./repo";

export function canView(user: User, enc: Pick<Encounter, "provider_id">): boolean {
  if (enc.provider_id === user.id) return true;
  if (user.role === "coordinator") return true;
  const provider = getUser(enc.provider_id);
  return provider?.supervisor_id === user.id;
}

export function canEdit(user: User, enc: Pick<Encounter, "provider_id" | "status">): boolean {
  return enc.provider_id === user.id && enc.status === "draft";
}

export function canCosign(user: User, enc: Pick<Encounter, "provider_id" | "status">): boolean {
  if (enc.status !== "cosign_pending") return false;
  return getUser(enc.provider_id)?.supervisor_id === user.id;
}
