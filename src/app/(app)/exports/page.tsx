import { saveExportProfile } from "@/app/export-actions";
import { requireUser } from "@/lib/auth";
import { addDays, today } from "@/lib/dates";
import { FIELD_LABELS, profilesFor, type ExportField } from "@/lib/exportProfiles";
import { getDistrict } from "@/lib/repo";

export default async function ExportsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const profiles = profilesFor(getDistrict(user.district_id).settings);
  const from = addDays(today(), -7);
  const to = today();

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Exports</h1>
        <p className="text-sm text-ink-3">Capture once. Send the same signed sessions to your IEP system, service tracker, or billing vendor without retyping them.</p>
      </header>
      {sp.saved && <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">Profile saved.</p>}
      {sp.error && <p role="alert" className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">Give the profile a name and at least one column.</p>}

      <section className="space-y-3">
        {profiles.map((p) => (
          <form key={p.id} action="/api/exports" method="get" className="card flex flex-wrap items-end justify-between gap-3 p-4">
            <input type="hidden" name="profile" value={p.id} />
            <div className="min-w-60 flex-1">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-ink-3">{p.description}</p>
              <p className="mt-1 text-xs text-ink-4">{p.columns.map((c) => c.header).join(", ")}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <label>From<input type="date" name="from" defaultValue={from} className="field mt-0.5" /></label>
              <label>To<input type="date" name="to" defaultValue={to} className="field mt-0.5" /></label>
              <button className="btn-primary" type="submit">Download CSV</button>
            </div>
          </form>
        ))}
      </section>

      {user.role === "coordinator" && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Build a profile to match your district&apos;s import</summary>
          <form action={saveExportProfile} className="mt-4 space-y-4">
            <label className="block text-sm font-medium">
              Profile name
              <input name="name" required maxLength={60} className="field mt-1 max-w-sm" placeholder="Frontline service log import" />
            </label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="onlySigned" defaultChecked /> Signed sessions only</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="includeAbsences" defaultChecked /> Include absences</label>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-ink-3">
                <tr><th scope="col" className="py-1">Use</th><th scope="col">Field</th><th scope="col">Column header</th><th scope="col">Order</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(Object.keys(FIELD_LABELS) as ExportField[]).map((f, i) => (
                  <tr key={f}>
                    <td className="py-1.5"><input type="checkbox" name={`use_${f}`} aria-label={`Include ${FIELD_LABELS[f]}`} /></td>
                    <td className="pr-3">{FIELD_LABELS[f]}</td>
                    <td className="pr-3"><input name={`header_${f}`} aria-label={`Header for ${FIELD_LABELS[f]}`} className="field py-1" placeholder={FIELD_LABELS[f]} /></td>
                    <td><input name={`order_${f}`} aria-label={`Order for ${FIELD_LABELS[f]}`} inputMode="numeric" defaultValue={i + 1} className="field w-16 py-1" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-primary" type="submit">Save profile</button>
          </form>
        </details>
      )}
    </div>
  );
}
