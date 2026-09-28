import { describe, expect, it } from "vitest";
import { codeFor, timedUnits } from "@/lib/engine/cpt";
import { detectAttendance, detectMinutes, detectSetting, draftLocal, extractMeasure, matchGoal } from "@/lib/engine/local";
import { wordsToDigits } from "@/lib/engine/numbers";
import type { Goal } from "@/lib/types";

const goals: Goal[] = [
  { id: "g1", student_id: "s", discipline: "slp", area: "Articulation", text: "Produce /r/ in initial position of words", keywords: ["/r/", "r sound", "articulation", "initial r"] },
  { id: "g2", student_id: "s", discipline: "slp", area: "Receptive language", text: "Follow 2-step directions", keywords: ["directions", "2-step", "two-step"] },
  { id: "g3", student_id: "s", discipline: "ot", area: "Fine motor", text: "Cut along a curved line", keywords: ["scissors", "cutting", "cut"] },
];

describe("number words", () => {
  it("converts compound and single number words", () => {
    expect(wordsToDigits("eight out of ten, forty-five minutes, thirty")).toBe("8 out of 10, 45 minutes, 30");
  });
});

describe("minutes", () => {
  it("reads digits, words, and half hour", () => {
    expect(detectMinutes("We did 30 minutes today")).toBe(30);
    expect(detectMinutes("twenty minute session")).toBe(20);
    expect(detectMinutes("about a half hour")).toBe(30);
    expect(detectMinutes("worked for an hour")).toBe(60);
    expect(detectMinutes("great session")).toBeNull();
  });
});

describe("attendance", () => {
  it("detects absences and closures", () => {
    expect(detectAttendance("Ava was absent today")).toBe("student_absent");
    expect(detectAttendance("Snow day, school closed")).toBe("school_closed");
    expect(detectAttendance("I was out sick")).toBe("provider_absent");
    expect(detectAttendance("Worked on r sounds")).toBe("present");
  });
});

describe("setting", () => {
  it("counts group size from peers", () => {
    expect(detectSetting("with two peers", "individual")).toEqual({ setting: "group", groupSize: 3 });
    expect(detectSetting("group of 4", "individual")).toEqual({ setting: "group", groupSize: 4 });
    expect(detectSetting("one-on-one today", "group")).toEqual({ setting: "individual", groupSize: null });
    expect(detectSetting("nothing said", "group")).toEqual({ setting: "group", groupSize: null });
  });
});

describe("measures", () => {
  it("parses ratios, percents, and cue levels", () => {
    expect(extractMeasure("8 out of 10 trials with minimal verbal cues")).toEqual({ correct: 8, trials: 10, percent: 80, cue: "minimal verbal" });
    expect(extractMeasure("70 percent independently")).toEqual({ correct: null, trials: null, percent: 70, cue: "independent" });
    expect(extractMeasure("mod cues")).toMatchObject({ cue: "moderate" });
  });
});

describe("goal matching", () => {
  it("matches by keywords within discipline", () => {
    expect(matchGoal("Initial r words at 8 out of 10", goals)?.id).toBe("g1");
    expect(matchGoal("Followed two-step directions", goals)?.id).toBe("g2");
    expect(matchGoal("Read a book", goals)).toBeNull();
  });
});

describe("codes", () => {
  it("applies the 8-minute rule for timed codes", () => {
    expect(timedUnits(7)).toBe(0);
    expect(timedUnits(8)).toBe(1);
    expect(timedUnits(22)).toBe(1);
    expect(timedUnits(23)).toBe(2);
    expect(timedUnits(30)).toBe(2);
  });
  it("picks speech individual vs group and OT timed codes", () => {
    expect(codeFor("slp", "individual", "present", 30)).toEqual({ cpt: "92507", units: 1 });
    expect(codeFor("slp", "group", "present", 30)).toEqual({ cpt: "92508", units: 1 });
    expect(codeFor("ot", "individual", "present", 30)).toEqual({ cpt: "97530", units: 2 });
    expect(codeFor("pt", "group", "present", 30)).toEqual({ cpt: "97150", units: 1 });
    expect(codeFor("slp", "individual", "student_absent", 30)).toEqual({ cpt: null, units: 0 });
  });
});

describe("draftLocal", () => {
  it("builds a structured note from a short dictation", () => {
    const note = draftLocal({
      transcript:
        "30 minutes one-on-one. Practiced initial r words with picture cards, 8 out of 10 with minimal verbal cues. Followed two-step directions 3 of 5 trials with moderate cues. She was engaged and self-corrected twice. Next session we will move on to r blends.",
      discipline: "slp",
      goals,
      scheduledSetting: "individual",
    });
    expect(note.minutes).toBe(30);
    expect(note.minutes_source).toBe("stated");
    expect(note.cpt).toBe("92507");
    expect(note.goals.map((g) => g.goal_id).sort()).toEqual(["g1", "g2"]);
    expect(note.goals.find((g) => g.goal_id === "g1")).toMatchObject({ percent: 80, cue: "minimal verbal" });
    expect(note.goals.find((g) => g.goal_id === "g2")).toMatchObject({ percent: 60, cue: "moderate" });
    expect(note.activities).toEqual(["Practiced initial r words with picture cards"]);
    expect(note.response).toContain("engaged");
    expect(note.plan).toContain("r blends");
    expect(note.uncertain).toEqual([]);
  });

  it("never guesses minutes", () => {
    const note = draftLocal({ transcript: "Initial r words 7 out of 10.", discipline: "slp", goals, scheduledSetting: "individual" });
    expect(note.minutes).toBeNull();
    expect(note.minutes_source).toBe("missing");
    expect(note.uncertain.some((u) => u.includes("minutes"))).toBe(true);
  });

  it("prefers minutes the therapist entered", () => {
    const note = draftLocal({ transcript: "Initial r 9 out of 10, 20 minutes.", discipline: "slp", goals, scheduledSetting: "individual", enteredMinutes: 25 });
    expect(note.minutes).toBe(25);
    expect(note.minutes_source).toBe("entered");
  });

  it("records absences as not billable", () => {
    const note = draftLocal({ transcript: "Student was absent today.", discipline: "slp", goals, scheduledSetting: "individual" });
    expect(note.attendance).toBe("student_absent");
    expect(note.cpt).toBeNull();
    expect(note.minutes).toBe(0);
  });

  it("flags data that does not match a goal", () => {
    const note = draftLocal({ transcript: "30 minutes. Got 90 percent on the worksheet.", discipline: "slp", goals, scheduledSetting: "individual" });
    expect(note.uncertain.some((u) => u.includes("did not match"))).toBe(true);
  });
});
