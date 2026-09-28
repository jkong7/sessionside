import { describe, expect, it } from "vitest";
import { detectMinutes, draftLocal, extractMeasure } from "@/lib/engine/local";
import type { Goal } from "@/lib/types";

const goals: Goal[] = [
  { id: "r", student_id: "s", discipline: "slp", area: "Articulation", text: "Produce /r/", keywords: ["/r/", "r words", "initial r", "r sound"] },
  { id: "s", student_id: "s", discipline: "slp", area: "Articulation", text: "Produce /s/ blends", keywords: ["/s/", "s blends", "s sound"] },
  { id: "dir", student_id: "s", discipline: "slp", area: "Receptive language", text: "Follow directions", keywords: ["directions", "2-step", "two-step"] },
];

const draft = (transcript: string) => draftLocal({ transcript, discipline: "slp", goals, scheduledSetting: "individual" });

describe("minutes edge cases", () => {
  it("ignores lateness and breaks", () => {
    expect(detectMinutes("Arrived 5 minutes late, we worked 25 minutes")).toBe(25);
    expect(detectMinutes("25 minute session with a 3 minute break")).toBe(25);
    expect(detectMinutes("left 10 minutes early after a 30 minute session")).toBe(30);
  });

  it("flags conflicting durations instead of picking silently", () => {
    const n = draft("30 minutes. Actually 20 minutes. r words 8 out of 10.");
    expect(n.uncertain.some((u) => u.includes("durations"))).toBe(true);
  });
});

describe("ratio edge cases", () => {
  it("does not read dates as data", () => {
    expect(extractMeasure("On 9/28 we practiced").percent).toBeNull();
    expect(extractMeasure("r words 8/10").percent).toBe(80);
  });
});

describe("run-on dictation without punctuation", () => {
  it("splits goal data by measure boundaries", () => {
    const n = draft(
      "30 minutes one on one we did r words 8 out of 10 with minimal verbal cues then s blends 6 out of 10 with moderate cues and two step directions 4 of 5 independently next session r blends",
    );
    const by = Object.fromEntries(n.goals.map((g) => [g.goal_id, g]));
    expect(by.r).toMatchObject({ percent: 80, cue: "minimal verbal" });
    expect(by.s).toMatchObject({ percent: 60, cue: "moderate" });
    expect(by.dir).toMatchObject({ percent: 80, cue: "independent" });
    expect(n.minutes).toBe(30);
  });

  it("handles two goals in one sentence", () => {
    const n = draft("30 minutes. R words 90% and s blends 50% with max cues.");
    const by = Object.fromEntries(n.goals.map((g) => [g.goal_id, g]));
    expect(by.r.percent).toBe(90);
    expect(by.s).toMatchObject({ percent: 50, cue: "maximal" });
  });
});

describe("fuzzing", () => {
  const words = ["the", "r", "words", "8", "of", "10", "minutes", "cues", "group", "absent", "percent", "and", "then", "directions", "half", "hour", "with", "2", "peers", "independently", "90", "%", "/", ".", ",", "blends", "late"];
  it("never throws and never invents minutes", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 2000; i++) {
      const len = 1 + Math.floor(rand() * 40);
      const text = Array.from({ length: len }, () => words[Math.floor(rand() * words.length)]).join(" ");
      const n = draft(text);
      if (n.minutes && n.minutes_source === "stated") expect(/minute|hour/.test(text)).toBe(true);
      for (const g of n.goals) {
        if (g.percent != null) expect(g.percent).toBeGreaterThanOrEqual(0);
        if (g.percent != null) expect(g.percent).toBeLessThanOrEqual(100);
      }
    }
  });
});
