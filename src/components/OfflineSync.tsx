"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { readQueue, writeQueue } from "@/lib/queue";

export function OfflineSync() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    const items = readQueue();
    setCount(items.length);
    if (!items.length || !navigator.onLine) return;
    setSyncing(true);
    const left = [];
    for (const item of items) {
      try {
        const res = await fetch("/api/capture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item) });
        if (!res.ok && res.status !== 422) left.push(item);
      } catch {
        left.push(item);
      }
    }
    writeQueue(left);
    setCount(left.length);
    setSyncing(false);
    if (left.length < items.length) router.refresh();
  }, [router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setCount(readQueue().length);
    const up = () => {
      setOnline(true);
      void sync();
    };
    const down = () => setOnline(false);
    const changed = () => setCount(readQueue().length);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    window.addEventListener("sessionside-queue", changed);
    void sync();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener("sessionside-queue", changed);
    };
  }, [sync]);

  if (online && count === 0) return null;
  return (
    <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${online ? "bg-brand-50 text-brand" : "bg-warn-50 text-warn"}`}>
      {!online && "You are offline. Sessions you log are saved on this device and drafted when you reconnect."}
      {online && count > 0 && (syncing ? `Drafting ${count} saved session${count > 1 ? "s" : ""}...` : `${count} saved session${count > 1 ? "s" : ""} waiting to sync.`)}
      {!online && count > 0 && ` ${count} saved.`}
    </div>
  );
}
