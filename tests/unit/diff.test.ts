import { describe, expect, it } from "vitest";
import { editRate, noteChanges } from "@/lib/diff";
import type { Note } from "@/lib/types";

const base: Note = {
  summary: "s",
  activities: ["a"],
  goals: [{ goal_id: "g1", correct: 8, trials: 10, percent: 80, cue: "minimal", evidence: "" }],
  response: "",
  plan: "",
  minutes: null,
  minutes_source: "missing",
  setting: "individual",
  group_size: null,
  attendance: "present",
  cpt: null,
  units: 0,
  engine: "x",
  uncertain: [],
};

describe("draft vs final", () => {
  it("lists what the clinician changed", () => {
    const final = { ...base, minutes: 30, cpt: "92507", units: 1, goals: [{ ...base.goals[0], correct: 7, percent: 70 }] };
    const c = noteChanges(base, final, () => "Articulation");
    expect(c.map((x) => x.field)).toEqual(["Minutes", "Code", "Goal: Articulation"]);
    expect(c[2]).toMatchObject({ from: "8/10 80% minimal", to: "7/10 70% minimal" });
  });

  it("computes an edit rate", () => {
    expect(editRate([{ draft: base, final: base }, { draft: base, final: { ...base, plan: "x" } }])).toEqual({ notes: 2, edited: 1, fieldsChanged: 1 });
  });
});
