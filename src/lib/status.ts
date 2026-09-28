import { billability, checkEncounter, type Billability, type Issue } from "./checks";
import { contextFor } from "./repo";
import type { Encounter } from "./types";

export type Evaluated = Encounter & { issues: Issue[]; state: Billability };

export function evaluate(enc: Encounter): Evaluated {
  const ctx = contextFor(enc);
  const issues = checkEncounter(ctx);
  return { ...enc, issues, state: billability(ctx, issues) };
}

export const STATE_STYLE: Record<Billability, string> = {
  billable: "bg-ok-50 text-ok",
  ready_to_sign: "bg-brand-50 text-brand",
  awaiting_cosign: "bg-warn-50 text-warn",
  blocked: "bg-block-50 text-block",
  not_billable: "bg-sunken text-ink-3",
};
