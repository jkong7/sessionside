import Link from "next/link";
import { notFound } from "next/navigation";
import { addendumAction, cosignNote, discardDraft, saveNote, signNote } from "@/app/review-actions";
import { IssueList } from "@/components/IssueList";
import { canCosign, canEdit, canView } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { BILLABILITY_LABEL } from "@/lib/checks";
import { formatDate } from "@/lib/dates";
import { CPT_LABELS } from "@/lib/engine/cpt";
import { addendaFor, auditFor, getEncounter, getStudent, getUser, goalsFor } from "@/lib/repo";
import { evaluate, STATE_STYLE } from "@/lib/status";

const ATTENDANCE_LABEL: Record<string, string> = {
  present: "Delivered",
  student_absent: "Student absent",
  provider_absent: "Provider absent",
  school_closed: "School closed",
};

export default async function NotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string; invalid?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const raw = getEncounter(id);
  if (!raw || !canView(user, raw)) notFound();
  const e = evaluate(raw);
  const student = getStudent(e.student_id)!;
  const provider = getUser(e.provider_id)!;
  const goals = goalsFor(e.student_id).filter((g) => g.discipline === provider.discipline);
  const editable = canEdit(user, e);
  const cosignable = canCosign(user, e);
  const n = e.note;
  const trail = auditFor("encounter", e.id);
  const addenda = addendaFor(e.id);
  const canAddend = !editable && e.status !== "draft" && user.role !== "coordinator";
  const delivered = n.attendance === "present";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Link href={editable ? "/review" : "/today"} className="text-sm text-brand">Back</Link>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ink-3">{formatDate(e.date)}{e.start ? ` at ${e.start}` : ""}, {provider.name}, {provider.credential}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              <Link href={`/students/${student.id}`} className="hover:underline">{student.first_name} {student.last_name}</Link>
            </h1>
          </div>
          <span className={`chip px-3 py-1 text-sm ${STATE_STYLE[e.state]}`}>{BILLABILITY_LABEL[e.state]}</span>
        </header>
        {sp.invalid && <p role="alert" className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">Not saved. {sp.invalid}</p>}
        {sp.saved && <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">Saved. Checks re-ran.</p>}
        {sp.error === "attest" && <p className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">Check the attestation box to sign.</p>}
        {sp.error === "minutes" && <p className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">Enter the minutes you delivered before signing.</p>}

        {n.uncertain.length > 0 && editable && (
          <div className="rounded-lg border border-warn/30 bg-warn-50 p-3 text-sm text-warn">
            <p className="font-medium">Confirm before signing</p>
            <ul className="mt-1 list-disc pl-5">{n.uncertain.map((u) => <li key={u}>{u}</li>)}</ul>
          </div>
        )}

        {editable ? (
          <form action={saveNote.bind(null, e.id)} className="card space-y-4 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-sm font-medium">
                Attendance
                <select name="attendance" defaultValue={n.attendance} className="field mt-1">
                  {Object.entries(ATTENDANCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">
                Minutes
                <input name="minutes" inputMode="numeric" defaultValue={n.minutes ?? ""} className={`field mt-1 ${n.minutes_source === "missing" && delivered ? "border-block" : ""}`} placeholder="required" />
              </label>
              <label className="text-sm font-medium">
                Setting
                <select name="setting" defaultValue={n.setting} className="field mt-1">
                  <option value="individual">Individual</option>
                  <option value="group">Group</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Group size
                <input name="group_size" inputMode="numeric" defaultValue={n.group_size ?? ""} className="field mt-1" />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Summary
              <textarea name="summary" defaultValue={n.summary} rows={2} className="field mt-1" />
            </label>
            <div>
              <p className="text-sm font-medium">IEP goal progress</p>
              <div className="mt-1 space-y-2">
                {goals.map((g) => {
                  const d = n.goals.find((x) => x.goal_id === g.id);
                  return (
                    <div key={g.id} className="rounded-lg border border-line p-3">
                      <p className="text-sm"><span className="font-medium">{g.area}:</span> {g.text}</p>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                        <label>Correct<input name={`goal_${g.id}_correct`} defaultValue={d?.correct ?? ""} className="field mt-0.5" inputMode="numeric" /></label>
                        <label>Trials<input name={`goal_${g.id}_trials`} defaultValue={d?.trials ?? ""} className="field mt-0.5" inputMode="numeric" /></label>
                        <label>Percent<input name={`goal_${g.id}_percent`} defaultValue={d?.percent ?? ""} className="field mt-0.5" inputMode="numeric" /></label>
                        <label>Cues<input name={`goal_${g.id}_cue`} defaultValue={d?.cue ?? ""} className="field mt-0.5" placeholder="minimal verbal" /></label>
                      </div>
                      {d?.evidence && <p className="mt-2 text-xs text-ink-4">From dictation: &ldquo;{d.evidence}&rdquo;</p>}
                    </div>
                  );
                })}
              </div>
            </div>
            <label className="block text-sm font-medium">
              Activities (one per line)
              <textarea name="activities" defaultValue={n.activities.join("\n")} rows={3} className="field mt-1" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Student response
                <textarea name="response" defaultValue={n.response} rows={2} className="field mt-1" />
              </label>
              <label className="block text-sm font-medium">
                Plan
                <textarea name="plan" defaultValue={n.plan} rows={2} className="field mt-1" />
              </label>
            </div>
            <div className="flex justify-between gap-2">
              <button className="btn-ghost" type="submit">Save and re-check</button>
            </div>
          </form>
        ) : (
          <article className="card space-y-4 p-4 text-sm">
            <p>{n.summary}</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field k="Attendance" v={ATTENDANCE_LABEL[n.attendance]} />
              <Field k="Minutes" v={n.minutes != null ? String(n.minutes) : "Missing"} />
              <Field k="Setting" v={`${n.setting}${n.group_size ? ` (${n.group_size})` : ""}`} />
              <Field k="Code" v={n.cpt ? `${n.cpt} x${n.units}` : "None"} />
            </dl>
            {n.goals.length > 0 && (
              <table className="w-full text-left">
                <thead className="text-xs text-ink-3"><tr><th className="py-1">Goal</th><th>Data</th><th>Cues</th></tr></thead>
                <tbody>
                  {n.goals.map((d) => {
                    const g = goals.find((x) => x.id === d.goal_id);
                    return (
                      <tr key={d.goal_id} className="border-t border-line">
                        <td className="py-1.5 pr-2">{g?.area ?? d.goal_id}</td>
                        <td>{d.correct != null && d.trials ? `${d.correct}/${d.trials} ` : ""}{d.percent != null ? `(${d.percent}%)` : ""}</td>
                        <td>{d.cue ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {n.activities.length > 0 && <Section title="Activities">{n.activities.join(" ")}</Section>}
            {n.response && <Section title="Response">{n.response}</Section>}
            {n.plan && <Section title="Plan">{n.plan}</Section>}
          </article>
        )}

        {(addenda.length > 0 || canAddend) && (
          <section className="card space-y-3 p-4 text-sm">
            <h2 className="font-semibold">Addenda</h2>
            {addenda.map((a) => (
              <div key={a.id} className="border-l-2 border-brand-100 pl-3">
                <p className="text-xs text-ink-3">{a.author_name}, {new Date(a.created_at).toLocaleString()}</p>
                <p className="whitespace-pre-wrap">{a.text}</p>
              </div>
            ))}
            {canAddend && (
              <form action={addendumAction.bind(null, e.id)} className="space-y-2">
                <label className="block text-sm font-medium">
                  Add an addendum
                  <textarea name="text" rows={2} required maxLength={4000} className="field mt-1" placeholder="Late entry or correction. Signed notes cannot be edited." />
                </label>
                <button className="btn-ghost" type="submit">Add addendum</button>
              </form>
            )}
          </section>
        )}

        {e.transcript && (
          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-medium text-ink-2">Original dictation</summary>
            <p className="mt-2 whitespace-pre-wrap text-ink-3">{e.transcript}</p>
          </details>
        )}
      </div>

      <aside className="space-y-4">
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">Claim checks</h2>
          <IssueList issues={e.issues} />
          {n.cpt && (
            <p className="text-xs text-ink-3">
              Code {n.cpt} x{n.units}: {CPT_LABELS[n.cpt]}. Engine: {n.engine}.
            </p>
          )}
        </section>

        {editable && (
          <form action={signNote.bind(null, e.id)} className="card space-y-3 p-4">
            <input type="hidden" name="next" value="/review" />
            <h2 className="text-sm font-semibold">Sign</h2>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="attest" className="mt-1" required />
              <span>I personally provided this service on {formatDate(e.date)}, and this note is accurate.</span>
            </label>
            {e.state === "blocked" && <p className="text-xs text-ink-3">You can sign for the IEP record now. It will not be claimed until the blocking items are fixed.</p>}
            {user.role === "assistant" && <p className="text-xs text-ink-3">Your supervisor will co-sign before this is claimed.</p>}
            <button className="btn-primary w-full" type="submit" disabled={delivered && n.minutes_source === "missing"}>Sign note</button>
          </form>
        )}

        {cosignable && (
          <form action={cosignNote.bind(null, e.id)} className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold">Co-sign</h2>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="attest" className="mt-1" required />
              <span>I reviewed this note as the supervising clinician.</span>
            </label>
            <button className="btn-primary w-full" type="submit">Co-sign</button>
          </form>
        )}

        {editable && (
          <form action={discardDraft.bind(null, e.id)}>
            <button className="text-sm text-block hover:underline" type="submit">Discard draft</button>
          </form>
        )}

        {e.status !== "draft" && (
          <Link href={`/claims/binder?id=${e.id}`} className="btn-ghost w-full">Open audit binder page</Link>
        )}

        <section className="card p-4">
          <h2 className="text-sm font-semibold">Audit trail</h2>
          <ol className="mt-2 space-y-1.5 text-xs text-ink-3">
            <li>Created {new Date(e.created_at).toLocaleString()}</li>
            {e.signed_at && <li>Signed {new Date(e.signed_at).toLocaleString()} by {getUser(e.signed_by ?? "")?.name}</li>}
            {e.cosigned_at && <li>Co-signed {new Date(e.cosigned_at).toLocaleString()} by {getUser(e.cosigned_by ?? "")?.name}</li>}
            {trail.map((a) => (
              <li key={a.id}>{a.action.replace(".", " ")} by {a.user_name ?? "system"}, {new Date(a.at).toLocaleString()}</li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{k}</dt>
      <dd className="font-medium capitalize">{v}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-4">{title}</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}
