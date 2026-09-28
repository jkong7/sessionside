import Link from "next/link";
import { cosignNote, signAllClean } from "@/app/review-actions";
import { IssueList } from "@/components/IssueList";
import { requireUser } from "@/lib/auth";
import { BILLABILITY_LABEL } from "@/lib/checks";
import { formatDate } from "@/lib/dates";
import { assistantsOf, encountersFor, getStudent, getUser } from "@/lib/repo";
import { evaluate, STATE_STYLE, type Evaluated } from "@/lib/status";

const RANK = { blocked: 0, ready_to_sign: 1, awaiting_cosign: 2, not_billable: 3, billable: 4 };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ signed?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const drafts = encountersFor({ providerIds: [user.id], status: ["draft"] })
    .map(evaluate)
    .sort((a, b) => RANK[a.state] - RANK[b.state] || b.issues.filter((i) => i.severity === "block").length - a.issues.filter((i) => i.severity === "block").length || a.date.localeCompare(b.date));
  const clean = drafts.filter((e) => e.state === "ready_to_sign" && e.issues.length === 0 && e.note.uncertain.length === 0);
  const assistants = assistantsOf(user.id);
  const cosign = encountersFor({ providerIds: assistants.map((a) => a.id), status: ["cosign_pending"] }).map(evaluate);
  const mine = user.role === "assistant" ? encountersFor({ providerIds: [user.id], status: ["cosign_pending"] }) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Review & sign</h1>
        <p className="text-sm text-ink-3">Problems first. Nothing is signed or claimed without your attestation.</p>
      </header>
      {sp.signed && <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">Signed {sp.signed} clean note{sp.signed === "1" ? "" : "s"}.</p>}
      {sp.error === "attest" && <p className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">Check the attestation box to sign.</p>}

      {clean.length > 0 && (
        <form action={signAllClean} className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="attest" className="mt-1" required />
            <span>
              I personally provided the <strong>{clean.length}</strong> session{clean.length > 1 ? "s" : ""} below marked clean, and the notes are accurate.
            </span>
          </label>
          <button className="btn-primary" type="submit">Sign {clean.length} clean note{clean.length > 1 ? "s" : ""}</button>
        </form>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-2">Your unsigned notes ({drafts.length})</h2>
        {drafts.length === 0 && <p className="card p-6 text-sm text-ink-3">You are caught up.</p>}
        {drafts.map((e) => (
          <Row key={e.id} e={e} clean={clean.includes(e)} />
        ))}
      </section>

      {mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-2">Waiting for your supervisor ({mine.length})</h2>
          {mine.map(evaluate).map((e) => (
            <Row key={e.id} e={e} />
          ))}
        </section>
      )}

      {assistants.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-2">Co-sign for {assistants.map((a) => a.name).join(", ")} ({cosign.length})</h2>
          {cosign.length === 0 && <p className="card p-6 text-sm text-ink-3">No assistant notes waiting.</p>}
          {cosign.map((e) => (
            <div key={e.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <Link href={`/review/${e.id}`} className="min-w-0">
                <p className="font-medium">{studentName(e.student_id)} <span className="text-sm font-normal text-ink-3">{formatDate(e.date)}, by {getUser(e.provider_id)?.name}</span></p>
                <p className="truncate text-sm text-ink-3">{e.note.summary}</p>
              </Link>
              <form action={cosignNote.bind(null, e.id)} className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5"><input type="checkbox" name="attest" required /> Reviewed</label>
                <button className="btn-ghost" type="submit">Co-sign</button>
              </form>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function studentName(id: string) {
  const s = getStudent(id);
  return s ? `${s.first_name} ${s.last_name}` : "Unknown";
}

function Row({ e, clean }: { e: Evaluated; clean?: boolean }) {
  return (
    <Link href={`/review/${e.id}`} className="card block p-4 hover:border-line-strong">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {studentName(e.student_id)} <span className="text-sm font-normal text-ink-3">{formatDate(e.date)}{e.start ? ` ${e.start}` : ""}</span>
        </p>
        <span className={`chip ${STATE_STYLE[e.state]}`}>{clean ? "Clean" : BILLABILITY_LABEL[e.state]}</span>
      </div>
      <p className="mt-1 truncate text-sm text-ink-3">{e.note.summary}</p>
      <div className="mt-2">
        <IssueList issues={e.issues.filter((i) => i.severity !== "info")} compact />
      </div>
    </Link>
  );
}
