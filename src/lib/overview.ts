import { addDays, weekday } from "./dates";
import { claimValue } from "./minutes";
import { encountersFor, getDistrict, listUsers, slotsForProvider } from "./repo";
import { evaluate } from "./status";
import type { User } from "./types";

export type ProviderStats = {
  provider: User;
  scheduled: number;
  logged: number;
  delivered: number;
  claimable: number;
  blocked: number;
  pending: number;
  claimableValue: number;
  blockedValue: number;
};

export function overview(districtId: string, from: string, to: string) {
  const rates = getDistrict(districtId).settings.rates;
  const providers = listUsers(districtId).filter((u) => u.role !== "coordinator");
  const stats: ProviderStats[] = providers.map((p) => {
    const slots = slotsForProvider(p.id);
    let scheduled = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) scheduled += slots.filter((s) => s.weekday === weekday(d)).length;
    const encs = encountersFor({ providerIds: [p.id], from, to }).map(evaluate);
    const delivered = encs.filter((e) => e.note.attendance === "present");
    const claimable = delivered.filter((e) => e.state === "billable");
    const blocked = delivered.filter((e) => e.state === "blocked");
    return {
      provider: p,
      scheduled,
      logged: encs.filter((e) => e.start).length,
      delivered: delivered.length,
      claimable: claimable.length,
      blocked: blocked.length,
      pending: delivered.filter((e) => e.state === "ready_to_sign" || e.state === "awaiting_cosign").length,
      claimableValue: claimable.reduce((n, e) => n + claimValue(e, rates), 0),
      blockedValue: blocked.reduce((n, e) => n + claimValue(e, rates), 0),
    };
  });
  const sum = (f: (s: ProviderStats) => number) => stats.reduce((n, s) => n + f(s), 0);
  const totals = {
    scheduled: sum((s) => s.scheduled),
    logged: sum((s) => s.logged),
    delivered: sum((s) => s.delivered),
    claimable: sum((s) => s.claimable),
    blocked: sum((s) => s.blocked),
    pending: sum((s) => s.pending),
    claimableValue: sum((s) => s.claimableValue),
    blockedValue: sum((s) => s.blockedValue),
  };
  return {
    stats,
    totals,
    documentationRate: totals.scheduled ? totals.logged / totals.scheduled : 0,
    captureRate: totals.delivered ? totals.claimable / totals.delivered : 0,
  };
}
