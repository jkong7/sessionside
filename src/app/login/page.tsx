import { redirect } from "next/navigation";
import { currentUser, signIn } from "@/lib/auth";

const DEMO = [
  { email: "maya@lakeshore99.org", who: "Maya Chen", what: "School SLP, supervises an SLPA" },
  { email: "jordan@lakeshore99.org", who: "Jordan Reyes", what: "SLPA, notes need co-sign" },
  { email: "priya@lakeshore99.org", who: "Priya Nair", what: "School OT, license expiring" },
  { email: "sam@lakeshore99.org", who: "Sam Okafor", what: "School PT, NPI typo" },
  { email: "dana@lakeshore99.org", who: "Dana Whitfield", what: "District Medicaid coordinator" },
];

async function login(formData: FormData) {
  "use server";
  const result = await signIn(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if ("error" in result) redirect(`/login?error=${result.error}`);
  redirect(result.user.role === "coordinator" ? "/minutes" : "/today");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/today");
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 px-4 py-12 md:flex-row md:items-center">
      <section className="flex-1">
        <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand">
          <span className="grid size-7 place-items-center rounded-lg bg-brand text-white">S</span>
          Sessionside
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Every session you deliver, documented and claimable.</h1>
        <p className="mt-3 text-ink-3">
          Dictate for 30 seconds after a session. Sessionside drafts an IEP-aligned note, checks consent, orders, credentials, and minutes, and tells you what is blocking the claim before you sign.
        </p>
      </section>
      <section className="card w-full max-w-sm p-6">
        <form action={login} className="space-y-3">
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" required className="field mt-1" defaultValue="maya@lakeshore99.org" />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input name="password" type="password" required className="field mt-1" defaultValue="demo" />
          </label>
          {error && (
            <p role="alert" className="text-sm text-block">
              {error === "locked" ? "Too many failed attempts. Try again in 15 minutes." : "That email and password did not match."}
            </p>
          )}
          <button className="btn-primary w-full" type="submit">Sign in</button>
        </form>
        <div className="mt-6 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-4">Demo accounts (password: demo)</p>
          <div className="space-y-1.5">
            {DEMO.map((d) => (
              <form key={d.email} action={login}>
                <input type="hidden" name="email" value={d.email} />
                <input type="hidden" name="password" value="demo" />
                <button type="submit" className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunken">
                  <span className="font-medium">{d.who}</span> <span className="text-ink-3">{d.what}</span>
                </button>
              </form>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-ink-3"><a className="underline" href="/trust">Trust and data use</a></p>
      </section>
    </main>
  );
}
