import { redirect } from "next/navigation";
import { saveDistrictSettings } from "@/app/settings-actions";
import { requireUser } from "@/lib/auth";
import { editRate } from "@/lib/diff";
import { encountersFor, getDistrict, listUsers } from "@/lib/repo";
import { RULE_PACKS, rulePack } from "@/lib/rules";

const DISC = { slp: "Speech", ot: "OT", pt: "PT" } as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireUser();
  if (user.role !== "coordinator") redirect("/today");
  const sp = await searchParams;
  const district = getDistrict(user.district_id);
  const pack = rulePack(district.settings.state);
  const signed = encountersFor({ providerIds: listUsers(user.district_id).map((u) => u.id), status: ["signed", "cosign_pending"] }).filter((e) => e.draft_note);
  const rate = editRate(signed.map((e) => ({ draft: e.draft_note!, final: e.note })));
  const engines = signed.reduce<Record<string, number>>((m, e) => ({ ...m, [e.note.engine.startsWith("claude") ? "AI (Claude)" : "Offline rules engine"]: (m[e.note.engine.startsWith("claude") ? "AI (Claude)" : "Offline rules engine"] ?? 0) + 1 }), {});

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">District settings</h1>
        <p className="text-sm text-ink-3">{district.name}</p>
      </header>
      {sp.saved && <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">Saved. Every note was re-checked against the new rules.</p>}
      {sp.error && <p role="alert" className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">Those settings were not valid.</p>}

      <form action={saveDistrictSettings} className="card grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium">
          State Medicaid program
          <select name="state" defaultValue={district.settings.state} className="field mt-1">
            {Object.values(RULE_PACKS).map((p) => <option key={p.state} value={p.state}>{p.name}: {p.program}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          District signing policy (days)
          <input name="noteDeadlineDays" inputMode="numeric" defaultValue={district.settings.noteDeadlineDays ?? ""} className="field mt-1" placeholder="none" />
          <span className="mt-1 block text-xs font-normal text-ink-4">Used as a warning where the state sets no deadline.</span>
        </label>
        <button className="btn-primary" type="submit">Save</button>
      </form>

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-semibold">Drafting oversight</h2>
        <p className="text-sm">
          {rate.notes} signed notes. Clinicians changed the draft on {rate.edited} ({rate.notes ? Math.round((rate.edited / rate.notes) * 100) : 0}%), {rate.fieldsChanged} fields in total. Drafted by: {Object.entries(engines).map(([k, v]) => `${k} ${v}`).join(", ") || "none yet"}.
        </p>
        <p className="text-xs text-ink-3">A very low edit rate can mean clinicians are signing without reading; a very high one means drafts need tuning. Each note keeps its original draft for review.</p>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-semibold">Your data</h2>
          <p className="text-sm text-ink-3">Download everything Sessionside holds for this district as JSON. See the <a className="text-brand underline" href="/trust">trust page</a> for data use and AI commitments.</p>
        </div>
        <a className="btn-ghost" href="/api/district-export">Export all district data</a>
      </section>

      <section className="card overflow-x-auto p-4">
        <h2 className="text-sm font-semibold">{pack.name} rules Sessionside enforces</h2>
        <table className="mt-3 w-full min-w-[560px] text-left text-sm">
          <tbody className="divide-y divide-line">
            <Row k="Note deadline" v={pack.noteDeadline ? (pack.noteDeadline.days === 0 ? "Contemporaneous (same day)" : `${pack.noteDeadline.days} days${pack.noteDeadline.hard ? ", late notes not claimable" : ""}`) : "None in state rules"} />
            <Row k="Start and end times" v={pack.requireTimes ? "Required on every note" : "Not required (duration required)"} />
            <Row k="IEP goal on every note" v={pack.requireGoalLink ? "Required" : "Recommended"} />
            <Row k="Group size" v={`${pack.group.min} to ${pack.group.max ?? "no state cap"}`} />
            {(["slp", "ot", "pt"] as const).map((d) => (
              <Row key={d} k={`${DISC[d]} authorization`} v={pack.orders[d].required ? `${pack.orders[d].label}, valid ${pack.orders[d].validityDays >= 1000 ? "3 years" : "1 year"}` : "Not required"} />
            ))}
            {(["slp", "ot", "pt"] as const).map((d) => {
              const c = pack.codes[d];
              return (
                <Row
                  key={`c-${d}`}
                  k={`${DISC[d]} codes`}
                  v={`${c.individual} / ${c.group}${c.modifiers.length ? ` with ${c.modifiers.join(", ")}` : ""}${c.assistantModifier ? `; assistant ${c.assistantModifier}` : ""}; ${c.timed ? "15-minute units" : "per session"}${c.maxUnitsPerDay ? `, max ${c.maxUnitsPerDay}/day` : ""}`}
                />
              );
            })}
            <Row k="Assistant co-sign" v={pack.cosign.required ? `Required${pack.cosign.withinDays ? ` within ${pack.cosign.withinDays} days` : ""}${pack.cosign.monthlyReview ? ", plus monthly supervisor review" : ""}` : "Per licensure board rules"} />
            <Row k="SLP credential" v={pack.requireCccForSlp ? "ASHA CCC or equivalent required to bill" : "State license"} />
            <Row k="Timely filing" v={pack.filingLimitDays ? `${pack.filingLimitDays} days from service` : "Not encoded"} />
            <Row k="Record retention" v={`${pack.retentionYears} years`} />
            <Row k="Services outside an IEP" v={pack.nonIepBillable.slp ? "Billable for Medicaid-enrolled students" : "Not billable for therapies"} />
          </tbody>
        </table>
        <div className="mt-4 text-xs text-ink-3">
          Sources:{" "}
          {pack.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && "; "}
              <a className="text-brand underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
            </span>
          ))}
          . Rules are a starting point; confirm with your state program before relying on them.
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th scope="row" className="w-56 py-2 pr-3 font-medium text-ink-2">{k}</th>
      <td className="py-2">{v}</td>
    </tr>
  );
}
