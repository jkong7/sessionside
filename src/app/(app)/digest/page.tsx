import { requireUser } from "@/lib/auth";
import { buildDigest } from "@/lib/digest";

export default async function DigestPage() {
  const user = await requireUser();
  const d = buildDigest(user);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Daily digest</h1>
        <p className="text-sm text-ink-3">
          One message a day at 3:30 PM, plus a reminder when a signature is due. Counts only: no student names or health details ever leave the app by email or push.
        </p>
      </header>
      <article className="card overflow-hidden">
        <div className={`px-4 py-3 text-sm font-medium ${d.urgent ? "bg-warn-50 text-warn" : "bg-brand-50 text-brand"}`}>{d.subject}</div>
        <ul className="space-y-2 p-4 text-sm">
          {d.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </article>
      <p className="text-xs text-ink-4">Preview only. Delivery goes through the district&apos;s email or a push notification; tapping opens the review screen behind sign-in.</p>
    </div>
  );
}
