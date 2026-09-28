# Sessionside

**Say it once. Sign a note Medicaid will accept.**

Sessionside is for school speech-language pathologists, occupational therapists, and physical therapists. After a session, the clinician says what happened in about 30 seconds, even for a whole group. Sessionside then writes an IEP-aligned note for each student and checks it against the state's school Medicaid rules. It also tracks IEP minutes and make-up minutes, drafts progress reports, and exports to the systems the district already uses. The clinician reviews and signs every note, and nothing is claimed without their signature.

## Why

- **Money is lost to paperwork.** A July 2026 NYC Comptroller audit found New York City schools lost an estimated $431.6M in Medicaid reimbursement over three years. Most of it was paperwork: unrecorded sessions, missing consent and referrals, provider credential gaps, and minutes that did not match the IEP.
- **Paperwork is the top complaint.** In ASHA's 2024 Schools Survey, 76% of school SLPs name paperwork as their top challenge, and they average 6 hours a week on documentation.
- **Missed minutes create liability.** 79% of school SLPs are required to make up missed sessions, and hearing officers order compensatory services when minutes go undelivered.

The market research behind these choices is in `~/dev/reports/School therapy Medicaid market.md`.

## What it does

**For clinicians**

- **Capture.** The clinician dictates or types after the session. The app works offline and syncs when the connection returns. It never records students.
- **Group sessions.** One dictation naming each student becomes one note per student, with shared minutes, group size, and absences.
- **Drafted notes.** Each draft includes:
  - minutes, individual or group, and start and end times
  - activities, and data per IEP goal (correct/trials, percent, cue level)
  - the student's response and the plan
  - the procedure code, modifiers, and units under the state's rules

  The engine handles run-on dictation, lateness ("arrived 5 minutes late"), breaks, dates that look like fractions, and conflicting durations. It never guesses minutes.
- **Review and sign.** The queue shows problems first. Signing requires an explicit attestation. "Sign all clean" only signs notes with zero flags. SLPA notes wait for the supervisor's co-sign. Signed notes are immutable; corrections go in append-only addenda.
- **Draft vs signed.** The original draft is kept, and every field the clinician changed is shown to them, supervisors, and auditors.
- **IEP minutes.** Weekly mandated vs delivered vs billable minutes per student, plus sessions that were never logged.
- **Make-up ledger.** Tracks minutes owed since the IEP started:
  - provider absences, closures, and unlogged sessions add to the balance
  - student absences are excused
  - extra minutes pay the balance down
- **Progress reports.** Quarterly IEP progress reports are drafted from signed session data, including the goal target, the trend, and how much cueing the student still needs. The clinician edits, signs, and prints.
- **Daily digest.** Counts only, with no student names.

**For district coordinators**

- **Overview.** Shows the documentation rate, claim capture rate, dollars ready to claim, dollars stuck, top blocking reasons, and a breakdown by provider.
- **State rule packs.** Illinois, New York, Texas, and Michigan, each sourced from the state manual. They cover:
  - note deadlines and required clock times
  - group size limits
  - referral rules and how long referrals stay valid
  - co-sign deadlines
  - codes, modifiers, unit math, and daily unit caps
  - timely filing, SLP credential rules, and non-IEP (504 or health plan) billing
- **Pre-claim checks.** Every note is checked for:
  - Medicaid ID, parental consent (34 CFR 300.154), and plan dates
  - service on the IEP or plan, and a current referral with a valid ordering NPI
  - provider NPI and license
  - minutes, times, group size, and goal linkage
  - daily unit caps, co-sign and signing deadlines, and the filing limit
  - school attendance: a session billed on a day the student was absent is blocked
- **Claims.** Claimable lines are exported as CSV with ordering NPI, modifiers, and times, alongside a breakdown of what is blocking the rest.
- **Audit binder.** A printable page per claim with the note, attestations, co-sign, consent, referral, credentials, check results, addenda, and audit trail.
- **Exports.** A service log for the IEP system and a Medicaid billing log. Coordinators can also build their own profiles by choosing and ordering columns to match any import format.
- **Imports.** Students, IEP services (including 504 and health plan services), goals, consents, referrals, and school attendance from CSV. Every row is validated, and nothing is saved unless the whole file is clean.
- **Trust.** A public trust page covers the SOPPA-style data inventory, AI commitments, security controls, and accessibility. The drafting oversight metric shows how often clinicians edit drafts, and coordinators can download a full district data export.

