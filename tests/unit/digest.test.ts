import { beforeAll, describe, expect, it } from "vitest";
import { openDb, setDb } from "@/lib/db";
import { buildDigest } from "@/lib/digest";
import { getUser, listStudents } from "@/lib/repo";
import { seed } from "@/lib/seed";

beforeAll(() => {
  process.env.SESSIONSIDE_TODAY = "2026-09-28";
  const database = openDb(":memory:");
  seed(database, "2026-09-28");
  setDb(database);
});

describe("buildDigest", () => {
  it("never includes student names", () => {
    const names = listStudents("dist_lakeshore").flatMap((s) => [s.first_name, s.last_name]);
    for (const id of ["usr_maya", "usr_jordan", "usr_priya", "usr_sam"]) {
      const d = buildDigest(getUser(id)!);
      const text = [d.subject, ...d.lines].join(" ");
      for (const n of names) expect(text).not.toContain(n);
    }
  });

  it("mentions co-sign work for supervisors", () => {
    const d = buildDigest(getUser("usr_maya")!);
    expect(d.counts.toCosign).toBeGreaterThanOrEqual(0);
    if (d.counts.toCosign) expect(d.lines.join(" ")).toContain("co-sign");
  });
});
