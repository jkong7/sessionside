import { businessDaysBetween, today, weekStart } from "./dates";
import { weekReport } from "./minutes";
import { assistantsOf, encountersFor, getDistrict } from "./repo";
import { evaluate } from "./status";
import type { User } from "./types";

export type Digest = {
  subject: string;
  lines: string[];
  urgent: boolean;
  counts: { toSign: number; dueToday: number; overdue: number; blocked: number; unlogged: number; owed: number; toCosign: number; credential: string | null };
};

export function buildDigest(user: User, baseUrl = "https://app.sessionside.test"): Digest {
  const t = today();
  const deadline = getDistrict(user.district_id).settings.signatureDeadlineDays;
  const drafts = encountersFor({ providerIds: [user.id], status: ["draft"] }).map(evaluate);
  const dueToday = drafts.filter((e) => businessDaysBetween(e.date, t) === deadline).length;
  const overdue = drafts.filter((e) => businessDaysBetween(e.date, t) > deadline).length;
  const blocked = drafts.filter((e) => e.state === "blocked").length;
  const report = weekReport({ districtId: user.district_id, providerIds: [user.id], weekStart: weekStart(t), today: t });
  const toCosign = encountersFor({ providerIds: assistantsOf(user.id).map((a) => a.id), status: ["cosign_pending"] }).length;
  const credential = drafts.flatMap((e) => e.issues).find((i) => i.code === "LICENSE_EXPIRING" || i.code === "PROVIDER_NPI_INVALID" || i.code === "LICENSE_EXPIRED")?.message ?? null;

  const lines: string[] = [];
  if (drafts.length) lines.push(`${drafts.length} note${drafts.length > 1 ? "s" : ""} to sign${dueToday ? `, ${dueToday} due today` : ""}${overdue ? `, ${overdue} past the deadline` : ""}.`);
  if (blocked) lines.push(`${blocked} session${blocked > 1 ? "s" : ""} blocked from billing. Open Sessionside to see why.`);
  if (report.totals.unloggedSessions) lines.push(`${report.totals.unloggedSessions} scheduled session${report.totals.unloggedSessions > 1 ? "s" : ""} this week with no record.`);
  if (report.totals.owed) lines.push(`${report.totals.owed} IEP minutes still owed this week after scheduled sessions.`);
  if (toCosign) lines.push(`${toCosign} assistant note${toCosign > 1 ? "s" : ""} waiting for your co-sign.`);
  if (credential) lines.push(credential);
  if (!lines.length) lines.push("You are caught up. Nothing needs you today.");
  lines.push(`Review: ${baseUrl}/review`);

  const urgent = dueToday + overdue > 0;
  const subject = urgent ? `Sessionside: ${dueToday + overdue} note${dueToday + overdue > 1 ? "s" : ""} due for signature` : drafts.length ? `Sessionside: ${drafts.length} note${drafts.length > 1 ? "s" : ""} to sign` : "Sessionside: all caught up";
  return { subject, lines, urgent, counts: { toSign: drafts.length, dueToday, overdue, blocked, unlogged: report.totals.unloggedSessions, owed: report.totals.owed, toCosign, credential } };
}
