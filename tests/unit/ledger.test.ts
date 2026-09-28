import { describe, expect, it } from "vitest";
import { owedBalance, weeklyLedger } from "@/lib/ledger";
import type { Encounter, Note, Service, Slot } from "@/lib/types";

const service: Service = { id: "sv", student_id: "s", discipline: "slp", minutes_per_week: 60, setting: "individual", provider_id: "p" };
const slots: Slot[] = [
  { id: "a", provider_id: "p", student_id: "s", weekday: 2, start: "09:00", minutes: 30, setting: "individual" },
  { id: "b", provider_id: "p", student_id: "s", weekday: 4, start: "09:00", minutes: 30, setting: "individual" },
];

function enc(date: string, attendance: string, minutes: number): Encounter {
  const note = { attendance, minutes } as unknown as Note;
  return { id: date, student_id: "s", provider_id: "p", date, start: "09:00", transcript: "", note, status: "signed", signed_at: null, signed_by: null, cosigned_at: null, cosigned_by: null, created_at: "", updated_at: "" };
}

describe("make-up ledger", () => {
  it("counts provider misses as owed, excuses student absences, and pays down with extra minutes", () => {
    const weeks = weeklyLedger({
      service,
      slots,
      encounters: [
        enc("2026-09-08", "present", 30),
        enc("2026-09-10", "provider_absent", 0),
        enc("2026-09-15", "present", 30),
        enc("2026-09-17", "student_absent", 0),
        enc("2026-09-22", "present", 30),
        enc("2026-09-23", "present", 30),
        enc("2026-09-24", "present", 30),
      ],
      from: "2026-09-07",
      throughWeekEnding: "2026-09-25",
    });
    expect(weeks.map((w) => w.shortfall)).toEqual([30, 0, 0]);
    expect(weeks[1].excused).toBe(30);
    expect(weeks[2].surplus).toBe(30);
    expect(owedBalance(weeks)).toBe(0);
  });

  it("treats unlogged weeks as owed", () => {
    const weeks = weeklyLedger({ service, slots, encounters: [enc("2026-09-08", "present", 30)], from: "2026-09-07", throughWeekEnding: "2026-09-18" });
    expect(owedBalance(weeks)).toBe(90);
  });

  it("never lets surplus create credit before a shortfall", () => {
    expect(owedBalance([{ weekStart: "a", mandated: 60, delivered: 90, excused: 0, shortfall: 0, surplus: 30 }, { weekStart: "b", mandated: 60, delivered: 30, excused: 0, shortfall: 30, surplus: 0 }])).toBe(30);
  });
});
