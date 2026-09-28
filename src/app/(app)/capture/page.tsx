import Link from "next/link";
import { redirect } from "next/navigation";
import { captureSession } from "@/app/actions";
import { CaptureForm } from "@/components/CaptureForm";
import { requireUser } from "@/lib/auth";
import { formatDate, today } from "@/lib/dates";
import { getDistrict, getStudent, goalsFor, servicesFor } from "@/lib/repo";
import { rulePack } from "@/lib/rules";

export default async function CapturePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const student = sp.student ? getStudent(sp.student) : null;
  if (!student || !user.discipline) redirect("/today");
  const service = servicesFor(student.id).find((s) => s.discipline === user.discipline);
  if (!service) redirect("/today?error=not-on-caseload");
  const goals = goalsFor(student.id).filter((g) => g.discipline === user.discipline);
  const date = sp.date && sp.date <= today() ? sp.date : today();
  const scheduled = Number(sp.scheduled) || null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={`/today?date=${date}`} className="text-sm text-brand">Back to schedule</Link>
      <header>
        <p className="text-sm text-ink-3">{formatDate(date)}{sp.start ? ` at ${sp.start}` : ""}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{student.first_name} {student.last_name}</h1>
        <p className="text-sm text-ink-3">Grade {student.grade}, {student.school}. IEP: {service.minutes_per_week} min/week {service.setting}.</p>
      </header>
      <section className="card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-4">IEP goals to report on</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {goals.map((g) => (
            <li key={g.id}><span className="font-medium">{g.area}:</span> {g.text}</li>
          ))}
        </ul>
      </section>
      <CaptureForm
        action={captureSession}
        studentId={student.id}
        studentName={`${student.first_name} ${student.last_name}`}
        date={date}
        start={sp.start ?? ""}
        setting={sp.setting ?? service.setting}
        scheduledMinutes={scheduled}
        requireTimes={rulePack(getDistrict(user.district_id).settings.state).requireTimes}
      />
      <p className="text-xs text-ink-4">
        Dictate after the session, away from students. Sessionside never records children and never fills in minutes you did not enter or say.
      </p>
    </div>
  );
}
