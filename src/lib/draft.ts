import { draftLocal, type DraftInput } from "./engine/local";
import type { Note } from "./types";

export async function draftNote(input: DraftInput): Promise<Note> {
  return draftLocal(input);
}
