import { describe, expect, it } from "vitest";
import { splitGroupDictation } from "@/lib/engine/group";

const members = [
  { id: "e", firstName: "Elijah" },
  { id: "j", firstName: "Jayden" },
  { id: "l", firstName: "Liam" },
];

describe("splitGroupDictation", () => {
  it("routes clauses to the student last named and keeps shared context", () => {
    const s = splitGroupDictation(
      "Group of 3 for 30 minutes playing a board game. Elijah kept the topic for 3 turns 4 of 5 opportunities with minimal cues. Jayden 2 of 5 with moderate cues, he needed a break. Liam named category vocabulary 7 of 10 independently.",
      members,
    );
    expect(s.shared).toContain("30 minutes");
    expect(s.byStudent.e).toContain("4 of 5");
    expect(s.byStudent.j).toContain("2 of 5");
    expect(s.byStudent.l).toContain("7 of 10");
    expect(s.absent).toEqual([]);
  });

  it("handles run-on dictation and absences", () => {
    const s = splitGroupDictation("30 minutes elijah 4 of 5 with minimal cues jayden 3 of 5 with moderate cues liam was absent", members);
    expect(s.byStudent.e).toContain("4 of 5");
    expect(s.byStudent.j).toContain("3 of 5");
    expect(s.absent).toEqual(["l"]);
  });

  it("marks several students absent in one clause and reports students with no data", () => {
    const s = splitGroupDictation("20 minutes. Jayden and Liam were absent. Worked on conversation turns.", members);
    expect(s.absent.sort()).toEqual(["j", "l"]);
    expect(s.unmatched).toEqual(["e"]);
  });
});
