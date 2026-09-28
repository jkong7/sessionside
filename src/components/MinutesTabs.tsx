import Link from "next/link";

export function MinutesTabs({ active }: { active: "week" | "ledger" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-sm ${on ? "bg-brand-50 font-medium text-brand" : "text-ink-2 hover:bg-sunken"}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Minutes views" className="flex gap-1">
      {tab("/minutes", "This week", active === "week")}
      {tab("/minutes/ledger", "Make-up ledger", active === "ledger")}
    </nav>
  );
}
