import { beforeAll, describe, expect, it } from "vitest";
import { db, openDb, setDb } from "@/lib/db";
import { addAddendum, addendaFor, createEncounter, deleteEncounter, encountersFor, markSigned, updateEncounterNote } from "@/lib/repo";
import { seed } from "@/lib/seed";

beforeAll(() => {
  process.env.SESSIONSIDE_TODAY = "2026-09-28";
  const database = openDb(":memory:");
  seed(database, "2026-09-28");
  setDb(database);
});

describe("record integrity", () => {
  it("refuses to change, reopen, or delete a signed note", () => {
    const signed = encountersFor({ providerIds: ["usr_maya"], status: ["signed"] })[0];
    expect(() => updateEncounterNote(signed.id, { ...signed.note, minutes: 99 })).toThrow(/addendum/);
    expect(() => db().prepare("UPDATE encounters SET status = 'draft' WHERE id = ?").run(signed.id)).toThrow(/reopened/);
    expect(() => deleteEncounter(signed.id)).toThrow(/deleted/);
  });

  it("allows drafts to be edited and signed once", () => {
    const draft = createEncounter({ studentId: "stu_ava", providerId: "usr_maya", date: "2026-09-28", start: "", transcript: "x", note: encountersFor({ providerIds: ["usr_maya"] })[0].note });
    updateEncounterNote(draft.id, { ...draft.note, minutes: 20 });
    markSigned(draft.id, "usr_maya", "signed");
    expect(() => updateEncounterNote(draft.id, { ...draft.note, minutes: 25 })).toThrow();
  });

  it("keeps addenda and the audit log append-only", () => {
    const signed = encountersFor({ providerIds: ["usr_maya"], status: ["signed"] })[0];
    const id = addAddendum(signed.id, "usr_maya", "Late entry: session began 5 minutes late.");
    expect(addendaFor(signed.id).map((a) => a.id)).toContain(id);
    expect(() => db().prepare("DELETE FROM addenda WHERE id = ?").run(id)).toThrow(/append-only/);
    db().prepare("INSERT INTO audit (user_id, action, entity, entity_id, detail, at) VALUES ('usr_maya', 'x', 'y', 'z', '{}', 'now')").run();
    expect(() => db().prepare("DELETE FROM audit").run()).toThrow(/append-only/);
  });

  it("prevents two notes for the same scheduled slot", () => {
    const note = encountersFor({ providerIds: ["usr_maya"] })[0].note;
    createEncounter({ studentId: "stu_ava", providerId: "usr_maya", date: "2026-09-28", start: "13:00", transcript: "", note });
    expect(() => createEncounter({ studentId: "stu_ava", providerId: "usr_maya", date: "2026-09-28", start: "13:00", transcript: "", note })).toThrow();
  });
});
