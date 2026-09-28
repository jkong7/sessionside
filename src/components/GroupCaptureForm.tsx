"use client";

import { useState } from "react";
import { MicButton, useDictation } from "./useDictation";

export function GroupCaptureForm(props: {
  action: (fd: FormData) => Promise<void>;
  students: { id: string; name: string }[];
  date: string;
  start: string;
  scheduledMinutes: number | null;
}) {
  const { text, setText, interim, listening, supported, toggle, stop } = useDictation();
  const [minutes, setMinutes] = useState("");
  const [absent, setAbsent] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const firstNames = props.students.map((s) => s.name.split(" ")[0]);

  return (
    <form
      action={async (fd) => {
        setPending(true);
        stop();
        await props.action(fd);
      }}
      className="card space-y-4 p-4"
    >
      <input type="hidden" name="date" value={props.date} />
      <input type="hidden" name="start" value={props.start} />
      {props.students.map((s) => (
        <input key={s.id} type="hidden" name="studentIds" value={s.id} />
      ))}
      {absent.map((id) => (
        <input key={id} type="hidden" name="absentIds" value={id} />
      ))}

      <fieldset>
        <legend className="text-sm font-medium">Who was there</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.students.map((s) => {
            const out = absent.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={!out}
                onClick={() => setAbsent((a) => (out ? a.filter((x) => x !== s.id) : [...a, s.id]))}
                className={`rounded-full border px-3 py-1 text-sm ${out ? "border-line text-ink-4 line-through" : "border-brand bg-brand-50 text-brand"}`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <MicButton listening={listening} supported={supported} onClick={toggle} />
        <p className="text-sm text-ink-3" aria-live="polite">
          {listening ? `Listening. Say each student's name before their data, like "${firstNames[0]}, 4 of 5 with minimal cues."` : supported ? "Tap to dictate one summary for the whole group, or type below." : "Type one summary for the whole group below."}
        </p>
      </div>
      <label className="block text-sm font-medium">
        Group summary
        <textarea
          name="transcript"
          value={text + (interim ? ` ${interim}` : "")}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="field mt-1"
          placeholder={`30 minutes, played a turn-taking board game. ${firstNames[0]} kept the topic 4 of 5 turns with minimal cues. ${firstNames[1] ?? ""} 2 of 5 with moderate cues.`}
        />
      </label>
      <div>
        <p className="text-sm font-medium">Minutes delivered</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input name="minutes" inputMode="numeric" aria-label="Minutes delivered" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} className="field w-24" placeholder="min" />
          {props.scheduledMinutes && (
            <button type="button" onClick={() => setMinutes(String(props.scheduledMinutes))} className="chip border border-line bg-surface px-3 py-1 text-sm text-ink-2">
              {props.scheduledMinutes} (as scheduled)
            </button>
          )}
        </div>
      </div>
      <button className="btn-primary w-full" type="submit" disabled={pending || !text.trim() || absent.length === props.students.length}>
        {pending ? "Drafting notes..." : `Draft ${props.students.length - absent.length} note${props.students.length - absent.length === 1 ? "" : "s"}${absent.length ? ` and log ${absent.length} absence${absent.length > 1 ? "s" : ""}` : ""}`}
      </button>
    </form>
  );
}
