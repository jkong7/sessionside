import type { Encounter, Goal } from "./types";

export type ProgressRating = "mastered" | "sufficient" | "some" | "insufficient" | "not_enough_data";

export const RATING_LABEL: Record<ProgressRating, string> = {
  mastered: "Goal met",
  sufficient: "Making sufficient progress to meet the goal",
  some: "Making some progress; may not meet the goal by the annual review",
  insufficient: "Not making progress; team should review supports",
  not_enough_data: "Not enough data this period",
};

const CUE_RANK: [RegExp, number][] = [
  [/independent/, 0],
  [/minimal|min\b/, 1],
  [/moderate|mod\b/, 2],
  [/maximal|max\b/, 3],
];

export function cueRank(cue: string | null): number | null {
  if (!cue) return null;
  for (const [re, n] of CUE_RANK) if (re.test(cue)) return n;
  return null;
}

export function goalTarget(goal: Goal): number {
  const m = goal.text.match(/(\d{2,3})\s*%/);
  return m ? Math.min(100, Number(m[1])) : 80;
}

export type GoalPeriodSummary = {
  goal: Goal;
  sessions: number;
  first: number | null;
  latest: number | null;
  recentAvg: number | null;
  target: number;
  cueFrom: string | null;
  cueTo: string | null;
  rating: ProgressRating;
  narrative: string;
};

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function summarizeGoal(goal: Goal, encounters: Encounter[], from: string, to: string): GoalPeriodSummary {
  const pts = encounters
    .filter((e) => e.date >= from && e.date <= to && e.status !== "draft" && e.note.attendance === "present")
    .flatMap((e) => e.note.goals.filter((g) => g.goal_id === goal.id && g.percent != null).map((g) => ({ date: e.date, percent: g.percent as number, cue: g.cue })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const target = goalTarget(goal);
  const firstThree = avg(pts.slice(0, 3).map((p) => p.percent));
  const recentAvg = avg(pts.slice(-3).map((p) => p.percent));
  const cueFrom = pts.find((p) => p.cue)?.cue ?? null;
  const cueTo = [...pts].reverse().find((p) => p.cue)?.cue ?? null;
  const cueImproved = cueRank(cueFrom) != null && cueRank(cueTo) != null && (cueRank(cueTo) as number) < (cueRank(cueFrom) as number);

  let rating: ProgressRating;
  if (pts.length < 2 || recentAvg == null || firstThree == null) rating = "not_enough_data";
  else if (pts.length >= 3 && recentAvg >= target && (cueRank(cueTo) ?? 0) <= 1) rating = "mastered";
  else if (recentAvg - firstThree >= 10 || recentAvg >= target - 10 || cueImproved) rating = "sufficient";
  else if (recentAvg - firstThree > -5) rating = "some";
  else rating = "insufficient";

  const area = goal.area.toLowerCase();
  let narrative: string;
  if (rating === "not_enough_data") {
    narrative = pts.length === 0 ? `No ${area} data was recorded during this reporting period.` : `One ${area} data point was recorded this period (${pts[0].percent}%). More sessions are needed to judge progress.`;
  } else {
    const cues = cueFrom && cueTo ? (cueFrom === cueTo ? ` with ${cueTo} cues` : `, with support moving from ${cueFrom} to ${cueTo} cues`) : "";
    narrative = `Across ${pts.length} sessions, accuracy went from an average of ${firstThree}% at the start of the period to ${recentAvg}% in the most recent sessions${cues}. The goal target is ${target}%. ${RATING_LABEL[rating]}.`;
  }
  return { goal, sessions: pts.length, first: pts[0]?.percent ?? null, latest: pts.at(-1)?.percent ?? null, recentAvg, target, cueFrom, cueTo, rating, narrative };
}
