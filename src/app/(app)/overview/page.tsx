import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { claimsReport } from "@/lib/claims";
import { addDays, formatDate, today } from "@/lib/dates";
import { overview } from "@/lib/overview";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requireUser();
  if (user.role !== "coordinator") redirect("/today");
  const sp = await searchParams;
  const days = [14, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const to = addDays(today(), -1);
  const from = addDays(today(), -days);
  const o = overview(user.district_id, from, to);
  const reasons = claimsReport(user, from, to).reasons.slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">District overview</h1>
          <p className="text-sm text-ink-3">{formatDate(from)} to {formatDate(to)}. How much delivered therapy turns into a claim that holds up.</p>
        </div>
        <nav aria-label="Time range" className="flex gap-1.5">
          {[14, 30, 90].map((d) => (
            <Link key={d} href={`/overview?days=${d}`} aria-current={d === days ? "page" : undefined} className={`chip border px-3 py-1 text-sm ${d === days ? "border-brand bg-brand-50 text-brand" : "border-line text-ink-2"}`}>
              {d} days
            </Link>
          ))}
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Documentation rate" value={pct(o.documentationRate)} sub={`${o.totals.logged} of ${o.totals.scheduled} scheduled sessions have a record`} />
        <Tile label="Claim capture rate" value={pct(o.captureRate)} sub={`${o.totals.claimable} of ${o.totals.delivered} delivered sessions are claimable`} />
        <Tile label="Ready to claim" value={money(o.totals.claimableValue)} sub="signed and passing every check" tone="ok" />
        <Tile label="Stuck behind a fix" value={money(o.totals.blockedValue)} sub={`${o.totals.blocked} sessions blocked, ${o.totals.pending} awaiting signature`} tone="block" />
      </section>

      {reasons.length > 0 && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold">Top reasons claims are blocked</h2>
          <ol className="mt-2 space-y-1 text-sm">
            {reasons.map((r) => (
              <li key={r.code} className="flex flex-wrap justify-between gap-2">
                <span>{r.message} <span className="text-ink-3">({r.count})</span></span>
                <span className="font-medium text-block">{money(r.value)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Documentation and claim capture by provider</caption>
          <thead className="border-b border-line text-xs text-ink-3">
            <tr>
              <th scope="col" className="p-3">Provider</th>
              <th scope="col" className="p-3 text-right">Scheduled</th>
              <th scope="col" className="p-3 text-right">Documented</th>
              <th scope="col" className="p-3 text-right">Delivered</th>
              <th scope="col" className="p-3 text-right">Claimable</th>
              <th scope="col" className="p-3 text-right">Blocked</th>
              <th scope="col" className="p-3 text-right">Capture</th>
            </tr>
          </thead>
          <tbody>
            {o.stats.map((s) => (
              <tr key={s.provider.id} className="border-t border-line">
                <th scope="row" className="p-3 font-medium">{s.provider.name}<span className="block text-xs font-normal text-ink-3">{s.provider.credential}</span></th>
                <td className="p-3 text-right">{s.scheduled}</td>
                <td className="p-3 text-right">{s.logged}</td>
                <td className="p-3 text-right">{s.delivered}</td>
                <td className="p-3 text-right">{s.claimable}</td>
                <td className={`p-3 text-right ${s.blocked ? "font-medium text-block" : ""}`}>{s.blocked}</td>
                <td className="p-3 text-right font-semibold">{s.delivered ? pct(s.claimable / s.delivered) : "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-ink-3">Dollar values use the district fee schedule in settings and are estimates. Cost-settled states such as Illinois reconcile to actual costs at year end.</p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "ok" | "block" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "ok" ? "text-ok" : tone === "block" ? "text-block" : ""}`}>{value}</p>
      <p className="text-xs text-ink-3">{sub}</p>
    </div>
  );
}
