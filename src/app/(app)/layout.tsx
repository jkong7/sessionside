import { redirect } from "next/navigation";
import { Nav, type NavItem } from "@/components/Nav";
import { OfflineSync } from "@/components/OfflineSync";
import { requireUser, signOut } from "@/lib/auth";
import { getDistrict } from "@/lib/repo";

async function logout() {
  "use server";
  await signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const district = getDistrict(user.district_id);
  const items: NavItem[] =
    user.role === "coordinator"
      ? [
          { href: "/minutes", label: "IEP minutes" },
          { href: "/claims", label: "Claims" },
          { href: "/exports", label: "Exports" },
          { href: "/students", label: "Students" },
          { href: "/imports", label: "Imports" },
          { href: "/settings", label: "District settings" },
        ]
      : [
          { href: "/today", label: "Today" },
          { href: "/review", label: "Review & sign" },
          { href: "/minutes", label: "IEP minutes" },
          { href: "/progress", label: "Progress reports" },
          { href: "/claims", label: "Claims" },
          { href: "/exports", label: "Exports" },
          { href: "/students", label: "Caseload" },
          { href: "/digest", label: "Daily digest" },
        ];
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow">
        Skip to main content
      </a>
      <aside aria-label="Sidebar" className="border-b border-line bg-surface md:min-h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="p-3 md:sticky md:top-0 md:p-4">
        <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-white">S</span>
          Sessionside
        </div>
        <nav aria-label="Main">
          <Nav items={items} />
        </nav>
        <div className="mt-4 hidden border-t border-line px-2 pt-4 text-xs text-ink-3 md:block">
          <p className="font-medium text-ink-2">{user.name}</p>
          <p>{user.credential}</p>
          <p className="mt-1">{district.name}</p>
          <form action={logout} className="mt-3">
            <button className="text-brand hover:underline" type="submit">Sign out</button>
          </form>
        </div>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-8">
        <OfflineSync />
        {children}
      </main>
    </div>
  );
}
