import { describe, expect, it } from "vitest";
import { goalProgress } from "@/lib/progress";
import type { Encounter, Goal, Note } from "@/lib/types";

const goal: Goal = { id: "g1", student_id: "s", discipline: "slp", area: "Articulation", text: "", keywords: [] };

function enc(date: string, percent: number, status: Encounter["status"] = "signed"): Encounter {
  const note = { attendance: "present", goals: [{ goal_id: "g1", correct: null, trials: null, percent, cue: "minimal", evidence: "" }] } as unknown as Note;
  return { id: date, student_id: "s", provider_id: "p", date, start: "", transcript: "", note, status, signed_at: null, signed_by: null, cosigned_at: null, cosigned_by: null, created_at: "", updated_at: "" };
}

describe("goalProgress", () => {
  it("detects an upward trend from signed sessions only", () => {
    const p = goalProgress(goal, [enc("2026-09-01", 40), enc("2026-09-02", 45), enc("2026-09-03", 50), enc("2026-09-08", 70), enc("2026-09-09", 75), enc("2026-09-10", 80), enc("2026-09-11", 10, "draft")]);
    expect(p.points.length).toBe(6);
    expect(p.recentAvg).toBe(75);
    expect(p.trend).toBe("up");
    expect(p.statement).toContain("improving");
  });

  it("handles no data", () => {
    expect(goalProgress(goal, []).trend).toBe("insufficient");
  });
});
