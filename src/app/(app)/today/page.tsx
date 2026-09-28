import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { addDays, formatDate, today, weekday } from "@/lib/dates";
import { caseload, encounterForSlot, encountersFor, slotsOn } from "@/lib/repo";
import { evaluate, STATE_STYLE } from "@/lib/status";
import { BILLABILITY_LABEL } from "@/lib/checks";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today() ? sp.date : today();
  const slots = slotsOn(user.id, weekday(date));
  const rows = slots.map((s) => {
    const enc = encounterForSlot(user.id, s.student_id, date, s.start);
    return { slot: s, enc: enc ? evaluate(enc) : null };
  });
  const groups = new Map<string, typeof rows>();
  for (const r of rows) if (r.slot.setting === "group") groups.set(r.slot.start, [...(groups.get(r.slot.start) ?? []), r]);
  const groupStarts = [...groups.entries()].filter(([, g]) => g.length > 1 && g.some((r) => !r.enc));
  const unsigned = encountersFor({ providerIds: [user.id], status: ["draft"] }).map(evaluate);
  const blocked = unsigned.filter((e) => e.state === "blocked").length;
  const logged = rows.filter((r) => r.enc).length;
  const students = caseload(user.id);
  const isToday = date === today();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-3">{isToday ? "Today" : "Schedule for"}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{formatDate(date)}</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <Link className="btn-ghost" href={`/today?date=${addDays(date, -1)}`}>Previous day</Link>
          {!isToday && <Link className="btn-ghost" href={`/today?date=${addDays(date, 1) > today() ? today() : addDays(date, 1)}`}>Next day</Link>}
          {!isToday && <Link className="btn-ghost" href="/today">Today</Link>}
        </div>
      </header>

      {sp.error && (
        <p role="alert" className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">
          {sp.error === "already-logged" ? "Those sessions were already logged." : sp.error === "future" ? "You cannot log a session in the future." : "That student is not on your caseload."}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Sessions logged" value={`${logged} of ${rows.length}`} />
        <Stat label="Notes waiting for your signature" value={String(unsigned.length)} href="/review" />
        <Stat label="Blocked from billing" value={String(blocked)} tone={blocked ? "block" : undefined} href="/review" />
      </section>

      {groupStarts.map(([start, g]) => (
        <section key={start} className="card flex flex-wrap items-center justify-between gap-3 border-brand-100 bg-brand-50/40 p-4">
          <div className="flex items-center gap-4">
            <span className="w-14 font-mono text-sm text-ink-3">{start}</span>
            <div>
              <p className="font-medium">Group: {g.map((r) => r.slot.first_name).join(", ")}</p>
              <p className="text-xs text-ink-3">Dictate once, get a note for each student</p>
            </div>
          </div>
          <Link
            className="btn-primary"
            href={`/capture/group?date=${date}&start=${start}&scheduled=${g[0].slot.minutes}&students=${g.filter((r) => !r.enc).map((r) => r.slot.student_id).join(",")}`}
          >
            Log group session
          </Link>
        </section>
      ))}

      <section className="card divide-y divide-line">
        {rows.length === 0 && <p className="p-6 text-sm text-ink-3">No sessions scheduled. Use a make-up session below if you saw a student.</p>}
        {rows.map(({ slot, enc }) => (
          <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-4">
              <span className="w-14 font-mono text-sm text-ink-3">{slot.start}</span>
              <div>
                <p className="font-medium">{slot.first_name} {slot.last_name}</p>
                <p className="text-xs text-ink-3">{slot.minutes} min {slot.setting}</p>
              </div>
            </div>
            {enc ? (
              <Link href={`/review/${enc.id}`} className="flex items-center gap-2 text-sm">
                <span className={`chip ${STATE_STYLE[enc.state]}`}>{BILLABILITY_LABEL[enc.state]}</span>
                <span className="text-brand">Open note</span>
              </Link>
            ) : (
              <Link className="btn-primary" href={`/capture?student=${slot.student_id}&date=${date}&start=${slot.start}&setting=${slot.setting}&scheduled=${slot.minutes}`}>
                Log session
              </Link>
            )}
          </div>
        ))}
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold">Make-up or unscheduled session</h2>
        <form action="/capture" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="date" value={date} />
          <select name="student" aria-label="Student" className="field max-w-xs" required>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
            ))}
          </select>
          <button className="btn-ghost" type="submit">Log session</button>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: string; tone?: "block"; href?: string }) {
  const body = (
    <div className="card p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "block" ? "text-block" : ""}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
