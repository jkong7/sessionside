"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { enqueue } from "@/lib/queue";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const ATTENDANCE = [
  { value: "present", label: "Delivered" },
  { value: "student_absent", label: "Student absent" },
  { value: "provider_absent", label: "I was out" },
  { value: "school_closed", label: "School closed" },
];

export function CaptureForm(props: {
  action: (fd: FormData) => Promise<void>;
  studentId: string;
  studentName: string;
  date: string;
  start: string;
  setting: string;
  scheduledMinutes: number | null;
}) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [attendance, setAttendance] = useState("present");
  const [minutes, setMinutes] = useState("");
  const [pending, setPending] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const router = useRouter();

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setText((t) => (t ? `${t.trimEnd()} ${finalText.trim()}` : finalText.trim()).replace(/\s+([.,])/g, "$1"));
      setInterim(interimText);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  const delivered = attendance === "present";

  return (
    <form
      action={async (fd) => {
        setPending(true);
        rec.current?.stop();
        if (!navigator.onLine) {
          enqueue({
            studentId: props.studentId,
            studentName: props.studentName,
            date: props.date,
            start: props.start,
            transcript: String(fd.get("transcript") ?? ""),
            minutes: String(fd.get("minutes") ?? ""),
            attendance,
            setting: props.setting,
          });
          router.push(`/today?date=${props.date}`);
          return;
        }
        await props.action(fd);
      }}
      className="card space-y-4 p-4"
    >
      <input type="hidden" name="studentId" value={props.studentId} />
      <input type="hidden" name="date" value={props.date} />
      <input type="hidden" name="start" value={props.start} />
      <input type="hidden" name="setting" value={props.setting} />
      <input type="hidden" name="attendance" value={attendance} />

      <div className="flex flex-wrap gap-2">
        {ATTENDANCE.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAttendance(a.value)}
            className={`rounded-full border px-3 py-1 text-sm ${attendance === a.value ? "border-brand bg-brand-50 text-brand" : "border-line text-ink-2"}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {delivered && (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              disabled={!supported}
              className={`grid size-14 shrink-0 place-items-center rounded-full text-white transition ${listening ? "animate-pulse bg-block" : "bg-brand hover:bg-brand-600"} disabled:bg-ink-4`}
              aria-label={listening ? "Stop dictation" : "Start dictation"}
            >
              {listening ? <span className="size-4 rounded-sm bg-white" /> : <span className="size-4 rounded-full bg-white" />}
            </button>
            <p className="text-sm text-ink-3">
              {supported
                ? listening
                  ? "Listening. Say minutes, what you worked on, data per goal, and the plan."
                  : "Tap to dictate, or type below."
                : "Voice dictation is not available in this browser. Type your summary below."}
            </p>
          </div>
          <label className="block text-sm font-medium">
            Session summary
            <textarea
              name="transcript"
              value={text + (interim ? ` ${interim}` : "")}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="field mt-1"
              placeholder="30 minutes one-on-one. Initial r words 8 out of 10 with minimal cues. Followed two-step directions 3 of 5. Next session r blends."
            />
          </label>
        </>
      )}
      {!delivered && <input type="hidden" name="transcript" value={text} />}

      {delivered && (
        <div>
          <p className="text-sm font-medium">Minutes delivered</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input name="minutes" inputMode="numeric" pattern="[0-9]*" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} className="field w-24" placeholder="min" />
            {props.scheduledMinutes && (
              <button type="button" onClick={() => setMinutes(String(props.scheduledMinutes))} className="chip border border-line bg-surface px-3 py-1 text-sm text-ink-2">
                {props.scheduledMinutes} (as scheduled)
              </button>
            )}
            <span className="text-xs text-ink-4">Leave blank if you said it in the summary.</span>
          </div>
        </div>
      )}

      <button className="btn-primary w-full" type="submit" disabled={pending || (delivered && !text.trim())}>
        {pending ? "Drafting..." : delivered ? "Draft note" : "Log attendance"}
      </button>
    </form>
  );
}
