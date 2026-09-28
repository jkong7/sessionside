import { addDays, daysBetween } from "./dates";
import { isValidNpi } from "./npi";
import { rulePack, type RulePack } from "./rules";
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
  sameDayUnits?: number;
};

export type Billability = "billable" | "ready_to_sign" | "awaiting_cosign" | "blocked" | "not_billable";

const ATTENDANCE_TEXT: Record<string, string> = {
  student_absent: "Student absent or unavailable",
  provider_absent: "Provider absent",
  school_closed: "School closed",
};

export function packFor(settings: DistrictSettings): RulePack {
  return rulePack(settings.state);
}

export function noteDeadline(settings: DistrictSettings): { days: number; hard: boolean } | null {
  const pack = packFor(settings);
  if (pack.noteDeadline) return pack.noteDeadline;
  if (settings.noteDeadlineDays != null) return { days: settings.noteDeadlineDays, hard: false };
  return null;
}

export function checkEncounter(ctx: CheckContext): Issue[] {
  const { encounter, student, provider, settings, today } = ctx;
  const pack = packFor(settings);
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

  if (discipline && pack.orders[discipline].required) {
    const rule = pack.orders[discipline];
    const order = ctx.orders
      .filter((o) => o.discipline === discipline && o.signed_on <= date)
      .sort((a, b) => b.signed_on.localeCompare(a.signed_on))[0];
    const future = ctx.orders.find((o) => o.discipline === discipline && o.signed_on > date);
    if (!order) {
      add(
        "ORDER_MISSING",
        "block",
        future ? `${rule.label} was signed ${future.signed_on}, after this session.` : `No signed ${rule.label.toLowerCase()} on file (${pack.name} requires one for this service).`,
        future ? `${pack.name} requires the ${rule.label.toLowerCase()} before services begin.` : `Request a ${rule.label.toLowerCase()} from an enrolled practitioner.`,
      );
    } else {
      const limit = addDays(order.signed_on, rule.validityDays);
      const expires = order.expires_on < limit ? order.expires_on : limit;
      if (expires < date) add("ORDER_EXPIRED", "block", `${rule.label} expired ${expires}.`, `Renew it; ${pack.name} accepts ${rule.validityDays >= 1000 ? "3-year" : "annual"} ${rule.label.toLowerCase()}s.`);
      else if (!isValidNpi(order.prescriber_npi)) add("PRESCRIBER_NPI_INVALID", "block", `Ordering practitioner NPI ${order.prescriber_npi} fails the NPI check digit.`, "Correct the NPI on the order; it is required on the claim.");
      else {
        const left = daysBetween(today, expires);
        if (left >= 0 && left <= 30) add("ORDER_EXPIRING", "warn", `${rule.label} expires in ${left} days (${expires}).`, "Request the renewal now so upcoming sessions stay billable.");
      }
    }
  }

  if (!isValidNpi(provider.npi)) add("PROVIDER_NPI_INVALID", "block", `Your NPI ${provider.npi || "(blank)"} is not a valid NPI.`, "Fix the NPI in your profile.");
  if (!provider.license_expires || provider.license_expires < date) add("LICENSE_EXPIRED", "block", `License ${provider.license_number || ""} was not active on the session date.`.replace("  ", " "), "Upload a renewed license.");
  else {
    const left = daysBetween(today, provider.license_expires);
    if (left >= 0 && left <= 45) add("LICENSE_EXPIRING", "warn", `License expires in ${left} days (${provider.license_expires}).`, "Renew now so future sessions stay billable.");
  }
  if (pack.requireCccForSlp && discipline === "slp" && provider.role === "therapist" && !/CCC/i.test(provider.credential)) {
    add("CREDENTIAL_NOT_BILLABLE", "block", `${pack.name} requires ASHA CCC or equivalent for SLP claims.`, "Record the CCC or equivalency, or have a qualified SLP supervise and co-sign.");
  }

  if (note.minutes == null || note.minutes_source === "missing") add("MINUTES_MISSING", "block", "Actual session minutes are missing.", "Enter the minutes you delivered. Scheduled minutes are never assumed.");
  else if (!note.cpt) add("CODE_MISSING", "block", "No billable code for this session length.", "Timed codes need at least 8 minutes.");

  if (pack.requireTimes && (!note.time_start || !note.time_end)) add("TIMES_MISSING", "block", `${pack.name} requires start and end times on the note.`, "Enter when the session started and ended.");

  if (note.setting === "group") {
    if (!note.group_size) add("GROUP_SIZE_MISSING", pack.group.max ? "block" : "warn", "Group session without a group size.", "Add how many students were in the group.");
    else if (note.group_size < pack.group.min || (pack.group.max != null && note.group_size > pack.group.max)) {
      add("GROUP_SIZE_INVALID", "block", `${pack.name} allows groups of ${pack.group.min} to ${pack.group.max ?? "any size"}; this note says ${note.group_size}.`, "Correct the group size or split the group.");
    }
  }

  if (note.goals.length === 0) {
    if (pack.requireGoalLink) add("NO_GOAL_DATA", "block", `${pack.name} requires the related IEP goal on every note.`, "Add data for at least one IEP goal.");
    else add("NO_GOAL_DATA", "warn", "No progress data for any IEP goal.", "Add data for at least one goal so the note supports progress reporting.");
  }
  for (const u of note.uncertain.filter((x) => x.includes("did not match"))) add("UNMATCHED_DATA", "warn", u, "Link the data to a goal or delete it.");

  if (discipline && note.cpt) {
    const cap = pack.codes[discipline].maxUnitsPerDay;
    const total = (ctx.sameDayUnits ?? 0) + note.units;
    if (cap != null && total > cap) add("DAILY_UNIT_CAP", "block", `${total} units for this student today; ${pack.name} allows ${cap} per day for this service.`, "Only the first units up to the cap can be claimed.");
  }

  if (provider.role === "assistant") {
    if (!provider.supervisor_id) add("SUPERVISOR_MISSING", "block", "Assistant has no supervising therapist on file.", "Assign a supervisor in district settings.");
    if (pack.cosign.withinDays != null && encounter.status === "cosign_pending" && encounter.signed_at) {
      const waited = daysBetween(encounter.signed_at.slice(0, 10), today);
      if (waited > pack.cosign.withinDays) add("COSIGN_OVERDUE", "block", `Supervisor co-sign is ${waited} days after signing (limit ${pack.cosign.withinDays}).`, "Co-sign now; late co-signs may not support the claim.");
    }
  }

  const deadline = noteDeadline(settings);
  if (deadline) {
    if (encounter.status === "draft") {
      const elapsed = daysBetween(date, today);
      if (elapsed > deadline.days) add("SIGNATURE_OVERDUE", deadline.hard ? "block" : "warn", `Unsigned ${elapsed} days after the session (${deadline.hard ? `${pack.name} limit` : "district policy"} ${deadline.days === 0 ? "same day" : `${deadline.days} days`}).`, deadline.hard ? "Late notes do not support a claim." : "Sign now; late notes draw audit attention.");
      else if (elapsed === deadline.days && deadline.days > 0) add("SIGNATURE_DUE", "warn", "Signature due today.", "Review and sign today.");
    } else if (encounter.signed_at) {
      const elapsed = daysBetween(date, encounter.signed_at.slice(0, 10));
      if (elapsed > deadline.days) add("SIGNED_LATE", deadline.hard ? "block" : "warn", `Signed ${elapsed} days after the session (limit ${deadline.days === 0 ? "same day" : `${deadline.days} days`}).`, deadline.hard ? `${pack.name} does not accept late documentation.` : "Late signatures can be questioned on audit.");
    }
  }

  if (pack.filingLimitDays != null && daysBetween(date, today) > pack.filingLimitDays) {
    add("PAST_FILING_LIMIT", "block", `More than ${pack.filingLimitDays} days since the session.`, `${pack.name} will reject claims past its timely filing limit.`);
  }

  return issues;
}

export function billability(ctx: CheckContext, issues = checkEncounter(ctx)): Billability {
  if (ctx.encounter.note.attendance !== "present") return "not_billable";
  const blocking = issues.filter((i) => i.severity === "block");
  if (ctx.encounter.status === "draft") return blocking.length ? "blocked" : "ready_to_sign";
  if (blocking.length) return "blocked";
  if (ctx.provider.role === "assistant" && packFor(ctx.settings).cosign.required && !ctx.encounter.cosigned_at) return "awaiting_cosign";
  return "billable";
}

export const BILLABILITY_LABEL: Record<Billability, string> = {
  billable: "Billable",
  ready_to_sign: "Ready to sign",
  awaiting_cosign: "Awaiting co-sign",
  blocked: "Blocked",
  not_billable: "Not delivered",
};
