import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Attendance, Note, Setting } from "../types";
import { codeFor } from "./cpt";
import { detectMinutes, draftLocal, type DraftInput } from "./local";

export const CLAUDE_MODEL = "claude-opus-5-5";

const Extraction = z.object({
  attendance: z.enum(["present", "student_absent", "provider_absent", "school_closed"]),
  setting: z.enum(["individual", "group"]),
  group_size: z.number().int().nullable(),
  activities: z.array(z.string()),
  goals: z.array(
    z.object({
      goal_id: z.string(),
      correct: z.number().int().nullable(),
      trials: z.number().int().nullable(),
      percent: z.number().int().nullable(),
      cue: z.string().nullable(),
      evidence: z.string(),
    }),
  ),
  response: z.string(),
  plan: z.string(),
  uncertain: z.array(z.string()),
});

const SYSTEM = `You turn a school-based therapist's short post-session dictation into structured documentation for an IEP-aligned session note that may support a Medicaid claim.

Rules:
- Record only what the therapist said. Never invent data, trials, percentages, cue levels, activities, or plans.
- Attach goal data only to goal ids from the provided list, and only when the dictation clearly refers to that goal. Put the exact supporting words in evidence.
- If a number could belong to more than one goal, or does not fit any goal, leave it out of goals and describe it in uncertain.
- Cue levels use plain words such as independent, minimal verbal, moderate visual, maximal physical.
- Activities are short phrases describing what was done. Response describes how the student engaged. Plan is what happens next.
- If the student or provider was absent or school was closed, set attendance accordingly and leave goals empty.
- Use neutral, objective clinical language. Do not diagnose.`;

export async function draftWithClaude(input: DraftInput, client = new Anthropic()): Promise<Note> {
  const goals = input.goals.filter((g) => g.discipline === input.discipline);
  const goalList = goals.map((g) => `- ${g.id}: ${g.area}. ${g.text}`).join("\n");
  const response = await client.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Extraction) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Discipline: ${input.discipline}\nScheduled setting: ${input.scheduledSetting}\nIEP goals:\n${goalList || "(none)"}\n\nDictation:\n<dictation>\n${input.transcript}\n</dictation>`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`claude draft unavailable: ${response.stop_reason}`);
  const out = response.parsed_output;
  const known = new Set(goals.map((g) => g.id));
  const attendance: Attendance = input.enteredAttendance ?? out.attendance;
  const setting: Setting = out.setting;

  const stated = detectMinutes(input.transcript);
  let minutes: number | null = null;
  let minutesSource: Note["minutes_source"] = "missing";
  if (input.enteredMinutes != null && input.enteredMinutes > 0) {
    minutes = input.enteredMinutes;
    minutesSource = "entered";
  } else if (stated != null) {
    minutes = stated;
    minutesSource = "stated";
  }

  const uncertain = [...out.uncertain];
  const goalData = out.goals
    .filter((g) => known.has(g.goal_id))
    .map((g) => {
      const computed = g.correct != null && g.trials ? Math.round((g.correct / g.trials) * 100) : null;
      if (computed != null && g.percent != null && Math.abs(computed - g.percent) > 1) uncertain.push(`Percent for a goal (${g.percent}%) does not match ${g.correct}/${g.trials}. Check the data.`);
      return { ...g, percent: computed ?? g.percent };
    });

  const present = attendance === "present";
  if (present && minutesSource === "missing") uncertain.push("Session minutes were not stated. Enter the actual minutes before signing.");
  if (present && goalData.length === 0 && goals.length > 0) uncertain.push("No goal data captured. Add progress for at least one IEP goal.");
  const { cpt, units } = codeFor(input.discipline, setting, attendance, minutes);
  const local = draftLocal({ ...input, enteredAttendance: attendance, enteredMinutes: minutes });

  return {
    summary: local.summary,
    activities: out.activities,
    goals: present ? goalData : [],
    response: out.response,
    plan: out.plan,
    minutes: present ? minutes : 0,
    minutes_source: present ? minutesSource : "entered",
    setting,
    group_size: setting === "group" ? out.group_size : null,
    attendance,
    cpt,
    units,
    engine: `claude:${response.model}`,
    uncertain,
  };
}
