import { beforeAll, describe, expect, it } from "vitest";
import { openDb, setDb } from "@/lib/db";
import { weekReport } from "@/lib/minutes";
import { seed } from "@/lib/seed";

const BASE = "2026-09-28";

beforeAll(() => {
  process.env.SESSIONSIDE_TODAY = BASE;
  const database = openDb(":memory:");
  seed(database, BASE);
  setDb(database);
});

describe("weekReport", () => {
  it("reports every IEP service with consistent totals", () => {
    const r = weekReport({ districtId: "dist_lakeshore", weekStart: "2026-09-21", today: BASE });
    expect(r.rows.length).toBe(15);
    for (const row of r.rows) {
      expect(row.billable).toBeLessThanOrEqual(row.delivered);
      expect(row.owed).toBe(Math.max(0, row.mandated - row.delivered - row.remaining));
      expect(row.remaining).toBe(0);
    }
    expect(r.totals.delivered).toBe(r.rows.reduce((n, x) => n + x.delivered, 0));
  });

  it("counts future sessions in the current week as remaining, not owed", () => {
    const r = weekReport({ districtId: "dist_lakeshore", weekStart: BASE, today: BASE });
    const remaining = r.rows.reduce((n, x) => n + x.remaining, 0);
    expect(remaining).toBeGreaterThan(0);
    expect(r.totals.unloggedSessions).toBe(0);
  });

  it("scopes to a provider", () => {
    const r = weekReport({ districtId: "dist_lakeshore", providerIds: ["usr_priya"], weekStart: "2026-09-21", today: BASE });
    expect(r.rows.every((x) => x.provider.id === "usr_priya")).toBe(true);
    expect(r.rows.length).toBe(4);
  });
});
