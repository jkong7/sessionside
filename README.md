# Sessionside

Session notes for school speech, occupational, and physical therapists that turn into clean Medicaid claims.

A July 2026 NYC Comptroller audit found New York City schools forfeited an estimated $431.6M in Medicaid reimbursement over three years. Most of it was not bad therapy. It was paperwork: sessions never recorded, missing parental consent, expired referrals, providers without a valid NPI, and minutes that did not match the IEP. Sessionside closes the gap between a delivered session and a claimable one.

## How it works

1. **Capture.** After a session, the therapist taps the student on today's schedule and dictates for about 30 seconds (or types). Children are never recorded.
2. **Draft.** Sessionside drafts an IEP-aligned note: minutes, individual or group, activities, data per IEP goal (correct/trials, percent, cue level), response, plan, and the procedure code and units.
3. **Check.** Every note runs pre-claim checks: Medicaid ID, parental billing consent (34 CFR 300.154), active IEP, service on the IEP, referral on file and current, provider NPI check digit, license dates, documented minutes, group size, goal data, and the state signature deadline in business days.
4. **Review and sign.** The review queue puts problems first. Signing requires an explicit attestation. "Sign all clean" only signs notes with zero flags. Assistant (SLPA) notes wait for the supervising therapist to co-sign.
5. **Claim.** Only signed notes that pass every check are exported as claim lines (CSV for the district's claiming vendor). Blocked value is broken down by reason.

## Features

- **Today:** schedule, logged vs unlogged sessions, and make-up sessions.
- **Capture:** browser dictation (Web Speech API) with attendance chips and entered minutes.
- **Review & sign:** problems-first queue, editable structured note, attestation, audit trail, supervisor co-sign.
- **IEP minutes:** weekly mandated vs delivered vs billable per student, sessions never logged, minutes still owed, and the estimated value of blocked claims.
- **Claims:** claimable lines, what is blocking the rest, and CSV export (place of service 03).
- **Caseload:** consent and referral status and goal progress trends with a progress-report sentence per goal.
- **Daily digest:** one message a day with counts only. No student names or health details leave the app by email or push.
- **Offline:** installable web app. Sessions logged without a connection are queued on the device and drafted on reconnect.

## Design rules

- **Minutes are never guessed.** They come from what the therapist entered or said, never from the schedule or the model.
- **Nothing is signed or claimed without a human attestation.**
- **Only the clinician's own post-session dictation is captured.** There is no ambient recording in classrooms (California Ed Code 51512, FERPA).
- **Notifications carry no PHI or student names.** The record and signature live behind sign-in.

## Running it

Requires Node 22.13 or later (uses the built-in `node:sqlite`).

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3400. Demo accounts use the password `demo`:

| Account | Role |
|---|---|
| maya@lakeshore99.org | School SLP who supervises an SLPA |
| jordan@lakeshore99.org | SLPA whose notes need co-sign |
| priya@lakeshore99.org | School OT whose license is expiring |
| sam@lakeshore99.org | School PT with an NPI typo |
| dana@lakeshore99.org | District Medicaid coordinator |

The seed builds a fictional Illinois district with 12 students and three weeks of sessions. It covers every problem type: missing and revoked consent, missing Medicaid ID, an expired referral, a missing referral, an invalid NPI, an expiring license, unlogged sessions, overdue signatures, and pending co-signs.

## Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Optional. When set, notes are drafted by Claude (`claude-opus-5-5`) with structured output; any failure falls back to the offline engine. |
| `SESSIONSIDE_ENGINE` | `local` forces the offline rules engine; `claude` forces Claude. |
| `SESSIONSIDE_DB` | SQLite file path. Default `data/sessionside.db`. |
| `SESSIONSIDE_TODAY` | Pin "today" (YYYY-MM-DD) for demos and tests. |
| `SESSIONSIDE_SEED` | `0` skips auto-seeding an empty database. |
| `SESSIONSIDE_INSECURE_COOKIES` | `1` allows non-HTTPS cookies in production mode for local testing. |

## Tests

```bash
npm test
npm run test:e2e
```

- **Unit tests** cover the note engine, claim checks, NPI validation, the minutes report, claims CSV, goal progress, the digest, and the Claude drafter against a fake client.
- **End-to-end tests** cover dictation to signed note, the missing-minutes block, SLPA co-sign, coordinator claims export, and the digest never naming students.

## Stack

Next.js 16 (App Router, server actions), React 19, Tailwind 4, SQLite via `node:sqlite`, Zod, the Anthropic TypeScript SDK, Vitest, and Playwright.

## Not built yet

- State-specific rule packs beyond the configurable demo (Illinois-style) settings.
- Import from district IEP systems (Frontline, PowerSchool) and push to claiming vendors.
- District SSO (Google, Clever, ClassLink) and roster sync.
- Real email or push delivery of the digest.
- A signed BAA or DPA with any AI provider. Keep `SESSIONSIDE_ENGINE=local` for real student data until one is in place.

Procedure code numbers are used for claim formatting only. Descriptions are paraphrased. Dollar values use a demo fee schedule and are estimates.
