import { beforeAll, describe, expect, it } from "vitest";
import { openDb, setDb } from "@/lib/db";
import { BUILT_IN_PROFILES, rowsFor } from "@/lib/exportProfiles";
import { encountersFor } from "@/lib/repo";
import { seed } from "@/lib/seed";
import { evaluate } from "@/lib/status";

beforeAll(() => {
  process.env.SESSIONSIDE_TODAY = "2026-09-28";
  const database = openDb(":memory:");
  seed(database, "2026-09-28");
  setDb(database);
});

describe("export profiles", () => {
  it("service log includes absences and only signed sessions", () => {
    const encs = encountersFor({ providerIds: ["usr_maya", "usr_jordan", "usr_priya", "usr_sam"] }).map(evaluate);
    const profile = BUILT_IN_PROFILES.find((p) => p.id === "service-log")!;
    const rows = rowsFor(profile, encs, (id) => id);
    expect(rows.length).toBe(encs.filter((e) => e.status !== "draft").length);
    expect(rows.every((r) => r.length === profile.columns.length)).toBe(true);
    expect(rows.some((r) => r[4] === "SA" || r[4] === "PA")).toBe(true);
    expect(rows[0][0]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("billing log excludes absences", () => {
    const encs = encountersFor({ providerIds: ["usr_maya"] }).map(evaluate);
    const profile = BUILT_IN_PROFILES.find((p) => p.id === "medicaid-portal")!;
    const rows = rowsFor(profile, encs, (id) => id);
    expect(rows.length).toBe(encs.filter((e) => e.status !== "draft" && e.note.attendance === "present").length);
  });
});
