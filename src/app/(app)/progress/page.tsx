import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { currentQuarter, daysLeft, quarters } from "@/lib/periods";
import { summarizeGoal } from "@/lib/progressReport";
import { caseload, encountersFor, findProgressReport, goalsFor } from "@/lib/repo";

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = today();
  const all = quarters(t);
  const period = all.find((q) => q.key === sp.q) ?? currentQuarter(t);
  const rows = caseload(user.id).map((s) => {
    const goals = goalsFor(s.id).filter((g) => g.discipline === user.discipline);
    const encs = encountersFor({ studentId: s.id, from: period.from, to: period.to });
    const withData = goals.filter((g) => summarizeGoal(g, encs, period.from, period.to).sessions >= 2).length;
    const report = user.discipline ? findProgressReport(s.id, user.discipline, period.from, period.to) : null;
    return { s, goals: goals.length, withData, report };
  });
  const done = rows.filter((r) => r.report?.status === "final").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progress reports</h1>
          <p className="text-sm text-ink-3">
            {period.label}: {formatDate(period.from)} to {formatDate(period.to)}. {done} of {rows.length} finalized{period.to >= t ? `, ${daysLeft(period, t)} days left` : ""}.
          </p>
        </div>
        <nav aria-label="Reporting period" className="flex flex-wrap gap-1.5">
          {all.map((q) => (
            <Link key={q.key} href={`/progress?q=${q.key}`} aria-current={q.key === period.key ? "page" : undefined} className={`chip border px-3 py-1 text-sm ${q.key === period.key ? "border-brand bg-brand-50 text-brand" : "border-line text-ink-2"}`}>
              {q.label.split(" ")[0]}
            </Link>
          ))}
        </nav>
      </header>
      <p className="text-sm text-ink-3">IDEA requires periodic reports on progress toward each IEP goal (34 CFR 300.320(a)(3)). Sessionside drafts them from your signed session data; you review, edit, and sign.</p>
      <section className="card divide-y divide-line">
        {rows.map(({ s, goals, withData, report }) => (
          <Link key={s.id} href={`/progress/${s.id}?q=${period.key}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-sunken">
            <div>
              <p className="font-medium">{s.last_name}, {s.first_name}</p>
              <p className="text-xs text-ink-3">{withData} of {goals} goals have enough data</p>
            </div>
            <span className={`chip ${report?.status === "final" ? "bg-ok-50 text-ok" : report ? "bg-brand-50 text-brand" : "bg-sunken text-ink-3"}`}>
              {report?.status === "final" ? "Finalized" : report ? "Draft saved" : "Not started"}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
