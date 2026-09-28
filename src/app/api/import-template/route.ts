import { currentUser } from "@/lib/auth";
import { IMPORT_COLUMNS, type ImportKind } from "@/lib/importers";

const EXAMPLES: Record<ImportKind, string> = {
  students: "S100,Nora,Quinn,2017-03-02,Dewey Elementary,3,IL999000111,2026-08-20,2027-08-19",
  services: "S100,slp,60,individual,maya@lakeshore99.org",
  goals: "S100,slp,Articulation,Produce /r/ in initial position with 80% accuracy,r words;initial r",
  consents: "S100,2026-08-15,",
  orders: "S100,slp,Dr. Alana Brooks,1234567893,2026-08-10,2027-08-09",
  attendance: "S100,2026-09-21,absent",
};

export async function GET(req: Request) {
  if (!(await currentUser())) return new Response("Unauthorized", { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind") as ImportKind;
  if (!(kind in IMPORT_COLUMNS)) return new Response("Unknown template", { status: 400 });
  return new Response(`${IMPORT_COLUMNS[kind].join(",")}\n${EXAMPLES[kind]}\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="sessionside-${kind}-template.csv"` },
  });
}
