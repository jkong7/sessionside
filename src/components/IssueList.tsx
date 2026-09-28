import type { Issue } from "@/lib/checks";

const STYLE = {
  block: "border-block/30 bg-block-50 text-block",
  warn: "border-warn/30 bg-warn-50 text-warn",
  info: "border-line bg-sunken text-ink-2",
};

export function IssueList({ issues, compact }: { issues: Issue[]; compact?: boolean }) {
  if (issues.length === 0) return compact ? null : <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">No problems found. This session is claimable once signed.</p>;
  const order = { block: 0, warn: 1, info: 2 };
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
  if (compact)
    return (
      <ul className="flex flex-wrap gap-1.5">
        {sorted.map((i) => (
          <li key={i.code + i.message} className={`chip border ${STYLE[i.severity]}`}>{i.message}</li>
        ))}
      </ul>
    );
  return (
    <ul className="space-y-2">
      {sorted.map((i) => (
        <li key={i.code + i.message} className={`rounded-lg border px-3 py-2 text-sm ${STYLE[i.severity]}`}>
          <p className="font-medium">{i.message}</p>
          <p className="text-xs">{i.fix}</p>
        </li>
      ))}
    </ul>
  );
}
