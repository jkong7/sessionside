import { describe, expect, it } from "vitest";
import { cueRank, goalTarget, summarizeGoal } from "@/lib/progressReport";
import type { Encounter, Goal, Note } from "@/lib/types";

const goal: Goal = { id: "g", student_id: "s", discipline: "slp", area: "Articulation", text: "Produce /r/ with 80% accuracy", keywords: [] };

function enc(date: string, percent: number, cue: string, status: Encounter["status"] = "signed"): Encounter {
  const note = { attendance: "present", goals: [{ goal_id: "g", correct: null, trials: null, percent, cue, evidence: "" }] } as unknown as Note;
  return { id: date, student_id: "s", provider_id: "p", date, start: "", transcript: "", note, status, signed_at: null, signed_by: null, cosigned_at: null, cosigned_by: null, created_at: "", updated_at: "" };
}

describe("progress report drafting", () => {
  it("reads the target from the goal text", () => {
    expect(goalTarget(goal)).toBe(80);
    expect(goalTarget({ ...goal, text: "Follow directions" })).toBe(80);
    expect(goalTarget({ ...goal, text: "with 90% accuracy" })).toBe(90);
  });

  it("ranks cue levels", () => {
    expect(cueRank("independent")).toBe(0);
    expect(cueRank("minimal verbal")).toBe(1);
    expect(cueRank("maximal physical")).toBe(3);
    expect(cueRank(null)).toBeNull();
  });

  it("rates improvement and fading cues as sufficient progress", () => {
    const s = summarizeGoal(goal, [enc("2026-09-01", 40, "maximal"), enc("2026-09-03", 45, "moderate"), enc("2026-09-08", 50, "moderate"), enc("2026-09-15", 60, "moderate"), enc("2026-09-17", 65, "minimal"), enc("2026-09-22", 70, "minimal")], "2026-09-01", "2026-09-30");
    expect(s.rating).toBe("sufficient");
    expect(s.narrative).toContain("from maximal to minimal cues");
    expect(s.narrative).toContain("45%");
  });

  it("calls a goal met only with enough data at target and low support", () => {
    const s = summarizeGoal(goal, [enc("2026-09-01", 80, "minimal"), enc("2026-09-03", 85, "independent"), enc("2026-09-08", 90, "independent")], "2026-09-01", "2026-09-30");
    expect(s.rating).toBe("mastered");
  });

  it("flags declining performance and ignores drafts and other periods", () => {
    const s = summarizeGoal(goal, [enc("2026-09-01", 70, "moderate"), enc("2026-09-03", 65, "moderate"), enc("2026-09-08", 60, "moderate"), enc("2026-09-10", 50, "maximal"), enc("2026-09-12", 45, "maximal"), enc("2026-09-14", 40, "maximal"), enc("2026-09-15", 100, "independent", "draft"), enc("2026-10-15", 100, "independent")], "2026-09-01", "2026-09-30");
    expect(s.sessions).toBe(6);
    expect(s.rating).toBe("insufficient");
  });

  it("says when there is not enough data", () => {
    expect(summarizeGoal(goal, [], "2026-09-01", "2026-09-30").rating).toBe("not_enough_data");
  });
});
