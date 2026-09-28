import type { Attendance, Discipline, Goal, GoalData, Note, Setting } from "../types";
import { codeFor } from "./cpt";
import { wordsToDigits } from "./numbers";

export type DraftInput = {
  transcript: string;
  discipline: Discipline;
  goals: Goal[];
  scheduledSetting: Setting;
  enteredMinutes?: number | null;
  enteredAttendance?: Attendance | null;
};

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  slp: "speech-language therapy",
  ot: "occupational therapy",
  pt: "physical therapy",
};

const STOP = new Set(["the", "and", "with", "will", "to", "in", "of", "a", "an", "for", "on", "at", "by", "or", "when", "given", "during", "their", "his", "her"]);

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function detectAttendance(text: string): Attendance {
  const t = text.toLowerCase();
  if (/\b(school (was )?closed|snow day|emergency closure|early dismissal)\b/.test(t)) return "school_closed";
  if (/\b(i was (out|absent|sick)|provider absent|i was at a training|my (absence|sick day))\b/.test(t)) return "provider_absent";
  if (/\b(absent|was out sick|out sick|not at school|didn'?t come|no[- ]show|refused to come|on a field trip|was not available|unavailable)\b/.test(t)) return "student_absent";
  return "present";
}

export function detectMinutes(text: string): number | null {
  const t = wordsToDigits(text.toLowerCase());
  if (/\b(a |one )?half[- ](an )?hour\b/.test(t)) return 30;
  const m = t.match(/\b(\d{1,3})[\s-]?(?:min|mins|minute|minutes)\b/);
  if (m) return Number(m[1]);
  if (/\b(an|1|one) hour\b/.test(t)) return 60;
  return null;
}

export function detectSetting(text: string, fallback: Setting): { setting: Setting; groupSize: number | null } {
  const t = wordsToDigits(text.toLowerCase());
  const peers = t.match(/\bwith (\d+) (?:peers|other students|classmates|other kids|kids|students)\b/);
  if (peers) return { setting: "group", groupSize: Number(peers[1]) + 1 };
  const groupOf = t.match(/\bgroup of (\d+)\b/);
  if (groupOf) return { setting: "group", groupSize: Number(groupOf[1]) };
  if (/\b(one[- ]on[- ]one|1[- ]on[- ]1|1:1|individual(ly)? session|individual)\b/.test(t)) return { setting: "individual", groupSize: null };
  if (/\b(group|paired with|pair session|dyad)\b/.test(t)) return { setting: "group", groupSize: /\b(paired with|dyad|pair)\b/.test(t) ? 2 : null };
  return { setting: fallback, groupSize: null };
}

export function extractMeasure(sentence: string): Pick<GoalData, "correct" | "trials" | "percent" | "cue"> {
  const t = wordsToDigits(sentence.toLowerCase());
  let correct: number | null = null;
  let trials: number | null = null;
  let percent: number | null = null;
  const ratio = t.match(/\b(\d{1,3})\s*(?:out of|\/|of)\s*(\d{1,3})\b/);
  if (ratio && Number(ratio[2]) > 0 && Number(ratio[1]) <= Number(ratio[2])) {
    correct = Number(ratio[1]);
    trials = Number(ratio[2]);
    percent = Math.round((correct / trials) * 100);
  }
  const pct = t.match(/\b(\d{1,3})\s*(?:%|percent)/);
  if (pct && Number(pct[1]) <= 100) percent = Number(pct[1]);
  let cue: string | null = null;
  if (/\bindependent(ly)?\b|\bno (cues|prompts)\b|\bwithout (cues|prompts|help)\b/.test(t)) cue = "independent";
  const c = t.match(/\b(minimal|min|moderate|mod|maximal|max)(?:imal)?\.?\s*(verbal|visual|tactile|physical|gestural|model(?:ing)?)?\s*(?:cues?|cueing|prompts?|prompting|support|assist(?:ance)?)\b/);
  if (c) {
    const level = c[1].startsWith("min") ? "minimal" : c[1].startsWith("mod") ? "moderate" : "maximal";
    cue = c[2] ? `${level} ${c[2].replace(/^model$/, "modeling")}` : level;
  }
  return { correct, trials, percent, cue };
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9/ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function matchGoal(sentence: string, goals: Goal[]): Goal | null {
  const words = new Set(tokens(sentence));
  const lower = ` ${sentence.toLowerCase()} `;
  let best: Goal | null = null;
  let bestScore = 0;
  for (const g of goals) {
    let score = 0;
    for (const k of g.keywords) {
      const kw = k.toLowerCase();
      if (kw.includes(" ") ? lower.includes(kw) : words.has(kw) || lower.includes(` ${kw} `) || lower.includes(`${kw}s `)) score += 2;
    }
    for (const w of tokens(g.area)) if (words.has(w)) score += 1;
    if (score > bestScore) {
      best = g;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

const ACTIVITY = /\b(worked on|practiced|practicing|played|used|did|completed|read|drill|drilled|game|book|obstacle course|cutting|tracing|traced|sorted|built|wrote|copied|stairs|ball|swing|puzzle|picture cards|worksheet|role[- ]play)\b/i;
const RESPONSE = /\b(engaged|attentive|frustrat\w*|tired|motivated|participat\w*|responded|did well|struggled|needed (a )?breaks?|distracted|focused|cooperative|excited|shy|self[- ]correct\w*)\b/i;
const PLAN = /\b(next (session|time|week)|plan (is|to)|will continue|continue to|going forward|homework|send(ing)? home|carryover|carry over|move on to|increase)\b/i;

export function draftLocal(input: DraftInput): Note {
  const text = input.transcript.trim();
  const uncertain: string[] = [];
  const attendance = input.enteredAttendance ?? detectAttendance(text);
  const stated = detectMinutes(text);
  let minutes: number | null = null;
  let minutesSource: Note["minutes_source"] = "missing";
  if (input.enteredMinutes != null && input.enteredMinutes > 0) {
    minutes = input.enteredMinutes;
    minutesSource = "entered";
  } else if (stated != null) {
    minutes = stated;
    minutesSource = "stated";
  }
  const { setting, groupSize } = detectSetting(text, input.scheduledSetting);

  const disciplineGoals = input.goals.filter((g) => g.discipline === input.discipline);
  const byGoal = new Map<string, GoalData>();
  const activities: string[] = [];
  const response: string[] = [];
  const plan: string[] = [];

  for (const s of sentences(text)) {
    const measure = extractMeasure(s);
    const hasData = measure.percent != null || measure.cue != null;
    const goal = matchGoal(s, disciplineGoals);
    if (goal && hasData) {
      const prev = byGoal.get(goal.id);
      if (!prev) {
        byGoal.set(goal.id, { goal_id: goal.id, ...measure, evidence: s });
      } else {
        byGoal.set(goal.id, {
          goal_id: goal.id,
          correct: measure.correct ?? prev.correct,
          trials: measure.trials ?? prev.trials,
          percent: measure.percent ?? prev.percent,
          cue: measure.cue ?? prev.cue,
          evidence: `${prev.evidence} ${s}`,
        });
      }
      continue;
    }
    if (hasData && !goal && measure.percent != null) {
      if (disciplineGoals.length === 1) {
        const only = disciplineGoals[0];
        if (!byGoal.has(only.id)) byGoal.set(only.id, { goal_id: only.id, ...measure, evidence: s });
      } else {
        uncertain.push(`Data "${s}" did not match an IEP goal. Assign it or remove it.`);
      }
      continue;
    }
    if (PLAN.test(s)) plan.push(s);
    else if (RESPONSE.test(s)) response.push(s);
    else if (ACTIVITY.test(s) || goal) activities.push(s);
  }

  if (attendance === "present") {
    if (minutesSource === "missing") uncertain.push("Session minutes were not stated. Enter the actual minutes before signing.");
    if (byGoal.size === 0 && disciplineGoals.length > 0) uncertain.push("No goal data captured. Add progress for at least one IEP goal.");
    if (setting === "group" && !groupSize) uncertain.push("Group session but group size was not stated.");
  }

  const { cpt, units } = codeFor(input.discipline, setting, attendance, minutes);
  const goalCount = byGoal.size;
  const summary =
    attendance === "present"
      ? `Attended ${minutes ? `a ${minutes}-minute` : "an"} ${setting} ${DISCIPLINE_LABEL[input.discipline]} session${goalCount ? ` addressing ${goalCount} IEP goal${goalCount > 1 ? "s" : ""}` : ""}.`
      : attendance === "student_absent"
        ? "Scheduled session not delivered: student absent or unavailable."
        : attendance === "provider_absent"
          ? "Scheduled session not delivered: provider absent. Make-up session required."
          : "Scheduled session not delivered: school closed.";

  return {
    summary,
    activities,
    goals: [...byGoal.values()],
    response: response.join(" "),
    plan: plan.join(" "),
    minutes: attendance === "present" ? minutes : 0,
    minutes_source: attendance === "present" ? minutesSource : "entered",
    setting,
    group_size: setting === "group" ? groupSize : null,
    attendance,
    cpt,
    units,
    engine: "local-rules-v1",
    uncertain,
  };
}
