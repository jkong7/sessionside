"use client";

import { useEffect, useRef, useState } from "react";

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

type RecognitionWindow = { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

export function useDictation() {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const w = window as unknown as RecognitionWindow;
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);

  function stop() {
    rec.current?.stop();
  }

  function toggle() {
    if (listening) {
      stop();
      return;
    }
    const w = window as unknown as RecognitionWindow;
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

  return { text, setText, interim, listening, supported, toggle, stop };
}

export function MicButton({ listening, supported, onClick }: { listening: boolean; supported: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!supported}
      aria-pressed={listening}
      className={`grid size-14 shrink-0 place-items-center rounded-full text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${listening ? "animate-pulse bg-block" : "bg-brand hover:bg-brand-600"} disabled:bg-ink-4`}
      aria-label={listening ? "Stop dictation" : "Start dictation"}
    >
      {listening ? <span className="size-4 rounded-sm bg-white" /> : <span className="size-4 rounded-full bg-white" />}
    </button>
  );
}
