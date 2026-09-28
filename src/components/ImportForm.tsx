"use client";

import { useActionState, useState } from "react";
import type { ImportState } from "@/app/import-actions";

const KINDS = [
  ["students", "Students and IEP dates"],
  ["services", "IEP services (minutes per week)"],
  ["goals", "IEP goals"],
  ["consents", "Parental billing consents"],
  ["orders", "Referrals and orders"],
  ["attendance", "School attendance"],
] as const;

export function ImportForm({ action }: { action: (prev: ImportState, fd: FormData) => Promise<ImportState> }) {
  const [state, run, pending] = useActionState(action, { result: null, error: null });
  const [kind, setKind] = useState<string>("students");
  const r = state.result;

  return (
    <form action={run} className="card space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          What are you importing?
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className="field mt-1">
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          CSV file
          <input type="file" name="file" accept=".csv,text/csv" required className="field mt-1" />
        </label>
      </div>
      <p className="text-xs text-ink-3">
        Match students by your district student ID. <a className="text-brand underline" href={`/api/import-template?kind=${kind}`}>Download the {kind} template</a>.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" type="submit" name="intent" value="preview" disabled={pending}>Check file</button>
        <button className="btn-primary" type="submit" name="intent" value="commit" disabled={pending}>Import</button>
      </div>
      <div aria-live="polite">
        {state.error && <p role="alert" className="rounded-lg bg-block-50 px-3 py-2 text-sm text-block">{state.error}</p>}
        {r && (
          <div className={`rounded-lg px-3 py-2 text-sm ${r.committed ? "bg-ok-50 text-ok" : r.errors.length ? "bg-block-50 text-block" : "bg-brand-50 text-brand"}`}>
            <p className="font-medium">
              {r.committed ? `Imported ${r.valid} ${r.kind} rows.` : r.errors.length ? `${r.errors.length} row${r.errors.length > 1 ? "s" : ""} need fixing. Nothing was imported.` : `All ${r.valid} rows look good. Choose Import to save them.`}
            </p>
            {r.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {r.errors.slice(0, 25).map((e) => <li key={`${e.row}-${e.message}`}>Row {e.row}: {e.message}</li>)}
                {r.errors.length > 25 && <li>and {r.errors.length - 25} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
