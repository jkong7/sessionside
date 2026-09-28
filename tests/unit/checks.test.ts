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
    orders: [],
    settings: { signatureDeadlineDays: 5, ordersRequired: ["ot", "pt"], rates: {} },
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

  it("requires orders only for configured disciplines", () => {
    const ot = ctx({ provider: { ...ctx().provider, discipline: "ot" }, services: [{ ...ctx().services[0], discipline: "ot" }] });
    expect(codes(ot)).toContain("ORDER_MISSING");
    const expired = { ...ot, orders: [{ id: "o", student_id: "s", discipline: "ot" as const, prescriber: "Dr", prescriber_npi: makeNpi("111111111"), signed_on: "2025-09-01", expires_on: "2026-09-01" }] };
    expect(codes(expired)).toContain("ORDER_EXPIRED");
    expect(codes(ctx())).not.toContain("ORDER_MISSING");
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

  it("tracks signature deadlines in business days", () => {
    const draft = (date: string) => ctx({ encounter: { date, note, status: "draft", signed_at: null, cosigned_at: null } });
    expect(billability(draft("2026-09-25"))).toBe("ready_to_sign");
    expect(codes(draft("2026-09-21"))).toContain("SIGNATURE_DUE");
    expect(codes(draft("2026-09-17"))).toContain("SIGNATURE_OVERDUE");
    expect(billability(draft("2026-09-17"))).toBe("blocked");
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
