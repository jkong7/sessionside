import { beforeAll, describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import { db, openDb, setDb } from "@/lib/db";
import { runImport } from "@/lib/importers";
import { contextFor, encountersFor } from "@/lib/repo";
import { checkEncounter } from "@/lib/checks";
import { seed } from "@/lib/seed";

beforeAll(() => {
  process.env.SESSIONSIDE_TODAY = "2026-09-28";
  const database = openDb(":memory:");
  seed(database, "2026-09-28");
  setDb(database);
});

describe("csv", () => {
  it("parses quotes, escaped quotes, and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
});

describe("imports", () => {
  const students = "student_id,first_name,last_name,dob,school,grade,medicaid_id,iep_start,iep_end\nS100,Nora,Quinn,2017-03-02,Dewey Elementary,3,IL999000111,2026-08-20,2027-08-19\n";

  it("previews without writing, then commits", () => {
    const preview = runImport("dist_lakeshore", "students", students, false);
    expect(preview).toMatchObject({ total: 1, valid: 1, errors: [], committed: false });
    expect(db().prepare("SELECT COUNT(*) AS n FROM students WHERE local_id = 'S100'").get()).toEqual({ n: 0 });
    expect(runImport("dist_lakeshore", "students", students, true).committed).toBe(true);
    expect(db().prepare("SELECT COUNT(*) AS n FROM students WHERE local_id = 'S100'").get()).toEqual({ n: 1 });
  });

  it("reports row errors and refuses to commit a bad file", () => {
    const r = runImport("dist_lakeshore", "orders", "student_id,discipline,prescriber,prescriber_npi,signed_on,expires_on\nS100,slp,Dr A,1234567890,2026-08-01,2027-08-01\nS999,ot,Dr B,1234567893,2026-08-01,2027-08-01\n", true);
    expect(r.committed).toBe(false);
    expect(r.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(r.errors[0].message).toContain("valid NPI");
  });

  it("links services to staff by email and checks discipline", () => {
    const bad = runImport("dist_lakeshore", "services", "student_id,discipline,minutes_per_week,setting,provider_email\nS100,slp,60,individual,priya@lakeshore99.org\n", false);
    expect(bad.errors[0].message).toContain("not a SLP provider");
    expect(runImport("dist_lakeshore", "services", "student_id,discipline,minutes_per_week,setting,provider_email\nS100,slp,60,individual,maya@lakeshore99.org\n", true).committed).toBe(true);
  });

  it("flags missing columns", () => {
    expect(runImport("dist_lakeshore", "attendance", "student_id,date\nS100,2026-09-01\n", false).errors[0].message).toContain("status");
  });

  it("imported school attendance blocks claims for absent days", () => {
    const enc = encountersFor({ providerIds: ["usr_maya"], status: ["signed"] }).find((e) => e.note.attendance === "present" && e.student_id === "stu_ava")!;
    db().prepare("UPDATE students SET local_id = 'A1' WHERE id = 'stu_ava'").run();
    expect(runImport("dist_lakeshore", "attendance", `student_id,date,status\nA1,${enc.date},absent\n`, true).committed).toBe(true);
    expect(checkEncounter(contextFor(enc)).map((i) => i.code)).toContain("SCHOOL_ABSENT");
  });
});
