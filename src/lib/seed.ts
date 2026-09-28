import type { DatabaseSync } from "node:sqlite";
import { addDays, today as todayFn, weekday } from "./dates";
import { draftLocal } from "./engine/local";
import { uid } from "./ids";
import { makeNpi } from "./npi";
import { hashPassword } from "./password";
import type { Discipline, DistrictSettings, Goal, Role, Setting } from "./types";

export const DEMO_PASSWORD = "demo";

function rng(seedValue: number) {
  let a = seedValue;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type GoalSpec = { discipline: Discipline; area: string; text: string; keywords: string[]; say: (c: number, t: number, cue: string) => string };

const GOALS: Record<string, GoalSpec> = {
  r: { discipline: "slp", area: "Articulation", text: "Produce /r/ in the initial position of words with 80% accuracy given minimal cues", keywords: ["/r/", "r words", "initial r", "r sound"], say: (c, t, cue) => `Initial r words ${c} out of ${t} with ${cue} cues.` },
  s: { discipline: "slp", area: "Articulation", text: "Produce /s/ blends at the phrase level with 80% accuracy", keywords: ["/s/", "s blends", "s sound"], say: (c, t, cue) => `S blends in phrases ${c} out of ${t} with ${cue} cues.` },
  directions: { discipline: "slp", area: "Receptive language", text: "Follow 2-step directions with 80% accuracy across 3 sessions", keywords: ["directions", "2-step", "two-step"], say: (c, t, cue) => `Followed two-step directions ${c} of ${t} trials with ${cue} cues.` },
  vocab: { discipline: "slp", area: "Expressive language", text: "Use category vocabulary to name 3 items in a category", keywords: ["vocabulary", "category", "categories", "naming"], say: (c, t, cue) => `Named category vocabulary ${c} of ${t} with ${cue} cues.` },
  pragmatics: { discipline: "slp", area: "Pragmatic language", text: "Maintain a topic for 3 conversational turns with peers", keywords: ["conversation", "turns", "topic", "turn taking"], say: (c, t, cue) => `Kept a conversation topic for 3 turns ${c} of ${t} opportunities with ${cue} cues.` },
  wh: { discipline: "slp", area: "Language comprehension", text: "Answer wh-questions about a short story with 80% accuracy", keywords: ["wh-questions", "wh questions", "questions", "story"], say: (c, t, cue) => `Answered wh questions about the story ${c} out of ${t} with ${cue} cues.` },
  scissors: { discipline: "ot", area: "Fine motor", text: "Cut along a curved line within 1/4 inch using scissors", keywords: ["scissors", "cutting", "cut", "curved line"], say: (c, t, cue) => `Cutting a curved line with scissors ${c} of ${t} attempts with ${cue} cues.` },
  handwriting: { discipline: "ot", area: "Handwriting", text: "Copy a 5-word sentence with correct letter formation and spacing", keywords: ["handwriting", "letter formation", "copy", "spacing"], say: (c, t, cue) => `Handwriting: copied sentences with correct letter formation ${c} of ${t} with ${cue} cues.` },
  regulation: { discipline: "ot", area: "Self-regulation", text: "Use a sensory strategy to return to task within 2 minutes", keywords: ["regulation", "sensory", "calming", "strategy"], say: (c, t, cue) => `Used a sensory calming strategy ${c} of ${t} times with ${cue} cues.` },
  stairs: { discipline: "pt", area: "Gross motor", text: "Navigate stairs reciprocally without rail support", keywords: ["stairs", "reciprocal", "rail"], say: (c, t, cue) => `Stairs with reciprocal pattern ${c} of ${t} flights with ${cue} assist.` },
  balance: { discipline: "pt", area: "Balance", text: "Stand on one foot for 10 seconds on each side", keywords: ["balance", "one foot", "single leg"], say: (c, t, cue) => `Single leg balance for 10 seconds ${c} of ${t} trials with ${cue} cues.` },
};

type StudentSpec = {
  first: string;
  last: string;
  grade: string;
  school: string;
  medicaid: boolean;
  consent: "yes" | "missing" | "revoked";
  services: { discipline: Discipline; provider: string; minutes: number; setting: Setting }[];
  goals: string[];
  orderExpired?: boolean;
  orderMissing?: boolean;
};

const STUDENTS: StudentSpec[] = [
  { first: "Ava", last: "Morales", grade: "2", school: "Dewey Elementary", medicaid: true, consent: "yes", services: [{ discipline: "slp", provider: "maya", minutes: 60, setting: "individual" }], goals: ["r", "directions"] },
  { first: "Liam", last: "Johnson", grade: "K", school: "Dewey Elementary", medicaid: true, consent: "yes", services: [{ discipline: "slp", provider: "maya", minutes: 30, setting: "group" }, { discipline: "ot", provider: "priya", minutes: 30, setting: "individual" }], goals: ["vocab", "scissors"] },
  { first: "Sofia", last: "Patel", grade: "4", school: "Lincoln Elementary", medicaid: true, consent: "missing", services: [{ discipline: "slp", provider: "maya", minutes: 60, setting: "individual" }], goals: ["wh", "directions"] },
  { first: "Noah", last: "Kim", grade: "1", school: "Dewey Elementary", medicaid: true, consent: "yes", services: [{ discipline: "slp", provider: "jordan", minutes: 30, setting: "individual" }], goals: ["s"] },
  { first: "Emma", last: "Davis", grade: "3", school: "Lincoln Elementary", medicaid: false, consent: "yes", services: [{ discipline: "slp", provider: "jordan", minutes: 30, setting: "individual" }], goals: ["r"] },
  { first: "Elijah", last: "Brown", grade: "5", school: "Lincoln Elementary", medicaid: true, consent: "yes", services: [{ discipline: "slp", provider: "maya", minutes: 60, setting: "group" }], goals: ["pragmatics"] },
  { first: "Mia", last: "Wilson", grade: "2", school: "Dewey Elementary", medicaid: true, consent: "yes", services: [{ discipline: "ot", provider: "priya", minutes: 60, setting: "individual" }], goals: ["handwriting", "regulation"], orderExpired: true },
  { first: "Lucas", last: "Garcia", grade: "6", school: "Haven Middle School", medicaid: true, consent: "yes", services: [{ discipline: "pt", provider: "sam", minutes: 30, setting: "individual" }], goals: ["stairs"] },
  { first: "Harper", last: "Lee", grade: "1", school: "Dewey Elementary", medicaid: true, consent: "yes", services: [{ discipline: "ot", provider: "priya", minutes: 30, setting: "individual" }, { discipline: "pt", provider: "sam", minutes: 30, setting: "individual" }], goals: ["scissors", "balance"], orderMissing: true },
  { first: "Mateo", last: "Rossi", grade: "3", school: "Lincoln Elementary", medicaid: true, consent: "revoked", services: [{ discipline: "slp", provider: "maya", minutes: 60, setting: "individual" }], goals: ["r", "wh"] },
  { first: "Zoe", last: "Thompson", grade: "K", school: "Dewey Elementary", medicaid: true, consent: "yes", services: [{ discipline: "slp", provider: "jordan", minutes: 30, setting: "individual" }], goals: ["vocab"] },
  { first: "Jayden", last: "Clark", grade: "4", school: "Lincoln Elementary", medicaid: true, consent: "yes", services: [{ discipline: "ot", provider: "priya", minutes: 30, setting: "individual" }, { discipline: "slp", provider: "maya", minutes: 60, setting: "group" }], goals: ["handwriting", "pragmatics"] },
];

const USERS: { key: string; name: string; role: Role; discipline: Discipline | null; credential: string; npi9: string; badNpi?: boolean; license: string; expiresInDays: number; supervisor?: string }[] = [
  { key: "maya", name: "Maya Chen", role: "therapist", discipline: "slp", credential: "M.S., CCC-SLP", npi9: "154872093", license: "146.012345", expiresInDays: 400 },
  { key: "jordan", name: "Jordan Reyes", role: "assistant", discipline: "slp", credential: "SLPA", npi9: "167320985", license: "147.004512", expiresInDays: 400, supervisor: "maya" },
  { key: "priya", name: "Priya Nair", role: "therapist", discipline: "ot", credential: "OTR/L", npi9: "132098467", license: "056.007788", expiresInDays: 18 },
  { key: "sam", name: "Sam Okafor", role: "therapist", discipline: "pt", credential: "PT, DPT", npi9: "189034562", badNpi: true, license: "070.021199", expiresInDays: 500 },
  { key: "dana", name: "Dana Whitfield", role: "coordinator", discipline: null, credential: "Medicaid Coordinator", npi9: "", license: "", expiresInDays: 0 },
];

const ACTIVITIES: Record<Discipline, string[]> = {
  slp: ["Used picture cards and a board game.", "Read a short picture book together.", "Played a barrier game with a peer model.", "Practiced with a worksheet and mirror work."],
  ot: ["Worked at the table with tracing and cutting tasks.", "Used putty and tongs for hand strength warm up.", "Completed an obstacle course before seated work."],
  pt: ["Worked in the gym with the ball and stairs.", "Completed an obstacle course with balance beam.", "Practiced on the playground equipment."],
};
const RESPONSES = ["Engaged and motivated throughout.", "Needed a break midway but returned to task.", "Self-corrected several times.", "Was distracted early, then focused well.", "Participated well with peers."];
const PLANS = ["Next session continue current targets.", "Next session move on to the phrase level.", "Sending home a practice sheet for carryover.", "Will continue to fade cues next week."];
const CUES = ["minimal", "moderate", "minimal verbal", "maximal", "minimal visual"];

export function seed(database: DatabaseSync, base = todayFn()): void {
  const r = rng(20260928);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const settings: DistrictSettings = {
    signatureDeadlineDays: 5,
    ordersRequired: ["ot", "pt"],
    rates: { "92507": 58.4, "92508": 21.1, "97530": 24.9, "97110": 22.7, "97150": 17.3 },
  };
  const districtId = "dist_lakeshore";
  database.exec("BEGIN");
  try {
    database.prepare("INSERT INTO districts (id, name, state, settings) VALUES (?, ?, ?, ?)").run(districtId, "Lakeshore Community Unit School District 99", "IL", JSON.stringify(settings));

    const userIds: Record<string, string> = {};
    const hash = hashPassword(DEMO_PASSWORD);
    for (const u of USERS) {
      userIds[u.key] = `usr_${u.key}`;
      const npi = u.npi9 ? (u.badNpi ? makeNpi(u.npi9).slice(0, 9) + String((Number(makeNpi(u.npi9)[9]) + 3) % 10) : makeNpi(u.npi9)) : "";
      database
        .prepare("INSERT INTO users (id, district_id, email, name, password_hash, role, discipline, credential, npi, license_number, license_expires, supervisor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(userIds[u.key], districtId, `${u.key}@lakeshore99.org`, u.name, hash, u.role, u.discipline, u.credential, npi, u.license, u.expiresInDays ? addDays(base, u.expiresInDays) : "", u.supervisor ? `usr_${u.supervisor}` : null);
    }

    const weekdayLoad: Record<string, number[]> = {};
    const slots: { provider: string; student: string; weekday: number; start: string; minutes: number; setting: Setting; discipline: Discipline; goalIds: Goal[] }[] = [];
    const groupSlots = new Map<string, { weekday: number; start: string }[]>();

    STUDENTS.forEach((s, i) => {
      const id = `stu_${s.first.toLowerCase()}`;
      const iepStart = addDays(base, -40 - i * 17);
      const dob = `${2026 - 6 - (s.grade === "K" ? 0 : Number(s.grade))}-${String((i % 12) + 1).padStart(2, "0")}-${String(((i * 7) % 27) + 1).padStart(2, "0")}`;
      database
        .prepare("INSERT INTO students (id, district_id, first_name, last_name, dob, school, grade, medicaid_id, iep_start, iep_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, districtId, s.first, s.last, dob, s.school, s.grade, s.medicaid ? `IL${String(710000000 + i * 3917).slice(0, 9)}` : null, iepStart, addDays(iepStart, 364));

      const goals: Goal[] = s.goals.map((key) => {
        const spec = GOALS[key];
        const g: Goal = { id: `goal_${s.first.toLowerCase()}_${key}`, student_id: id, discipline: spec.discipline, area: spec.area, text: spec.text, keywords: spec.keywords };
        database.prepare("INSERT INTO goals (id, student_id, discipline, area, text, keywords) VALUES (?, ?, ?, ?, ?, ?)").run(g.id, id, g.discipline, g.area, g.text, JSON.stringify(g.keywords));
        return g;
      });

      if (s.consent !== "missing") {
        database
          .prepare("INSERT INTO consents (id, student_id, kind, signed_on, revoked_on) VALUES (?, ?, 'medicaid_billing', ?, ?)")
          .run(uid("con"), id, addDays(iepStart, -3), s.consent === "revoked" ? addDays(base, -9) : null);
      }

      for (const sv of s.services) {
        database.prepare("INSERT INTO services (id, student_id, discipline, minutes_per_week, setting, provider_id) VALUES (?, ?, ?, ?, ?, ?)").run(uid("svc"), id, sv.discipline, sv.minutes, sv.setting, userIds[sv.provider]);
        if (settings.ordersRequired.includes(sv.discipline) && !(s.orderMissing && sv.discipline === "pt")) {
          const signed = s.orderExpired ? addDays(base, -380) : addDays(iepStart, -5);
          database
            .prepare("INSERT INTO orders (id, student_id, discipline, prescriber, prescriber_npi, signed_on, expires_on) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(uid("ord"), id, sv.discipline, "Dr. Alana Brooks, MD", makeNpi("145602938"), signed, s.orderExpired ? addDays(base, -15) : addDays(signed, 365));
        }
        const sessionsPerWeek = sv.minutes >= 60 ? 2 : 1;
        const perSession = sv.minutes / sessionsPerWeek;
        const load = (weekdayLoad[sv.provider] ??= [0, 0, 0, 0, 0, 0, 0]);
        const groupKey = `${sv.provider}:${sv.discipline}`;
        for (let k = 0; k < sessionsPerWeek; k++) {
          let wd: number;
          let start: string;
          const shared = sv.setting === "group" ? groupSlots.get(groupKey)?.[k] : undefined;
          if (shared) {
            wd = shared.weekday;
            start = shared.start;
          } else {
            const taken = slots.filter((x) => x.student === id && x.provider === userIds[sv.provider]).map((x) => x.weekday);
            const options = [1, 2, 3, 4, 5].filter((d) => !taken.includes(d) && !taken.includes(d - 1) && !taken.includes(d + 1));
            const pool = options.length ? options : [1, 2, 3, 4, 5].filter((d) => !taken.includes(d));
            wd = pool.reduce((best, d) => (load[d] < load[best] ? d : best), pool[0]);
            load[wd] += 1;
            const hour = 8 + load[wd];
            start = `${String(hour).padStart(2, "0")}:${k % 2 ? "30" : "00"}`;
            if (sv.setting === "group") {
              const list = groupSlots.get(groupKey) ?? [];
              list[k] = { weekday: wd, start };
              groupSlots.set(groupKey, list);
            }
          }
          slots.push({ provider: userIds[sv.provider], student: id, weekday: wd, start, minutes: perSession, setting: sv.setting, discipline: sv.discipline, goalIds: goals });
          database.prepare("INSERT INTO slots (id, provider_id, student_id, weekday, start, minutes, setting) VALUES (?, ?, ?, ?, ?, ?, ?)").run(uid("slot"), userIds[sv.provider], id, wd, start, perSession, sv.setting);
        }
      }
    });

    const insertEnc = database.prepare(
      "INSERT INTO encounters (id, student_id, provider_id, date, start, transcript, note, status, signed_at, signed_by, cosigned_at, cosigned_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (let back = 21; back >= 1; back--) {
      const date = addDays(base, -back);
      const wd = weekday(date);
      if (wd === 0 || wd === 6) continue;
      for (const sl of slots.filter((x) => x.weekday === wd)) {
        const roll = r();
        if (roll < 0.12) continue;
        const goals = sl.goalIds.filter((g) => g.discipline === sl.discipline);
        let transcript: string;
        if (roll < 0.19) transcript = pick(["Student was absent today.", "Student was on a field trip and unavailable.", "I was out sick, need a make-up."]);
        else {
          const parts = [`${sl.minutes} minutes${sl.setting === "group" ? " with 2 peers" : " one-on-one"}.`, pick(ACTIVITIES[sl.discipline])];
          for (const g of goals) {
            const spec = Object.values(GOALS).find((x) => x.text === g.text)!;
            const t = pick([5, 10, 10, 10, 20]);
            const c = Math.max(1, Math.min(t, Math.round(t * (0.45 + r() * 0.5))));
            parts.push(spec.say(c, t, pick(CUES)));
          }
          if (r() < 0.08) parts.shift();
          parts.push(pick(RESPONSES), pick(PLANS));
          transcript = parts.join(" ");
        }
        const note = draftLocal({ transcript, discipline: sl.discipline, goals, scheduledSetting: sl.setting });
        const isAssistant = sl.provider === userIds.jordan;
        const recent = back <= 3;
        const unsigned = recent ? r() < 0.6 : r() < 0.07;
        const created = `${date}T${sl.start}:00.000Z`;
        let status = "draft";
        let signedAt: string | null = null;
        let cosignedAt: string | null = null;
        if (!unsigned) {
          const lag = r() < 0.08 ? 7 + Math.floor(r() * 3) : Math.floor(r() * 2);
          const signedDate = addDays(date, lag) >= base ? addDays(base, -1) : addDays(date, lag);
          signedAt = `${signedDate}T21:${String(Math.floor(r() * 59)).padStart(2, "0")}:00.000Z`;
          status = "signed";
          if (isAssistant) {
            if (back > 5 && r() < 0.8) cosignedAt = `${addDays(signedDate, 1) >= base ? signedDate : addDays(signedDate, 1)}T16:00:00.000Z`;
            else status = "cosign_pending";
          }
        }
        insertEnc.run(uid("enc"), sl.student, sl.provider, date, sl.start, transcript, JSON.stringify(note), status, signedAt, signedAt ? sl.provider : null, cosignedAt, cosignedAt ? userIds.maya : null, created, signedAt ?? created);
      }
    }
    database.exec("COMMIT");
  } catch (e) {
    database.exec("ROLLBACK");
    throw e;
  }
}
