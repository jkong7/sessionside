export type QueuedCapture = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  start: string;
  transcript: string;
  minutes: string;
  attendance: string;
  setting: string;
  queuedAt: string;
};

const KEY = "sessionside.queue";

export function readQueue(): QueuedCapture[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedCapture[];
  } catch {
    return [];
  }
}

export function writeQueue(items: QueuedCapture[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("sessionside-queue"));
  } catch {}
}

export function enqueue(item: Omit<QueuedCapture, "id" | "queuedAt">): void {
  writeQueue([...readQueue(), { ...item, id: crypto.randomUUID(), queuedAt: new Date().toISOString() }]);
}
