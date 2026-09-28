import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { BILLABILITY_LABEL } from "@/lib/checks";
import { formatDate, today } from "@/lib/dates";
import { goalProgress } from "@/lib/progress";
import { consentsFor, encountersFor, getDistrict, getStudent, getUser, goalsFor, ordersFor, servicesFor } from "@/lib/repo";
import { evaluate, STATE_STYLE } from "@/lib/status";

const DISC: Record<string, string> = { slp: "Speech-language", ot: "Occupational therapy", pt: "Physical therapy" };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const s = getStudent(id);
  if (!s || s.district_id !== user.district_id) notFound();
  const services = servicesFor(id);
  if (user.role !== "coordinator" && !services.some((sv) => sv.provider_id === user.id || getUser(sv.provider_id)?.supervisor_id === user.id)) notFound();
  const goals = goalsFor(id).filter((g) => user.role === "coordinator" || g.discipline === user.discipline);
  const encs = encountersFor({ studentId: id });
  const consent = consentsFor(id).at(-1);
  const orders = ordersFor(id);
  const t = today();
  const required = services.filter((sv) => getDistrict(s.district_id).settings.ordersRequired.includes(sv.discipline));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{s.first_name} {s.last_name}</h1>
        <p className="text-sm text-ink-3">Grade {s.grade}, {s.school}. DOB {s.dob}. IEP {s.iep_start} to {s.iep_end}.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Status ok={Boolean(s.medicaid_id)} title="Medicaid" detail={s.medicaid_id ?? "No Medicaid ID on file"} />
        <Status
          ok={Boolean(consent && !consent.revoked_on)}
          title="Parental billing consent"
          detail={!consent ? "Not on file" : consent.revoked_on ? `Revoked ${consent.revoked_on}` : `Signed ${consent.signed_on}`}
        />
        <Status
          ok={required.every((sv) => (orders.filter((o) => o.discipline === sv.discipline).at(-1)?.expires_on ?? "") >= t)}
          title="Referrals"
          detail={
            required.length === 0
              ? "Not required for these services in this district"
              : required
                  .map((sv) => {
                    const o = orders.filter((x) => x.discipline === sv.discipline).at(-1);
                    return `${sv.discipline.toUpperCase()}: ${o ? (o.expires_on < t ? `expired ${o.expires_on}` : `valid to ${o.expires_on}`) : "missing"}`;
                  })
                  .join("; ")
          }
        />
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold">IEP services</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {services.map((sv) => (
            <li key={sv.id}>{DISC[sv.discipline]}: {sv.minutes_per_week} min/week, {sv.setting}, {getUser(sv.provider_id)?.name}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Goal progress</h2>
        {goals.map((g) => {
          const p = goalProgress(g, encs);
          return (
            <div key={g.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm"><span className="font-medium">{g.area}:</span> {g.text}</p>
                {p.recentAvg != null && <span className="chip bg-brand-50 text-brand">{p.recentAvg}% recent</span>}
              </div>
              <div className="mt-3 flex h-16 items-end gap-1">
                {p.points.map((pt, i) => (
                  <div key={i} className="w-3 rounded-t bg-brand/70" style={{ height: `${Math.max(4, pt.percent)}%` }} title={`${pt.date}: ${pt.percent}%`} />
                ))}
              </div>
              <p className="mt-2 text-sm text-ink-2">{p.statement}</p>
            </div>
          );
        })}
      </section>

      <section className="card divide-y divide-line">
        <h2 className="p-4 text-sm font-semibold">Sessions</h2>
        {encs.slice(0, 20).map(evaluate).map((e) => (
          <Link key={e.id} href={`/review/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm hover:bg-sunken">
            <span>{formatDate(e.date)} <span className="text-ink-3">{getUser(e.provider_id)?.name}</span></span>
            <span className="truncate text-ink-3">{e.note.summary}</span>
            <span className={`chip ${STATE_STYLE[e.state]}`}>{BILLABILITY_LABEL[e.state]}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

function Status({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div className={`card p-4 ${ok ? "" : "border-block/40"}`}>
      <p className="text-xs text-ink-3">{title}</p>
      <p className={`mt-1 text-sm font-medium ${ok ? "text-ok" : "text-block"}`}>{detail}</p>
    </div>
  );
}
