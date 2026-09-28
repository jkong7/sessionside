import Link from "next/link";
import { redirect } from "next/navigation";
import { captureGroup } from "@/app/actions";
import { GroupCaptureForm } from "@/components/GroupCaptureForm";
import { requireUser } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { getStudent, goalsFor, servicesFor } from "@/lib/repo";

export default async function GroupCapturePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const ids = (sp.students ?? "").split(",").filter(Boolean);
  const students = ids.map((id) => getStudent(id)).filter((s) => s && s.district_id === user.district_id && servicesFor(s.id).some((sv) => sv.provider_id === user.id));
  if (students.length < 2 || !user.discipline) redirect("/today");
  const date = sp.date && sp.date <= today() ? sp.date : today();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={`/today?date=${date}`} className="text-sm text-brand">Back to schedule</Link>
      <header>
        <p className="text-sm text-ink-3">{formatDate(date)}{sp.start ? ` at ${sp.start}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Group session</h1>
        <p className="text-sm text-ink-3">One dictation, one IEP-aligned note per student.</p>
      </header>
      <section className="card divide-y divide-line">
        {students.map((s) => (
          <div key={s!.id} className="p-3 text-sm">
            <p className="font-medium">{s!.first_name} {s!.last_name}</p>
            <ul className="mt-1 text-ink-3">
              {goalsFor(s!.id).filter((g) => g.discipline === user.discipline).map((g) => (
                <li key={g.id}>{g.area}: {g.text}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <GroupCaptureForm
        action={captureGroup}
        students={students.map((s) => ({ id: s!.id, name: `${s!.first_name} ${s!.last_name}` }))}
        date={date}
        start={sp.start ?? ""}
        scheduledMinutes={Number(sp.scheduled) || null}
      />
    </div>
  );
}
