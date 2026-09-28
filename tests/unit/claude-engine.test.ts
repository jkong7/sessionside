import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { draftWithClaude } from "@/lib/engine/claude";
import type { Goal } from "@/lib/types";

const goals: Goal[] = [
  { id: "g1", student_id: "s", discipline: "slp", area: "Articulation", text: "Produce /r/", keywords: ["r"] },
  { id: "g2", student_id: "s", discipline: "slp", area: "Language", text: "Follow directions", keywords: ["directions"] },
];

function fakeClient(parsed: unknown, stop = "end_turn") {
  const calls: unknown[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (params: unknown) => {
          calls.push(params);
          return { stop_reason: stop, parsed_output: parsed, model: "claude-opus-5-5" };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

const base = {
  attendance: "present",
  setting: "individual",
  group_size: null,
  activities: ["Picture card drill"],
  goals: [
    { goal_id: "g1", correct: 8, trials: 10, percent: 70, cue: "minimal verbal", evidence: "r words 8 of 10" },
    { goal_id: "made_up", correct: 1, trials: 1, percent: 100, cue: null, evidence: "x" },
  ],
  response: "Engaged.",
  plan: "Move to r blends.",
  uncertain: [],
};

describe("draftWithClaude", () => {
  it("keeps only known goals, recomputes percent, and flags mismatches", async () => {
    const { client, calls } = fakeClient(base);
    const note = await draftWithClaude({ transcript: "30 minutes. r words 8 of 10.", discipline: "slp", goals, scheduledSetting: "individual" }, client);
    expect(note.goals.map((g) => g.goal_id)).toEqual(["g1"]);
    expect(note.goals[0].percent).toBe(80);
    expect(note.uncertain.some((u) => u.includes("does not match"))).toBe(true);
    expect(note.cpt).toBe("92507");
    expect(note.engine).toBe("claude:claude-opus-5-5");
    expect((calls[0] as { model: string }).model).toBe("claude-opus-5-5");
  });

  it("takes minutes only from the dictation or the therapist, never the model", async () => {
    const { client } = fakeClient(base);
    const note = await draftWithClaude({ transcript: "r words 8 of 10.", discipline: "slp", goals, scheduledSetting: "individual" }, client);
    expect(note.minutes).toBeNull();
    expect(note.minutes_source).toBe("missing");
  });

  it("throws on refusal so the caller can fall back", async () => {
    const { client } = fakeClient(null, "refusal");
    await expect(draftWithClaude({ transcript: "x", discipline: "slp", goals, scheduledSetting: "individual" }, client)).rejects.toThrow();
  });
});
