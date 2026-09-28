"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: number };

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((it) => {
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-50 font-medium text-brand" : "text-ink-2 hover:bg-sunken"}`}
          >
            {it.label}
            {it.badge ? <span className="chip bg-block-50 text-block">{it.badge}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}
