import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { claimsReport } from "@/lib/claims";
import { addDays, formatDate, today } from "@/lib/dates";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const r = claimsReport(user, valid(sp.from) ?? addDays(today(), -30), valid(sp.to) ?? today());

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
          <p className="text-sm text-ink-3">{formatDate(r.from)} to {formatDate(r.to)}. Only signed sessions that pass every check are exported.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label>From<input type="date" name="from" defaultValue={r.from} className="field mt-0.5" /></label>
          <label>To<input type="date" name="to" defaultValue={r.to} className="field mt-0.5" /></label>
          <button className="btn-ghost" type="submit">Apply</button>
          <Link className="btn-ghost" href={`/claims/binder?from=${r.from}&to=${r.to}`}>Audit binder</Link>
          <a className="btn-primary" href={`/api/claims?from=${r.from}&to=${r.to}`}>Export CSV ({r.lines.length})</a>
        </form>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label="Ready to claim" value={money(r.billableValue)} sub={`${r.lines.length} sessions`} tone="ok" />
        <Tile label="Waiting on a signature" value={money(r.pendingValue)} sub={`${r.pendingCount} sessions`} />
        <Tile label="Blocked" value={money(r.blockedValue)} sub={`${r.blockedCount} sessions`} tone="block" />
      </section>

      {r.reasons.length > 0 && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold">What is blocking claims</h2>
          <ul className="mt-3 divide-y divide-line">
            {r.reasons.map((x) => (
              <li key={x.code} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium">{x.message}</p>
                  <p className="text-xs text-ink-3">{x.fix}</p>
                </div>
                <p className="text-right"><span className="font-semibold text-block">{money(x.value)}</span> <span className="text-xs text-ink-3">{x.count} session{x.count > 1 ? "s" : ""}</span></p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs text-ink-3">
            <tr>
              <th className="p-3">Date</th><th className="p-3">Student</th><th className="p-3">Medicaid ID</th><th className="p-3">Provider</th><th className="p-3">Code</th><th className="p-3 text-right">Units</th><th className="p-3 text-right">Min</th><th className="p-3 text-right">Est.</th>
            </tr>
          </thead>
          <tbody>
            {r.lines.map((l) => (
              <tr key={l.encounterId} className="border-t border-line">
                <td className="p-3"><Link className="text-brand hover:underline" href={`/review/${l.encounterId}`}>{l.date}</Link></td>
                <td className="p-3">{l.studentName}</td>
                <td className="p-3 font-mono text-xs">{l.medicaidId}</td>
                <td className="p-3">{l.providerName}</td>
                <td className="p-3 font-mono text-xs">{l.cpt}</td>
                <td className="p-3 text-right">{l.units}</td>
                <td className="p-3 text-right">{l.minutes}</td>
                <td className="p-3 text-right">{money(l.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-ink-4">Estimates use the demo district fee schedule. Place of service 03 (school). Export feeds the district&apos;s claiming vendor; Sessionside does not submit to Medicaid.</p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "ok" | "block" }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "ok" ? "text-ok" : tone === "block" ? "text-block" : ""}`}>{value}</p>
      <p className="text-xs text-ink-4">{sub}</p>
    </div>
  );
}
