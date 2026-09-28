import type { Encounter, Goal } from "./types";

export type GoalProgress = {
  goal: Goal;
  points: { date: string; percent: number; cue: string | null }[];
  latest: number | null;
  recentAvg: number | null;
  trend: "up" | "down" | "flat" | "insufficient";
  statement: string;
};

export function goalProgress(goal: Goal, encounters: Encounter[]): GoalProgress {
  const points = encounters
    .filter((e) => e.note.attendance === "present" && e.status !== "draft")
    .flatMap((e) => e.note.goals.filter((g) => g.goal_id === goal.id && g.percent != null).map((g) => ({ date: e.date, percent: g.percent as number, cue: g.cue })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((n, x) => n + x, 0) / xs.length) : null);
  const recent = points.slice(-3).map((p) => p.percent);
  const earlier = points.slice(0, Math.max(0, points.length - 3)).slice(-3).map((p) => p.percent);
  const recentAvg = avg(recent);
  const earlierAvg = avg(earlier);
  let trend: GoalProgress["trend"] = "insufficient";
  if (recentAvg != null && earlierAvg != null) trend = recentAvg - earlierAvg >= 5 ? "up" : earlierAvg - recentAvg >= 5 ? "down" : "flat";
  const latest = points.at(-1) ?? null;
  const cues = latest?.cue ? ` with ${latest.cue} cues` : "";
  const statement =
    points.length === 0
      ? `No data recorded yet for ${goal.area.toLowerCase()}.`
      : `Across ${points.length} session${points.length > 1 ? "s" : ""}, recent performance averaged ${recentAvg}%${cues}. ${
          trend === "up" ? "Progress is improving." : trend === "down" ? "Performance has declined; consider adjusting supports." : trend === "flat" ? "Performance is steady." : "More sessions are needed to show a trend."
        }`;
  return { goal, points, latest: latest?.percent ?? null, recentAvg, trend, statement };
}
