import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/repo";

const TABLES: [string, string][] = [
  ["districts", "SELECT * FROM districts WHERE id = ?"],
  ["users", "SELECT id, district_id, email, name, role, discipline, credential, npi, license_number, license_expires, supervisor_id FROM users WHERE district_id = ?"],
  ["students", "SELECT * FROM students WHERE district_id = ?"],
  ["services", "SELECT sv.* FROM services sv JOIN students st ON st.id = sv.student_id WHERE st.district_id = ?"],
  ["goals", "SELECT g.* FROM goals g JOIN students st ON st.id = g.student_id WHERE st.district_id = ?"],
  ["consents", "SELECT c.* FROM consents c JOIN students st ON st.id = c.student_id WHERE st.district_id = ?"],
  ["orders", "SELECT o.* FROM orders o JOIN students st ON st.id = o.student_id WHERE st.district_id = ?"],
  ["slots", "SELECT sl.* FROM slots sl JOIN students st ON st.id = sl.student_id WHERE st.district_id = ?"],
  ["encounters", "SELECT e.* FROM encounters e JOIN students st ON st.id = e.student_id WHERE st.district_id = ?"],
  ["addenda", "SELECT a.* FROM addenda a JOIN encounters e ON e.id = a.encounter_id JOIN students st ON st.id = e.student_id WHERE st.district_id = ?"],
  ["progress_reports", "SELECT p.* FROM progress_reports p JOIN students st ON st.id = p.student_id WHERE st.district_id = ?"],
  ["audit", "SELECT a.* FROM audit a JOIN users u ON u.id = a.user_id WHERE u.district_id = ?"],
];

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "coordinator") return new Response("Forbidden", { status: 403 });
  const out: Record<string, unknown[]> = {};
  for (const [name, sql] of TABLES) out[name] = db().prepare(sql).all(user.district_id) as unknown[];
  audit(user.id, "district.exported", "district", user.district_id, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), district_id: user.district_id, ...out }, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="sessionside-district-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