## Design rules

- **Minutes come from the clinician.** They are what the clinician entered or said, never the schedule or a model.
- **Nothing is signed or claimed without a human attestation.**
- **No student audio**, and no ambient recording in classrooms.
- **Notifications carry no PHI.**
- **WCAG 2.1 AA.** Every screen is scanned with axe in the end-to-end suite.

## Security

- **Access:** limited to the user's district, and within it to the treating clinician, their supervisor, and the coordinator.
- **Sessions and sign-in:** session tokens are stored as SHA-256 hashes, sessions expire after 12 hours or 1 hour idle, and 5 failed sign-ins lock the account for 15 minutes.
- **Tamper resistance:** SQLite triggers make signed notes, final progress reports, addenda, and the audit log tamper-resistant.
- **Headers and requests:** strict CSP, frame denial, HSTS, and a microphone-only permissions policy. JSON endpoints check the request origin.

## Running it

Requires Node 22.13 or later (uses the built-in `node:sqlite`).

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3400. Every demo account uses the password `demo`:

| Account | Role |
|---|---|
| maya@lakeshore99.org | School SLP who supervises an SLPA |
| jordan@lakeshore99.org | SLPA whose notes need co-sign |
| priya@lakeshore99.org | School OT whose license is expiring |
| sam@lakeshore99.org | School PT with an NPI typo |
| dana@lakeshore99.org | District Medicaid coordinator |

The seed builds a fictional Illinois district with 13 students and three weeks of sessions. It covers every problem type:
- missing and revoked consent, and a missing Medicaid ID
- expired and missing referrals, an invalid NPI, and an expiring license
- school-attendance conflicts and unlogged sessions
- overdue signatures and pending co-signs
- a 504-plan service

To see the same data under another state's rules, switch the state in District settings.

## Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Optional. When set, notes are drafted by Claude (`claude-opus-5-5`) with structured output and server-side refusal fallbacks. Any failure falls back to the offline engine. |
| `SESSIONSIDE_ENGINE` | `local` forces the offline rules engine; `claude` forces Claude. |
| `SESSIONSIDE_DB` | SQLite file path. Default `data/sessionside.db`. |
| `SESSIONSIDE_TODAY` | Pins "today" (YYYY-MM-DD) for demos and tests. |
| `SESSIONSIDE_SEED` | `0` skips auto-seeding an empty database. |
| `SESSIONSIDE_INSECURE_COOKIES` | `1` allows non-HTTPS cookies in production mode for local testing. |

## Tests

```bash
npm test
npm run test:e2e
```

- **Unit tests** cover:
  - the note engine, with edge cases and 2,000 fuzzed dictations
  - group splitting and state rule packs
  - claim checks, validation, and the attendance cross-check
  - record immutability and access control
  - the minutes report, the make-up ledger, and progress report drafting
  - draft diffs, exports, CSV imports, the digest, and the Claude drafter against a fake client
- **End-to-end tests** cover:
  - dictation through to signed notes, and group sessions
  - SLPA co-sign, progress reports, and the audit binder
  - state switching, exports, imports, and the district data export
  - an axe WCAG 2.1 AA scan of every screen, plus keyboard navigation

## Stack

Next.js 16 (App Router, server actions), React 19, Tailwind 4, SQLite via `node:sqlite`, Zod, the Anthropic TypeScript SDK, Vitest, Playwright, and axe-core.

## Not built yet

- District SSO (Google, Microsoft, Clever, ClassLink) and OneRoster or Ed-Fi sync. CSV import covers pilots.
- Direct connectors to Frontline, EdPlan, EasyTrac, or PowerDS. Export profiles cover the formats for now.
- California and other states. The New York, Texas, and Michigan packs need the details the research could not verify: filing limits, New York's "per the IEP" order phrase from July 2027, and Michigan's code database.
- Parent summaries in the family's home language, time study reminders, and school psychologist evaluation reports.
- A signed BAA or DPA with any AI provider. Keep `SESSIONSIDE_ENGINE=local` for real student data until one is in place.

Rule packs are a starting point drawn from the cited state manuals; confirm them with your state program before relying on them. Procedure code numbers are used for claim formatting only, and descriptions are paraphrased. Dollar values use a demo fee schedule and are estimates.
