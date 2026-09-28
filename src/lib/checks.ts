import { businessDaysBetween, daysBetween } from "./dates";
import { isValidNpi } from "./npi";
import type { Consent, DistrictSettings, Encounter, Order, Service, Student, User } from "./types";

export type Severity = "block" | "warn" | "info";

export type Issue = {
  code: string;
  severity: Severity;
  message: string;
  fix: string;
};

export type CheckContext = {
  encounter: Pick<Encounter, "date" | "note" | "status" | "signed_at" | "cosigned_at">;
  student: Student;
  provider: User;
  services: Service[];
  consents: Consent[];
  orders: Order[];
  settings: DistrictSettings;
  today: string;
};

export type Billability = "billable" | "ready_to_sign" | "awaiting_cosign" | "blocked" | "not_billable";

const ATTENDANCE_TEXT: Record<string, string> = {
  student_absent: "Student absent or unavailable",
  provider_absent: "Provider absent",
  school_closed: "School closed",
};

export function checkEncounter(ctx: CheckContext): Issue[] {
  const { encounter, student, provider, settings, today } = ctx;
  const note = encounter.note;
  const date = encounter.date;
  const discipline = provider.discipline;
  const issues: Issue[] = [];
  const add = (code: string, severity: Severity, message: string, fix: string) => issues.push({ code, severity, message, fix });

  if (note.attendance !== "present") {
    add(
      "NOT_DELIVERED",
      "info",
      `${ATTENDANCE_TEXT[note.attendance]}. Not billable.`,
      note.attendance === "provider_absent" ? "Schedule a make-up session so IEP minutes are met." : "Logged for IEP minute tracking.",
    );
    return issues;
  }

  if (!student.medicaid_id) add("MEDICAID_ID_MISSING", "block", "Student has no Medicaid ID on file.", "Confirm enrollment with the district Medicaid coordinator.");

  const consent = ctx.consents
    .filter((c) => c.kind === "medicaid_billing" && c.signed_on <= date)
    .sort((a, b) => b.signed_on.localeCompare(a.signed_on))[0];
  if (!consent) add("CONSENT_MISSING", "block", "No parental consent to bill Medicaid on file for this date.", "Request one-time parental consent (34 CFR 300.154).");
  else if (consent.revoked_on && consent.revoked_on <= date) add("CONSENT_REVOKED", "block", `Parent revoked Medicaid billing consent on ${consent.revoked_on}.`, "Deliver services as written in the IEP; do not bill.");

  if (date < student.iep_start || date > student.iep_end) add("IEP_NOT_ACTIVE", "block", `Session date is outside the IEP (${student.iep_start} to ${student.iep_end}).`, "Update the IEP dates or confirm the annual review was held.");

  const service = ctx.services.find((s) => s.discipline === discipline);
  if (!service) add("NOT_ON_IEP", "block", "This service is not on the student's IEP.", "Only IEP-mandated services can be claimed.");

  if (discipline && settings.ordersRequired.includes(discipline)) {
    const order = ctx.orders
      .filter((o) => o.discipline === discipline && o.signed_on <= date)
      .sort((a, b) => b.signed_on.localeCompare(a.signed_on))[0];
    if (!order) add("ORDER_MISSING", "block", "No signed referral or prescription on file.", "Request an order from a licensed prescriber.");
    else if (order.expires_on < date) add("ORDER_EXPIRED", "block", `Referral expired ${order.expires_on}.`, "Request a renewed order before claiming.");
    else if (!isValidNpi(order.prescriber_npi)) add("PRESCRIBER_NPI_INVALID", "block", `Prescriber NPI ${order.prescriber_npi} fails the NPI check digit.`, "Correct the prescriber NPI on the order.");
  }

  if (!isValidNpi(provider.npi)) add("PROVIDER_NPI_INVALID", "block", `Your NPI ${provider.npi || "(blank)"} is not a valid NPI.`, "Fix the NPI in your profile.");
  if (!provider.license_expires || provider.license_expires < date) add("LICENSE_EXPIRED", "block", `License ${provider.license_number || ""} was not active on the session date.`.replace("  ", " "), "Upload a renewed license.");
  else {
    const left = daysBetween(today, provider.license_expires);
    if (left >= 0 && left <= 45) add("LICENSE_EXPIRING", "warn", `License expires in ${left} days (${provider.license_expires}).`, "Renew now so future sessions stay billable.");
  }

  if (note.minutes == null || note.minutes_source === "missing") add("MINUTES_MISSING", "block", "Actual session minutes are missing.", "Enter the minutes you delivered. Scheduled minutes are never assumed.");
  else if (!note.cpt) add("CODE_MISSING", "block", "No billable code for this session length.", "Timed codes need at least 8 minutes.");

  if (note.setting === "group" && !note.group_size) add("GROUP_SIZE_MISSING", "warn", "Group session without a group size.", "Add how many students were in the group.");
  if (note.goals.length === 0) add("NO_GOAL_DATA", "warn", "No progress data for any IEP goal.", "Add data for at least one goal so the note supports progress reporting.");
  for (const u of note.uncertain.filter((x) => x.includes("did not match"))) add("UNMATCHED_DATA", "warn", u, "Link the data to a goal or delete it.");

  if (provider.role === "assistant" && !provider.supervisor_id) add("SUPERVISOR_MISSING", "block", "Assistant has no supervising therapist on file.", "Assign a supervisor in district settings.");

  const deadline = settings.signatureDeadlineDays;
  if (encounter.status === "draft") {
    const elapsed = businessDaysBetween(date, today);
    if (elapsed > deadline) add("SIGNATURE_OVERDUE", "block", `Unsigned ${elapsed} business days after the session (limit ${deadline}).`, "Sign now; late notes may be denied.");
    else if (elapsed === deadline) add("SIGNATURE_DUE", "warn", "Signature due today.", "Review and sign today.");
  } else if (encounter.signed_at) {
    const elapsed = businessDaysBetween(date, encounter.signed_at.slice(0, 10));
    if (elapsed > deadline) add("SIGNED_LATE", "warn", `Signed ${elapsed} business days after the session (limit ${deadline}).`, "Late signatures can be denied on audit.");
  }

  return issues;
}

export function billability(ctx: CheckContext, issues = checkEncounter(ctx)): Billability {
  if (ctx.encounter.note.attendance !== "present") return "not_billable";
  const blocking = issues.filter((i) => i.severity === "block" && i.code !== "SIGNATURE_OVERDUE");
  if (blocking.length) return "blocked";
  if (ctx.encounter.status === "draft") return issues.some((i) => i.code === "SIGNATURE_OVERDUE") ? "blocked" : "ready_to_sign";
  if (ctx.provider.role === "assistant" && !ctx.encounter.cosigned_at) return "awaiting_cosign";
  return "billable";
}

export const BILLABILITY_LABEL: Record<Billability, string> = {
  billable: "Billable",
  ready_to_sign: "Ready to sign",
  awaiting_cosign: "Awaiting co-sign",
  blocked: "Blocked",
  not_billable: "Not delivered",
};
