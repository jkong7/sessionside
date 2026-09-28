import Link from "next/link";
import { MinutesTabs } from "@/components/MinutesTabs";
import { requireUser } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { ledgerReport } from "@/lib/ledger";
import { assistantsOf } from "@/lib/repo";

const DISC: Record<string, string> = { slp: "Speech", ot: "OT", pt: "PT" };

export default async function LedgerPage() {
  const user = await requireUser();
  const providerIds = user.role === "coordinator" ? undefined : [user.id, ...assistantsOf(user.id).map((a) => a.id)];
  const rows = ledgerReport({ districtId: user.district_id, providerIds, today: today() });
  const owing = rows.filter((r) => r.owed > 0);
  const total = owing.reduce((n, r) => n + r.owed, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <MinutesTabs active="ledger" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Make-up ledger</h1>
          <p className="text-sm text-ink-3">
            Minutes the district owes under each IEP, through the last full week. Provider absences, closures, and unlogged sessions add to the balance; student absences are excused; extra minutes pay it down.
          </p>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-ink-3">Students owed minutes</p>
          <p className={`mt-1 text-2xl font-semibold ${owing.length ? "text-block" : "text-ok"}`}>{owing.length} of {rows.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-3">Total minutes owed</p>
          <p className={`mt-1 text-2xl font-semibold ${total ? "text-block" : "text-ok"}`}>{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-3">Make-up sessions needed</p>
          <p className="mt-1 text-2xl font-semibold">{owing.reduce((n, r) => n + Math.ceil(r.owed / 30), 0)}</p>
          <p className="text-xs text-ink-4">at 30 minutes each</p>
        </div>
      </section>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Make-up minutes owed per student and service</caption>
          <thead className="border-b border-line text-xs text-ink-3">
            <tr>
              <th scope="col" className="p-3">Student</th>
              <th scope="col" className="p-3">Service</th>
              <th scope="col" className="p-3">Provider</th>
              <th scope="col" className="p-3 text-right">Weeks</th>
              <th scope="col" className="p-3 text-right">Mandated</th>
              <th scope="col" className="p-3 text-right">Delivered</th>
              <th scope="col" className="p-3 text-right">Excused</th>
              <th scope="col" className="p-3 text-right">Owed</th>
              <th scope="col" className="p-3">Recent weeks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.student.id}-${r.discipline}`} className="border-t border-line">
                <td className="p-3 font-medium"><Link className="hover:underline" href={`/students/${r.student.id}`}>{r.student.first_name} {r.student.last_name}</Link></td>
                <td className="p-3">{DISC[r.discipline]} {r.weeks[0]?.mandated ?? 0}/wk</td>
                <td className="p-3 text-ink-3">{r.provider.name}</td>
                <td className="p-3 text-right">{r.weeks.length}</td>
                <td className="p-3 text-right">{r.mandated}</td>
                <td className="p-3 text-right">{r.delivered}</td>
                <td className="p-3 text-right">{r.excused}</td>
                <td className={`p-3 text-right font-semibold ${r.owed ? "text-block" : "text-ok"}`}>{r.owed}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {r.weeks.slice(-6).map((w) => (
                      <span
                        key={w.weekStart}
                        title={`Week of ${formatDate(w.weekStart)}: ${w.delivered} delivered, ${w.excused} excused, ${w.shortfall} short`}
                        className={`size-3 rounded-sm ${w.shortfall ? "bg-block" : w.surplus ? "bg-brand" : "bg-ok"}`}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-ink-4">Whether missed services require compensatory make-up is decided by the IEP team case by case. This ledger shows the gap so the team can decide early.</p>
    </div>
  );
}
