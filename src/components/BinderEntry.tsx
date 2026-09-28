import { formatDate } from "@/lib/dates";
import { noteChanges } from "@/lib/diff";
import { CPT_LABELS } from "@/lib/engine/cpt";
import { isValidNpi } from "@/lib/npi";
import { addendaFor, auditFor, consentsFor, getStudent, getUser, goalsFor, ordersFor, servicesFor } from "@/lib/repo";
import type { Evaluated } from "@/lib/status";

const ATT: Record<string, string> = { present: "Delivered", student_absent: "Student absent", provider_absent: "Provider absent", school_closed: "School closed" };

export function BinderEntry({ e }: { e: Evaluated }) {
  const s = getStudent(e.student_id)!;
  const p = getUser(e.provider_id)!;
  const cosigner = e.cosigned_by ? getUser(e.cosigned_by) : null;
  const consent = consentsFor(s.id).filter((c) => c.kind === "medicaid_billing" && c.signed_on <= e.date).at(-1);
  const order = ordersFor(s.id).filter((o) => o.discipline === p.discipline && o.signed_on <= e.date).at(-1);
  const service = servicesFor(s.id).find((sv) => sv.discipline === p.discipline);
  const goals = goalsFor(s.id);
  const trail = auditFor("encounter", e.id);
  const addenda = addendaFor(e.id);
  const signedAttestation = trail.find((a) => a.action === "note.signed");
  const n = e.note;

  return (
    <article className="card break-after-page space-y-4 p-5 text-sm print:break-inside-avoid">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-4">Claim documentation</p>
          <h2 className="text-lg font-semibold">{s.last_name}, {s.first_name}: {formatDate(e.date)}</h2>
          <p className="text-ink-3">Encounter {e.id}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-ink-3">Medicaid ID</dt><dd className="font-mono">{s.medicaid_id ?? "none"}</dd>
          <dt className="text-ink-3">Code</dt><dd className="font-mono">{n.cpt ?? "none"} x{n.units}</dd>
          <dt className="text-ink-3">Minutes</dt><dd>{n.minutes ?? "missing"} ({n.minutes_source})</dd>
          <dt className="text-ink-3">Place of service</dt><dd>03 School</dd>
        </dl>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4">Service</h3>
          <p>{ATT[n.attendance]}, {n.setting}{n.group_size ? ` (group of ${n.group_size})` : ""}. {n.cpt ? CPT_LABELS[n.cpt] : ""}</p>
          <p className="mt-1">{n.summary}</p>
          {n.activities.length > 0 && <p className="mt-1 text-ink-2">Activities: {n.activities.join("; ")}</p>}
          {n.goals.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {n.goals.map((g) => (
                <li key={g.goal_id}>{goals.find((x) => x.id === g.goal_id)?.area}: {g.correct != null && g.trials ? `${g.correct}/${g.trials} ` : ""}{g.percent != null ? `${g.percent}%` : ""}{g.cue ? `, ${g.cue} cues` : ""}</li>
              ))}
            </ul>
          )}
          {n.response && <p className="mt-1">Response: {n.response}</p>}
          {n.plan && <p className="mt-1">Plan: {n.plan}</p>}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4">Authorization</h3>
          <ul className="space-y-1">
            <li>IEP: {s.iep_start} to {s.iep_end}; {service ? `${service.discipline.toUpperCase()} ${service.minutes_per_week} min/week ${service.setting}` : "service not on IEP"}</li>
            <li>Parental billing consent: {consent ? `signed ${consent.signed_on}${consent.revoked_on ? `, revoked ${consent.revoked_on}` : ""}` : "not on file"}</li>
            <li>Referral: {order ? `${order.prescriber}, NPI ${order.prescriber_npi} (${isValidNpi(order.prescriber_npi) ? "valid" : "invalid"}), ${order.signed_on} to ${order.expires_on}` : "none on file"}</li>
            <li>Provider: {p.name}, {p.credential}, NPI {p.npi} ({isValidNpi(p.npi) ? "valid" : "invalid"}), license {p.license_number} expires {p.license_expires}</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4">Signatures</h3>
        <ul className="space-y-1">
          <li>Signed {e.signed_at ? new Date(e.signed_at).toLocaleString() : "not signed"} by {getUser(e.signed_by ?? "")?.name ?? "n/a"}.{signedAttestation ? ` Attestation: "${JSON.parse(signedAttestation.detail).attestation}"` : ""}</li>
          {e.draft_note && <li>Draft vs signed: {noteChanges(e.draft_note, n).length} field(s) changed by the clinician before signing.</li>}
          {cosigner && <li>Co-signed {new Date(e.cosigned_at!).toLocaleString()} by {cosigner.name}, {cosigner.credential}.</li>}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4">Pre-claim checks at export</h3>
        {e.issues.length === 0 ? <p className="text-ok">All checks passed.</p> : <ul className="list-disc pl-5">{e.issues.map((i) => <li key={i.code + i.message}>{i.severity}: {i.message}</li>)}</ul>}
      </section>

      {addenda.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4">Addenda</h3>
          <ul className="space-y-1">{addenda.map((a) => <li key={a.id}>{new Date(a.created_at).toLocaleString()}, {a.author_name}: {a.text}</li>)}</ul>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-4">Audit trail</h3>
        <ol className="text-xs text-ink-3">
          <li>Created {new Date(e.created_at).toLocaleString()}</li>
          {trail.map((a) => <li key={a.id}>{new Date(a.at).toLocaleString()}: {a.action} by {a.user_name ?? "system"}</li>)}
        </ol>
      </section>
    </article>
  );
}
