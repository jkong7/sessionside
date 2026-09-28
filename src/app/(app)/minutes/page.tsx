import Link from "next/link";
import { MinutesTabs } from "@/components/MinutesTabs";
import { requireUser } from "@/lib/auth";
import { addDays, formatDate, today, weekStart } from "@/lib/dates";
import { weekReport } from "@/lib/minutes";
import { assistantsOf, listUsers } from "@/lib/repo";

const DISC: Record<string, string> = { slp: "Speech", ot: "OT", pt: "PT" };
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function MinutesPage({ searchParams }: { searchParams: Promise<{ week?: string; provider?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const current = weekStart(today());
  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) && sp.week <= current ? weekStart(sp.week) : current;
  const providers = listUsers(user.district_id).filter((u) => u.role !== "coordinator");
  let providerIds: string[] | undefined;
  if (user.role === "coordinator") providerIds = sp.provider ? [sp.provider] : undefined;
  else providerIds = [user.id, ...assistantsOf(user.id).map((a) => a.id)];
  const report = weekReport({ districtId: user.district_id, providerIds, weekStart: week, today: today() });
  const t = report.totals;
  const q = (w: string) => `/minutes?week=${w}${sp.provider ? `&provider=${sp.provider}` : ""}`;

  return (
    <div className="space-y-6">
      <MinutesTabs active="week" />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IEP minutes</h1>
          <p className="text-sm text-ink-3">Week of {formatDate(report.weekStart)} to {formatDate(report.weekEnd)}. Mandated vs delivered vs claimable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === "coordinator" && (
            <form className="flex gap-2">
              <input type="hidden" name="week" value={week} />
              <select name="provider" defaultValue={sp.provider ?? ""} className="field w-48">
                <option value="">All providers</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn-ghost" type="submit">Filter</button>
            </form>
          )}
          <Link className="btn-ghost" href={q(addDays(week, -7))}>Previous week</Link>
          {week < current && <Link className="btn-ghost" href={q(addDays(week, 7))}>Next week</Link>}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Minutes delivered" value={`${t.delivered} / ${t.mandated}`} sub="of IEP-mandated minutes" />
        <Tile label="Minutes still owed" value={String(t.owed)} sub="after remaining scheduled sessions" tone={t.owed ? "block" : "ok"} />
        <Tile label="Sessions never logged" value={String(t.unloggedSessions)} sub="scheduled, past, no record" tone={t.unloggedSessions ? "block" : "ok"} />
        <Tile label="Claims blocked" value={money(t.blockedValue)} sub={`${money(t.billableValue)} ready to claim`} tone={t.blockedValue ? "warn" : "ok"} />
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-3">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Service</th>
              <th className="p-3">Provider</th>
              <th className="p-3">Progress</th>
              <th className="p-3 text-right">Billable</th>
              <th className="p-3 text-right">Owed</th>
              <th className="p-3">Needs attention</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => {
              const pct = Math.min(100, Math.round((r.delivered / r.mandated) * 100));
              const sched = Math.min(100 - pct, Math.round((r.remaining / r.mandated) * 100));
              return (
                <tr key={`${r.student.id}-${r.discipline}`} className="border-t border-line align-top">
                  <td className="p-3 font-medium">
                    <Link href={`/students/${r.student.id}`} className="hover:underline">{r.student.first_name} {r.student.last_name}</Link>
                  </td>
                  <td className="p-3">{DISC[r.discipline]} {r.mandated} min</td>
                  <td className="p-3 text-ink-3">{r.provider.name}</td>
                  <td className="p-3">
                    <div className="flex h-2 w-40 overflow-hidden rounded-full bg-sunken" title={`${r.delivered} delivered, ${r.remaining} scheduled`}>
                      <div className="bg-brand" style={{ width: `${pct}%` }} />
                      <div className="bg-brand-100" style={{ width: `${sched}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-ink-3">{r.delivered} delivered{r.remaining ? `, ${r.remaining} scheduled` : ""}</p>
                  </td>
                  <td className="p-3 text-right">{r.billable}</td>
                  <td className={`p-3 text-right font-semibold ${r.owed ? "text-block" : "text-ok"}`}>{r.owed}</td>
                  <td className="p-3 text-xs">
                    <ul className="space-y-0.5">
                      {r.unlogged.map((u) => (
                        <li key={u.date + u.start} className="text-block">
                          Not logged: {formatDate(u.date)} {u.start}{" "}
                          {r.provider.id === user.id && (
                            <Link className="text-brand underline" href={`/capture?student=${r.student.id}&date=${u.date}&start=${u.start}&scheduled=${u.minutes}`}>log it</Link>
                          )}
                        </li>
                      ))}
                      {r.blockedMinutes > 0 && <li className="text-warn">{r.blockedMinutes} min delivered but blocked from billing</li>}
                      {r.pendingMinutes > 0 && <li className="text-brand">{r.pendingMinutes} min waiting on a signature or co-sign</li>}
                      {r.makeups > 0 && <li className="text-ink-3">{r.makeups} missed for provider or closure, make-up needed</li>}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-ink-4">Dollar values use the demo district fee schedule and are estimates.</p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "block" | "warn" | "ok" }) {
  const color = tone === "block" ? "text-block" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : "";
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-ink-4">{sub}</p>
    </div>
  );
}
