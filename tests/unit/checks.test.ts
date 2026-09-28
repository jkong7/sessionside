import { describe, expect, it } from "vitest";
import { billability, checkEncounter, type CheckContext } from "@/lib/checks";
import { isValidNpi, makeNpi } from "@/lib/npi";
import type { Note } from "@/lib/types";

const note: Note = {
  summary: "",
  activities: [],
  goals: [{ goal_id: "g1", correct: 8, trials: 10, percent: 80, cue: "minimal", evidence: "" }],
  response: "",
  plan: "",
  minutes: 30,
  minutes_source: "stated",
  setting: "individual",
  group_size: null,
  attendance: "present",
  cpt: "92507",
  units: 1,
  engine: "test",
  uncertain: [],
};

function ctx(over: Partial<CheckContext> = {}): CheckContext {
  return {
    encounter: { date: "2026-09-21", note, status: "signed", signed_at: "2026-09-21T20:00:00Z", cosigned_at: null },
    student: { id: "s", district_id: "d", first_name: "A", last_name: "B", dob: "2018-01-01", school: "X", grade: "2", medicaid_id: "IL123", iep_start: "2026-01-10", iep_end: "2027-01-09" },
    provider: { id: "u", email: "", name: "", role: "therapist", discipline: "slp", credential: "CCC-SLP", npi: makeNpi("123456789"), license_number: "146.1", license_expires: "2027-10-31", supervisor_id: null, district_id: "d" },
    services: [{ id: "sv", student_id: "s", discipline: "slp", minutes_per_week: 60, setting: "individual", provider_id: "u" }],
    consents: [{ id: "c", student_id: "s", kind: "medicaid_billing", signed_on: "2026-01-10", revoked_on: null }],
    orders: [{ id: "o0", student_id: "s", discipline: "slp", prescriber: "Dr", prescriber_npi: makeNpi("111111111"), signed_on: "2026-01-05", expires_on: "2027-01-04" }],
    settings: { state: "IL", noteDeadlineDays: 5, rates: {} },
    today: "2026-09-28",
    ...over,
  };
}

const codes = (c: CheckContext) => checkEncounter(c).map((i) => i.code);

describe("npi", () => {
  it("validates the Luhn check digit with the 80840 prefix", () => {
    expect(isValidNpi("1234567893")).toBe(true);
    expect(isValidNpi("1234567890")).toBe(false);
    expect(isValidNpi(makeNpi("198765432"))).toBe(true);
    expect(isValidNpi("123")).toBe(false);
  });
});

describe("checkEncounter", () => {
  it("passes a clean signed session", () => {
    expect(codes(ctx())).toEqual([]);
    expect(billability(ctx())).toBe("billable");
  });

  it("blocks missing and revoked consent", () => {
    expect(codes(ctx({ consents: [] }))).toContain("CONSENT_MISSING");
    expect(codes(ctx({ consents: [{ id: "c", student_id: "s", kind: "medicaid_billing", signed_on: "2026-01-10", revoked_on: "2026-09-01" }] }))).toContain("CONSENT_REVOKED");
    expect(billability(ctx({ consents: [] }))).toBe("blocked");
  });

  it("requires a current order for each discipline", () => {
    const ot = ctx({ provider: { ...ctx().provider, discipline: "ot" }, services: [{ ...ctx().services[0], discipline: "ot" }] });
    expect(codes(ot)).toContain("ORDER_MISSING");
    const expired = { ...ot, orders: [{ id: "o", student_id: "s", discipline: "ot" as const, prescriber: "Dr", prescriber_npi: makeNpi("111111111"), signed_on: "2025-09-01", expires_on: "2026-09-01" }] };
    expect(codes(expired)).toContain("ORDER_EXPIRED");
    expect(codes(ctx())).not.toContain("ORDER_MISSING");
    expect(codes(ctx({ orders: [] }))).toContain("ORDER_MISSING");
  });

  it("checks provider credentials", () => {
    expect(codes(ctx({ provider: { ...ctx().provider, npi: "1234567890" } }))).toContain("PROVIDER_NPI_INVALID");
    expect(codes(ctx({ provider: { ...ctx().provider, license_expires: "2026-09-01" } }))).toContain("LICENSE_EXPIRED");
    expect(codes(ctx({ provider: { ...ctx().provider, license_expires: "2026-10-15" } }))).toContain("LICENSE_EXPIRING");
  });

  it("never bills missing minutes", () => {
    const c = ctx({ encounter: { ...ctx().encounter, note: { ...note, minutes: null, minutes_source: "missing", cpt: null } } });
    expect(codes(c)).toContain("MINUTES_MISSING");
    expect(billability(c)).toBe("blocked");
  });

  it("warns on the district signing policy without blocking", () => {
    const draft = (date: string) => ctx({ encounter: { date, note, status: "draft", signed_at: null, cosigned_at: null } });
    expect(billability(draft("2026-09-25"))).toBe("ready_to_sign");
    expect(codes(draft("2026-09-23"))).toContain("SIGNATURE_DUE");
    expect(codes(draft("2026-09-17"))).toContain("SIGNATURE_OVERDUE");
    expect(billability(draft("2026-09-17"))).toBe("ready_to_sign");
  });

  it("holds assistant notes for co-signature", () => {
    const c = ctx({ provider: { ...ctx().provider, role: "assistant", supervisor_id: "sup" } });
    expect(billability(c)).toBe("awaiting_cosign");
    expect(billability({ ...c, encounter: { ...c.encounter, cosigned_at: "2026-09-22T00:00:00Z" } })).toBe("billable");
  });

  it("marks absences as not delivered", () => {
    const c = ctx({ encounter: { ...ctx().encounter, note: { ...note, attendance: "student_absent", minutes: 0, cpt: null } } });
    expect(codes(c)).toEqual(["NOT_DELIVERED"]);
    expect(billability(c)).toBe("not_billable");
  });

  it("blocks sessions outside the IEP or not on it", () => {
    expect(codes(ctx({ encounter: { ...ctx().encounter, date: "2027-02-01" } }))).toContain("IEP_NOT_ACTIVE");
    expect(codes(ctx({ services: [] }))).toContain("NOT_ON_IEP");
  });
});

