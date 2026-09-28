import Link from "next/link";
import { engineMode } from "@/lib/draft";
import { RULE_PACKS } from "@/lib/rules";

export const metadata = { title: "Trust and data use | Sessionside" };

const DATA = [
  ["Student identity", "Name, date of birth, school, grade, Medicaid ID", "Identify the student on notes and claims (CMS minimum claim fields)"],
  ["IEP service data", "Service type, minutes per week, setting, provider, IEP dates", "Track mandated vs delivered minutes and check claim eligibility"],
  ["IEP goals", "Goal text and area", "Link session data to goals and draft progress reports"],
  ["Authorizations", "Parental billing consent dates, referral or order dates, ordering practitioner name and NPI", "Pre-claim checks required by IDEA (34 CFR 300.154) and state Medicaid rules"],
  ["Session records", "Date, time, minutes, attendance, activities, goal data, response, plan, clinician dictation text", "The clinical record and claim support"],
  ["Staff", "Name, email, credential, NPI, license number and expiration, supervisor", "Authentication, attestation, and credential checks"],
  ["Activity logs", "Sign-ins, edits, signatures, exports, and views of audit binders", "Security and audit defense"],
];

export default function TrustPage() {
  const ai = engineMode() === "claude";
  return (
    <main id="main" className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header>
        <Link href="/login" className="text-sm text-brand">Sessionside</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Trust and data use</h1>
        <p className="mt-2 text-ink-3">What Sessionside collects, why, how AI is used and limited, and the commitments a district&apos;s data privacy agreement can rely on.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data we collect and why</h2>
        <p className="text-sm text-ink-3">Written as the data inventory a district needs for an Illinois SOPPA agreement (105 ILCS 85) or a Student Data Privacy Consortium National DPA.</p>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Categories of student and staff data collected</caption>
            <thead className="border-b border-line text-xs text-ink-3">
              <tr><th scope="col" className="p-3">Category</th><th scope="col" className="p-3">Elements</th><th scope="col" className="p-3">Purpose</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {DATA.map(([c, e, p]) => (
                <tr key={c}><th scope="row" className="p-3 font-medium">{c}</th><td className="p-3">{e}</td><td className="p-3">{p}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">We do not collect audio of students. Clinicians dictate after the session; browser dictation runs on the clinician&apos;s device and only the resulting text is saved.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">How AI is used</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>AI drafts documentation only. It never decides eligibility, billing, minutes, or goal ratings on its own.</li>
          <li>Minutes come only from what the clinician entered or said, never from a model or a schedule.</li>
          <li>Every note needs an explicit clinician attestation before it is signed, and nothing is claimed without one.</li>
          <li>The original draft is kept next to the signed note, so every clinician change is visible to supervisors and auditors.</li>
          <li>Student data is never used to train models. The default drafting engine runs entirely on Sessionside servers with no AI provider.</li>
          <li>Optional AI drafting uses Anthropic&apos;s Claude API {ai ? "(enabled on this deployment)" : "(not enabled on this deployment)"} and requires a signed agreement before real student data is sent.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Security controls</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Access is limited to the district, and within it to the treating clinician, their supervisor, and the district Medicaid coordinator.</li>
          <li>Session tokens are stored hashed, sessions expire after 12 hours or 1 hour idle, and repeated failed sign-ins lock the account for 15 minutes.</li>
          <li>Signed notes cannot be edited or deleted; corrections are append-only addenda. The audit log is append-only.</li>
          <li>Notifications carry counts only, never student names or health details.</li>
          <li>Strict content security policy, no third-party scripts, no advertising or tracking.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Commitments for your data privacy agreement</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Sessionside acts as a school official under FERPA and uses student data only to provide the service to the district.</li>
          <li>No sale, rental, or marketing use of student data, and no targeted advertising.</li>
          <li>Breach notification to the district within 30 days of determination, as SOPPA requires, with cost allocation set in the agreement.</li>
          <li>Subprocessor list published and updated at least twice a year.</li>
          <li>Full district data export on request. Deletion at contract end, after the Medicaid record retention period the district specifies ({Object.values(RULE_PACKS).map((p) => `${p.name} ${p.retentionYears} years`).join(", ")}).</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Accessibility</h2>
        <p className="text-sm">Sessionside targets WCAG 2.1 Level AA, the standard in the Department of Justice ADA Title II rule for state and local governments, including school districts. Every release runs automated axe accessibility scans on each screen and a keyboard navigation check.</p>
      </section>

      <p className="text-xs text-ink-3">This page describes product behavior. It is not legal advice; the executed agreement between Sessionside and a district controls.</p>
    </main>
  );
}
