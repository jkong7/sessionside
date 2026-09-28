import { draftWithClaude } from "./engine/claude";
import { draftLocal, type DraftInput } from "./engine/local";
import type { Note } from "./types";

export function engineMode(): "claude" | "local" {
  if (process.env.SESSIONSIDE_ENGINE === "local") return "local";
  return process.env.ANTHROPIC_API_KEY || process.env.SESSIONSIDE_ENGINE === "claude" ? "claude" : "local";
}

export async function draftNote(input: DraftInput): Promise<Note> {
  if (!input.transcript.trim() || engineMode() === "local") return draftLocal(input);
  try {
    return await draftWithClaude(input);
  } catch (e) {
    console.error("[sessionside] Claude draft failed, using local engine:", e instanceof Error ? e.message : e);
    const note = draftLocal(input);
    return { ...note, uncertain: [...note.uncertain, "Drafted by the offline engine because the AI drafter was unavailable. Review carefully."] };
  }
}
