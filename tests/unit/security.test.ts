import { beforeAll, describe, expect, it } from "vitest";
import { canCosign, canEdit, canView } from "@/lib/access";
import { hashToken, isLockedOut, MAX_FAILURES } from "@/lib/auth";
import { db, openDb, setDb } from "@/lib/db";
import { encountersFor, getUser } from "@/lib/repo";
import { seed } from "@/lib/seed";

beforeAll(() => {
  process.env.SESSIONSIDE_TODAY = "2026-09-28";
  const database = openDb(":memory:");
  seed(database, "2026-09-28");
  database.exec(`
    INSERT INTO districts (id, name, state, settings) VALUES ('dist_other', 'Other', 'IL', '{}');
    INSERT INTO users (id, district_id, email, name, password_hash, role) VALUES ('usr_other', 'dist_other', 'other@x.org', 'Other Coord', 'x', 'coordinator');
  `);
  setDb(database);
});

describe("access control", () => {
  it("keeps coordinators inside their own district", () => {
    const enc = encountersFor({ providerIds: ["usr_maya"] })[0];
    expect(canView(getUser("usr_dana")!, enc)).toBe(true);
    expect(canView(getUser("usr_other")!, enc)).toBe(false);
  });

  it("lets only the author edit a draft", () => {
    const draft = encountersFor({ providerIds: ["usr_maya"], status: ["draft"] })[0];
    expect(canEdit(getUser("usr_maya")!, draft)).toBe(true);
    expect(canEdit(getUser("usr_dana")!, draft)).toBe(false);
    expect(canEdit(getUser("usr_priya")!, draft)).toBe(false);
  });

  it("lets only the supervisor co-sign assistant notes", () => {
    const pending = { provider_id: "usr_jordan", student_id: "stu_noah", status: "cosign_pending" as const };
    expect(canCosign(getUser("usr_maya")!, pending)).toBe(true);
    expect(canCosign(getUser("usr_priya")!, pending)).toBe(false);
    expect(canCosign(getUser("usr_jordan")!, pending)).toBe(false);
  });

  it("lets therapists view only their own or supervised notes", () => {
    const maya = encountersFor({ providerIds: ["usr_maya"] })[0];
    const jordan = encountersFor({ providerIds: ["usr_jordan"] })[0];
    expect(canView(getUser("usr_priya")!, maya)).toBe(false);
    expect(canView(getUser("usr_maya")!, jordan)).toBe(true);
    expect(canView(getUser("usr_jordan")!, maya)).toBe(false);
  });
});

describe("login throttling", () => {
  it("locks an email after repeated failures", () => {
    const at = new Date().toISOString();
    for (let i = 0; i < MAX_FAILURES - 1; i++) db().prepare("INSERT INTO login_attempts (email, ok, at) VALUES (?, 0, ?)").run("maya@lakeshore99.org", at);
    expect(isLockedOut("maya@lakeshore99.org")).toBe(false);
    db().prepare("INSERT INTO login_attempts (email, ok, at) VALUES (?, 0, ?)").run("maya@lakeshore99.org", at);
    expect(isLockedOut("maya@lakeshore99.org")).toBe(true);
    expect(isLockedOut("maya@lakeshore99.org", Date.now() + 16 * 60 * 1000)).toBe(false);
  });

  it("stores session tokens only as hashes", () => {
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).not.toBe("abc");
  });
});