import { validateNote } from "@/lib/validate";

describe("validateNote", () => {
  it("accepts a clean note", () => {
    expect(validateNote(note)).toEqual([]);
  });
  it("rejects impossible values", () => {
    expect(validateNote({ ...note, minutes: 500 })).toHaveLength(1);
    expect(validateNote({ ...note, minutes: 0 })).toContain("A delivered session needs more than 0 minutes.");
    expect(validateNote({ ...note, group_size: 1 })).toHaveLength(1);
    expect(validateNote({ ...note, goals: [{ ...note.goals[0], correct: 11, trials: 10 }] })).toContain("Correct cannot be more than trials.");
    expect(validateNote({ ...note, goals: [{ ...note.goals[0], percent: 140 }] })).toContain("Percent must be from 0 to 100.");
  });
});

describe("state rule packs", () => {
  const withState = (state: "IL" | "NY" | "TX" | "MI", over: Partial<CheckContext> = {}) => {
    const base = ctx(over);
    return { ...base, settings: { state, rates: {} } };
  };

  it("Texas blocks notes signed more than 7 days late", () => {
    const c = withState("TX", { encounter: { date: "2026-09-10", note: { ...note, time_start: "09:00", time_end: "09:30" }, status: "signed", signed_at: "2026-09-20T12:00:00Z", cosigned_at: null } });
    expect(checkEncounter(c).find((i) => i.code === "SIGNED_LATE")?.severity).toBe("block");
  });

  it("New York and Texas require start and end times", () => {
    expect(codes(withState("NY"))).toContain("TIMES_MISSING");
    expect(codes(withState("TX"))).toContain("TIMES_MISSING");
    expect(codes(withState("IL"))).not.toContain("TIMES_MISSING");
  });

  it("Michigan limits groups to 2 through 8", () => {
    const c = withState("MI", { encounter: { ...ctx().encounter, note: { ...note, setting: "group", group_size: 9, cpt: "92508", time_start: "09:00", time_end: "09:30" } } });
    expect(codes(c)).toContain("GROUP_SIZE_INVALID");
  });

  it("Texas caps speech at one unit per day", () => {
    const c = { ...withState("TX", { encounter: { ...ctx().encounter, note: { ...note, time_start: "09:00", time_end: "09:30" } } }), sameDayUnits: 1 };
    expect(codes(c)).toContain("DAILY_UNIT_CAP");
  });

  it("New York requires goal linkage and co-sign within 45 days", () => {
    expect(checkEncounter(withState("NY", { encounter: { ...ctx().encounter, note: { ...note, goals: [] } } })).find((i) => i.code === "NO_GOAL_DATA")?.severity).toBe("block");
    const c = withState("NY", {
      provider: { ...ctx().provider, role: "assistant", supervisor_id: "sup" },
      encounter: { date: "2026-08-01", note: { ...note, time_start: "09:00", time_end: "09:30" }, status: "cosign_pending", signed_at: "2026-08-01T12:00:00Z", cosigned_at: null },
    });
    expect(codes(c)).toContain("COSIGN_OVERDUE");
  });

  it("Illinois enforces the 180-day filing limit and CCC for SLPs", () => {
    expect(codes(ctx({ encounter: { ...ctx().encounter, date: "2026-03-01" }, student: { ...ctx().student, iep_start: "2026-01-01" } }))).toContain("PAST_FILING_LIMIT");
    expect(codes(ctx({ provider: { ...ctx().provider, credential: "M.S." } }))).toContain("CREDENTIAL_NOT_BILLABLE");
  });
});

describe("attendance cross-check", () => {
  it("blocks billing when school attendance shows the student absent", () => {
    expect(codes({ ...ctx(), schoolAttendance: "absent" })).toContain("SCHOOL_ABSENT");
    expect(codes({ ...ctx(), schoolAttendance: "present" })).not.toContain("SCHOOL_ABSENT");
  });
});
