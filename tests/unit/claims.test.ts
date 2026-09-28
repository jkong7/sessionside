import { describe, expect, it } from "vitest";
import { toCsv, type ClaimLine } from "@/lib/claims";

const line: ClaimLine = {
  encounterId: "enc_1",
  date: "2026-09-21",
  studentName: "Morales, Ava",
  medicaidId: "IL710000000",
  providerName: "Maya Chen",
  providerNpi: "1548720931",
  cpt: "92507",
  units: 1,
  minutes: 30,
  setting: "individual",
  groupSize: null,
  pos: "03",
  value: 58.4,
};

describe("toCsv", () => {
  it("quotes commas and neutralizes formula injection", () => {
    const csv = toCsv([line, { ...line, studentName: "=HYPERLINK(1)" }]);
    const rows = csv.trim().split("\n");
    expect(rows[0]).toContain("procedure_code");
    expect(rows[1]).toContain('"Morales, Ava"');
    expect(rows[2]).toContain("'=HYPERLINK(1)");
    expect(rows[1].split(",").at(-2)).toBe("03");
  });
});
