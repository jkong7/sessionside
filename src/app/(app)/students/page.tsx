import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { caseload, listStudents, servicesFor } from "@/lib/repo";

const DISC: Record<string, string> = { slp: "Speech", ot: "OT", pt: "PT" };

export default async function StudentsPage() {
  const user = await requireUser();
  const students = user.role === "coordinator" ? listStudents(user.district_id) : caseload(user.id);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{user.role === "coordinator" ? "Students" : "Caseload"}</h1>
      <section className="card divide-y divide-line">
        {students.map((s) => (
          <Link key={s.id} href={`/students/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-sunken">
            <div>
              <p className="font-medium">{s.last_name}, {s.first_name}</p>
              <p className="text-xs text-ink-3">Grade {s.grade}, {s.school}</p>
            </div>
            <p className="text-sm text-ink-3">{servicesFor(s.id).map((sv) => `${DISC[sv.discipline]} ${sv.minutes_per_week}/wk`).join(", ")}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
