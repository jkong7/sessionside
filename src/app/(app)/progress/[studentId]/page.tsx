import Link from "next/link";
import { notFound } from "next/navigation";
import { saveProgressReport } from "@/app/progress-actions";
import { PrintButton } from "@/components/PrintButton";
import { requireUser } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { currentQuarter, quarters } from "@/lib/periods";
import { RATING_LABEL, summarizeGoal, type ProgressRating } from "@/lib/progressReport";
import { encountersFor, findProgressReport, getDistrict, getStudent, getUser, goalsFor, servicesFor } from "@/lib/repo";

const DISC: Record<string, string> = { slp: "Speech-Language", ot: "Occupational Therapy", pt: "Physical Therapy" };

export default async function StudentProgress({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ q?: string; saved?: string; error?: string }> }) {
  const user = await requireUser();
  const { studentId } = await params;
  const sp = await searchParams;
  const s = getStudent(studentId);
  if (!s || s.district_id !== user.district_id || !user.discipline || !servicesFor(studentId).some((sv) => sv.provider_id === user.id)) notFound();
  const period = quarters(today()).find((q) => q.key === sp.q) ?? currentQuarter(today());
  const goals = goalsFor(studentId).filter((g) => g.discipline === user.discipline);
  const encs = encountersFor({ studentId, from: period.from, to: period.to });
  const summaries = goals.map((g) => summarizeGoal(g, encs, period.from, period.to));
  const report = findProgressReport(studentId, user.discipline, period.from, period.to);
  const final = report?.status === "final";
  const saved = new Map(report?.content.map((c) => [c.goal_id, c]) ?? []);
  const district = getDistrict(user.district_id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/progress?q=${period.key}`} className="text-sm text-brand print:hidden">Back to progress reports</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-3">{district.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">IEP Progress Report: {DISC[user.discipline]}</h1>
          <p className="text-sm text-ink-3">
            {s.first_name} {s.last_name}, grade {s.grade}, {s.school}. {period.label}, {formatDate(period.from)} to {formatDate(period.to)}.
          </p>
        </div>
        {final && <PrintButton />}
      </header>
      {sp.saved && <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok print:hidden">Draft saved.</p>}
      {sp.error === "attest" && <p role="alert" className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">Check the attestation box to finalize.</p>}

      {final ? (
        <article className="card space-y-4 p-5">
          {goals.map((g) => {
            const c = saved.get(g.id);
            return (
              <section key={g.id}>
                <h2 className="font-semibold">{g.area}</h2>
                <p className="text-sm text-ink-3">Goal: {g.text}</p>
                <p className="mt-1 text-sm font-medium">{RATING_LABEL[(c?.rating ?? "not_enough_data") as ProgressRating]}</p>
                <p className="mt-1 text-sm">{c?.narrative}</p>
              </section>
            );
          })}
          <p className="border-t border-line pt-3 text-sm text-ink-3">
            Signed by {getUser(report!.provider_id)?.name}, {getUser(report!.provider_id)?.credential}, on {new Date(report!.signed_at!).toLocaleDateString()}.
          </p>
        </article>
      ) : (
        <form action={saveProgressReport.bind(null, studentId, period.key)} className="space-y-4">
          {summaries.map((sum) => {
            const c = saved.get(sum.goal.id);
            return (
              <section key={sum.goal.id} className="card space-y-3 p-4">
                <div>
                  <h2 className="font-semibold">{sum.goal.area}</h2>
                  <p className="text-sm text-ink-3">Goal: {sum.goal.text}</p>
                </div>
                <div className="flex h-14 items-end gap-1" aria-hidden="true">
                  {encs
                    .filter((e) => e.status !== "draft" && e.note.attendance === "present")
                    .flatMap((e) => e.note.goals.filter((x) => x.goal_id === sum.goal.id && x.percent != null).map((x) => ({ d: e.date, p: x.percent as number })))
                    .sort((a, b) => a.d.localeCompare(b.d))
                    .map((pt, i) => (
                      <div key={i} className="w-3 rounded-t bg-brand/70" style={{ height: `${Math.max(4, pt.p)}%` }} title={`${pt.d}: ${pt.p}%`} />
                    ))}
                </div>
                <p className="text-xs text-ink-3">{sum.sessions} signed sessions with data. Target {sum.target}%.{sum.recentAvg != null ? ` Recent average ${sum.recentAvg}%.` : ""}</p>
                <label className="block text-sm font-medium">
                  Progress
                  <select name={`rating_${sum.goal.id}`} defaultValue={c?.rating ?? sum.rating} className="field mt-1">
                    {Object.entries(RATING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Narrative
                  <textarea name={`narrative_${sum.goal.id}`} defaultValue={c?.narrative ?? sum.narrative} rows={3} className="field mt-1" />
                </label>
              </section>
            );
          })}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="attest" className="mt-1" />
              <span>I reviewed this report and it accurately reflects the student&apos;s progress.</span>
            </label>
            <div className="flex gap-2">
              <button className="btn-ghost" type="submit" name="intent" value="draft">Save draft</button>
              <button className="btn-primary" type="submit" name="intent" value="final">Finalize and sign</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
