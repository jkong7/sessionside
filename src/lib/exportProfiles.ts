import { ordersFor, getStudent, getUser } from "./repo";
import type { Evaluated } from "./status";

export type ExportField =
  | "date"
  | "date_us"
  | "student_last"
  | "student_first"
  | "student_dob"
  | "medicaid_id"
  | "school"
  | "provider"
  | "provider_npi"
  | "credential"
  | "service"
  | "attendance"
  | "attendance_code"
  | "minutes"
  | "time_start"
  | "time_end"
  | "setting"
  | "group_size"
  | "procedure_code"
  | "modifiers"
  | "units"
  | "ordering_npi"
  | "goals_addressed"
  | "progress"
  | "note_summary"
  | "signed_date"
  | "status";

export const FIELD_LABELS: Record<ExportField, string> = {
  date: "Service date (YYYY-MM-DD)",
  date_us: "Service date (MM/DD/YYYY)",
  student_last: "Student last name",
  student_first: "Student first name",
  student_dob: "Student date of birth",
  medicaid_id: "Medicaid ID",
  school: "School",
  provider: "Provider name",
  provider_npi: "Provider NPI",
  credential: "Provider credential",
  service: "Service (Speech, OT, PT)",
  attendance: "Attendance",
  attendance_code: "Attendance code (P, SA, PA, SC)",
  minutes: "Minutes",
  time_start: "Start time",
  time_end: "End time",
  setting: "Individual or group",
  group_size: "Group size",
  procedure_code: "Procedure code",
  modifiers: "Modifiers",
  units: "Units",
  ordering_npi: "Ordering practitioner NPI",
  goals_addressed: "IEP goals addressed",
  progress: "Progress data",
  note_summary: "Note summary",
  signed_date: "Signed date",
  status: "Sessionside status",
};

export type ExportProfile = { id: string; name: string; description: string; columns: { field: ExportField; header: string }[]; onlySigned: boolean; includeAbsences: boolean };

const col = (field: ExportField, header: string) => ({ field, header });

export const BUILT_IN_PROFILES: ExportProfile[] = [
  {
    id: "service-log",
    name: "Service log (IEP system)",
    description: "One row per scheduled session including absences, for pasting or importing into your IEP or service-tracking system.",
    onlySigned: true,
    includeAbsences: true,
    columns: [
      col("date_us", "Date"),
      col("student_last", "Last Name"),
      col("student_first", "First Name"),
      col("service", "Service"),
      col("attendance_code", "Attendance"),
      col("minutes", "Minutes"),
      col("setting", "Setting"),
      col("group_size", "Group Size"),
      col("provider", "Provider"),
      col("goals_addressed", "Goals Addressed"),
      col("progress", "Progress"),
    ],
  },
  {
    id: "medicaid-portal",
    name: "Medicaid billing log",
    description: "Delivered sessions with the fields billing portals and claiming vendors ask for.",
    onlySigned: true,
    includeAbsences: false,
    columns: [
      col("date", "DOS"),
      col("medicaid_id", "Medicaid ID"),
      col("student_last", "Last Name"),
      col("student_first", "First Name"),
      col("student_dob", "DOB"),
      col("provider", "Rendering Provider"),
      col("provider_npi", "Rendering NPI"),
      col("ordering_npi", "Ordering NPI"),
      col("procedure_code", "Procedure"),
      col("modifiers", "Modifiers"),
      col("units", "Units"),
      col("minutes", "Minutes"),
      col("time_start", "Start"),
      col("time_end", "End"),
      col("group_size", "Group Size"),
      col("signed_date", "Signed"),
    ],
  },
];

const DISC: Record<string, string> = { slp: "Speech", ot: "OT", pt: "PT" };
const ATT: Record<string, [string, string]> = {
  present: ["Delivered", "P"],
  student_absent: ["Student absent", "SA"],
  provider_absent: ["Provider absent", "PA"],
  school_closed: ["School closed", "SC"],
};

export function fieldValue(field: ExportField, e: Evaluated, goalName: (id: string) => string): string | number | null {
  const s = getStudent(e.student_id)!;
  const p = getUser(e.provider_id)!;
  const n = e.note;
  switch (field) {
    case "date":
      return e.date;
    case "date_us": {
      const [y, m, d] = e.date.split("-");
      return `${m}/${d}/${y}`;
    }
    case "student_last":
      return s.last_name;
    case "student_first":
      return s.first_name;
    case "student_dob":
      return s.dob;
    case "medicaid_id":
      return s.medicaid_id;
    case "school":
      return s.school;
    case "provider":
      return p.name;
    case "provider_npi":
      return p.npi;
    case "credential":
      return p.credential;
    case "service":
      return DISC[p.discipline ?? ""] ?? "";
    case "attendance":
      return ATT[n.attendance][0];
    case "attendance_code":
      return ATT[n.attendance][1];
    case "minutes":
      return n.minutes;
    case "time_start":
      return n.time_start ?? null;
    case "time_end":
      return n.time_end ?? null;
    case "setting":
      return n.setting;
    case "group_size":
      return n.group_size;
    case "procedure_code":
      return n.cpt;
    case "modifiers":
      return (n.modifiers ?? []).join(" ");
    case "units":
      return n.units;
    case "ordering_npi":
      return ordersFor(s.id).filter((o) => o.discipline === p.discipline && o.signed_on <= e.date).at(-1)?.prescriber_npi ?? null;
    case "goals_addressed":
      return n.goals.map((g) => goalName(g.goal_id)).join("; ");
    case "progress":
      return n.goals.map((g) => `${goalName(g.goal_id)}: ${g.correct != null && g.trials ? `${g.correct}/${g.trials}` : ""}${g.percent != null ? ` ${g.percent}%` : ""}${g.cue ? ` ${g.cue}` : ""}`.trim()).join("; ");
    case "note_summary":
      return n.summary;
    case "signed_date":
      return e.signed_at?.slice(0, 10) ?? null;
    case "status":
      return e.state;
  }
}

export function rowsFor(profile: ExportProfile, encounters: Evaluated[], goalName: (id: string) => string): (string | number | null)[][] {
  return encounters
    .filter((e) => (profile.onlySigned ? e.status !== "draft" : true))
    .filter((e) => (profile.includeAbsences ? true : e.note.attendance === "present"))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((e) => profile.columns.map((c) => fieldValue(c.field, e, goalName)));
}

export function profilesFor(settings: { exportProfiles?: unknown[] }): ExportProfile[] {
  return [...BUILT_IN_PROFILES, ...((settings.exportProfiles ?? []) as ExportProfile[])];
}
