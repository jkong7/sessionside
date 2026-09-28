import { currentUser } from "@/lib/auth";
import { csvCell, scopeProviders } from "@/lib/claims";
import { addDays, today } from "@/lib/dates";
import { profilesFor, rowsFor } from "@/lib/exportProfiles";
import { audit, encountersFor, getDistrict, goalsFor } from "@/lib/repo";
import { evaluate } from "@/lib/status";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const valid = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const from = valid(url.searchParams.get("from")) ?? addDays(today(), -7);
  const to = valid(url.searchParams.get("to")) ?? today();
  const profile = profilesFor(getDistrict(user.district_id).settings).find((p) => p.id === url.searchParams.get("profile"));
  if (!profile) return new Response("Unknown profile", { status: 400 });
  const encs = encountersFor({ providerIds: scopeProviders(user), from, to }).map(evaluate);
  const goalNames = new Map<string, string>();
  const goalName = (id: string) => {
    if (!goalNames.has(id)) for (const e of encs) for (const g of goalsFor(e.student_id)) goalNames.set(g.id, g.area);
    return goalNames.get(id) ?? id;
  };
  const rows = rowsFor(profile, encs, goalName);
  const csv = [profile.columns.map((c) => csvCell(c.header)).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";
  audit(user.id, "export.downloaded", "district", user.district_id, { profile: profile.id, from, to, rows: rows.length });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sessionside-${profile.id}-${from}-to-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
