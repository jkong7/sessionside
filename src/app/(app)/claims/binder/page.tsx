import Link from "next/link";
import { BinderEntry } from "@/components/BinderEntry";
import { PrintButton } from "@/components/PrintButton";
import { canView } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { scopeProviders } from "@/lib/claims";
import { addDays, formatDate, today } from "@/lib/dates";
import { audit, encountersFor, getEncounter } from "@/lib/repo";
import { evaluate } from "@/lib/status";

export default async function BinderPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; id?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const from = valid(sp.from) ?? addDays(today(), -30);
  const to = valid(sp.to) ?? today();
  let entries;
  if (sp.id) {
    const one = getEncounter(sp.id);
    entries = one && canView(user, one) ? [evaluate(one)] : [];
  } else {
    entries = encountersFor({ providerIds: scopeProviders(user), from, to }).map(evaluate).filter((e) => e.state === "billable");
  }
  audit(user.id, "binder.viewed", "district", user.district_id, { from, to, id: sp.id ?? null, count: entries.length });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/claims" className="text-sm text-brand">Back to claims</Link>
        <PrintButton />
      </div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit binder</h1>
        <p className="text-sm text-ink-3">
          {sp.id ? "One claim" : `${entries.length} claimable sessions, ${formatDate(from)} to ${formatDate(to)}`}. Each page carries the note, signatures, authorization, check results, and audit trail an auditor asks for.
        </p>
      </header>
      {entries.length === 0 && <p className="card p-6 text-sm text-ink-3">No claimable sessions in this range.</p>}
      {entries.map((e) => <BinderEntry key={e.id} e={e} />)}
    </div>
  );
}
