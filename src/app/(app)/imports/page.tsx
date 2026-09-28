import { redirect } from "next/navigation";
import { importAction } from "@/app/import-actions";
import { ImportForm } from "@/components/ImportForm";
import { requireUser } from "@/lib/auth";
import { IMPORT_COLUMNS } from "@/lib/importers";

export default async function ImportsPage() {
  const user = await requireUser();
  if (user.role !== "coordinator") redirect("/today");
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Imports</h1>
        <p className="text-sm text-ink-3">Load rosters, IEP services, goals, consents, referrals, and school attendance from your student information or IEP system. Every file is checked row by row; nothing is saved unless the whole file is clean.</p>
      </header>
      <ImportForm action={importAction} />
      <section className="card p-4 text-sm">
        <h2 className="font-semibold">Columns</h2>
        <dl className="mt-2 space-y-1.5">
          {Object.entries(IMPORT_COLUMNS).map(([k, cols]) => (
            <div key={k}>
              <dt className="inline font-medium">{k}: </dt>
              <dd className="inline font-mono text-xs text-ink-2">{cols.join(", ")}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-3">School attendance powers the attendance cross-check: a delivered session on a day the student was absent from school is blocked before it becomes a claim.</p>
      </section>
    </div>
  );
}
