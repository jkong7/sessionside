import { currentUser } from "@/lib/auth";
import { claimsReport, toCsv } from "@/lib/claims";
import { audit } from "@/lib/repo";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const report = claimsReport(user, from, to);
  audit(user.id, "claims.exported", "district", user.district_id, { from: report.from, to: report.to, lines: report.lines.length });
  return new Response(toCsv(report.lines), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sessionside-claims-${report.from}-to-${report.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
