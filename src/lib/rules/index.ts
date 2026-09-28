import type { Discipline } from "../types";

export type StateCode = "IL" | "NY" | "TX" | "MI";

export type CodeRule = {
  individual: string;
  group: string;
  timed: boolean;
  groupTimed?: boolean;
  modifiers: string[];
  assistantModifier?: string;
  maxUnitsPerDay: number | null;
};

export type RulePack = {
  state: StateCode;
  name: string;
  program: string;
  sources: { label: string; url: string }[];
  noteDeadline: { days: number; hard: boolean } | null;
  requireTimes: boolean;
  requireGoalLink: boolean;
  group: { min: number; max: number | null };
  orders: Record<Discipline, { required: boolean; validityDays: number; label: string }>;
  cosign: { required: boolean; withinDays: number | null; monthlyReview: boolean };
  codes: Record<Discipline, CodeRule>;
  filingLimitDays: number | null;
  retentionYears: number;
  requireCccForSlp: boolean;
  nonIepBillable: Record<Discipline, boolean>;
};

const IL: RulePack = {
  state: "IL",
  name: "Illinois",
  program: "HFS School-Based Health Services (LEA)",
  sources: [
    { label: "HFS Handbook for Local Education Agency Services (Dec 2025)", url: "https://hfs.illinois.gov/content/dam/soi/en/web/hfs/sitecollectiondocuments/leahandbook.pdf" },
    { label: "Student Online Personal Protection Act (105 ILCS 85)", url: "https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3806&ChapterID=17" },
  ],
  noteDeadline: null,
  requireTimes: false,
  requireGoalLink: false,
  group: { min: 2, max: null },
  orders: {
    slp: { required: true, validityDays: 365, label: "Referral" },
    ot: { required: true, validityDays: 365, label: "Order" },
    pt: { required: true, validityDays: 365, label: "Order" },
  },
  cosign: { required: true, withinDays: null, monthlyReview: true },
  codes: {
    slp: { individual: "92507", group: "92508", timed: true, modifiers: [], maxUnitsPerDay: 32 },
    ot: { individual: "97535", group: "97799", timed: true, modifiers: [], maxUnitsPerDay: 32 },
    pt: { individual: "97110", group: "97150", timed: true, modifiers: [], maxUnitsPerDay: 32 },
  },
  filingLimitDays: 180,
  retentionYears: 6,
  requireCccForSlp: true,
  nonIepBillable: { slp: true, ot: true, pt: true },
};

const NY: RulePack = {
  state: "NY",
  name: "New York",
  program: "School Supportive Health Services Program (Medicaid in Education)",
  sources: [{ label: "SSHSP Handbook Update 10 (July 2024) and 2025-2026 Medicaid Alerts", url: "https://www.oms.nysed.gov/medicaid/handbook/Final%20SSHSP%20Handbook%20Update%2010%20-corrected.pdf" }],
  noteDeadline: { days: 0, hard: false },
  requireTimes: true,
  requireGoalLink: true,
  group: { min: 2, max: null },
  orders: {
    slp: { required: true, validityDays: 365, label: "Order or SLP referral" },
    ot: { required: true, validityDays: 365, label: "Order" },
    pt: { required: true, validityDays: 365, label: "Order" },
  },
  cosign: { required: true, withinDays: 45, monthlyReview: false },
  codes: {
    slp: { individual: "92507", group: "92508", timed: false, modifiers: ["GN"], maxUnitsPerDay: null },
    ot: { individual: "97530", group: "97150", timed: true, groupTimed: false, modifiers: ["GO"], maxUnitsPerDay: null },
    pt: { individual: "97110", group: "97150", timed: true, groupTimed: false, modifiers: ["GP"], maxUnitsPerDay: null },
  },
  filingLimitDays: null,
  retentionYears: 6,
  requireCccForSlp: true,
  nonIepBillable: { slp: false, ot: false, pt: false },
};

const TX: RulePack = {
  state: "TX",
  name: "Texas",
  program: "School Health and Related Services (SHARS)",
  sources: [{ label: "Texas Medicaid Provider Procedures Manual, SHARS handbook (Sept 2026)", url: "https://www.tmhp.com/sites/default/files/file-library/resources/provider-manuals/tmppm/pdf-chapters/2026/2026-09-september/2_18_shars.pdf" }],
  noteDeadline: { days: 7, hard: true },
  requireTimes: true,
  requireGoalLink: true,
  group: { min: 2, max: null },
  orders: {
    slp: { required: true, validityDays: 3 * 365, label: "Referral" },
    ot: { required: true, validityDays: 3 * 365, label: "Prescription" },
    pt: { required: true, validityDays: 3 * 365, label: "Prescription" },
  },
  cosign: { required: false, withinDays: null, monthlyReview: false },
  codes: {
    slp: { individual: "92507", group: "92508", timed: false, modifiers: ["GN", "U8"], assistantModifier: "U1", maxUnitsPerDay: 1 },
    ot: { individual: "97530", group: "97150", timed: true, modifiers: ["GO"], assistantModifier: "U1", maxUnitsPerDay: 4 },
    pt: { individual: "97110", group: "97150", timed: true, modifiers: ["GP"], assistantModifier: "U1", maxUnitsPerDay: 4 },
  },
  filingLimitDays: 365,
  retentionYears: 7,
  requireCccForSlp: false,
  nonIepBillable: { slp: false, ot: false, pt: false },
};

const MI: RulePack = {
  state: "MI",
  name: "Michigan",
  program: "School Services Program (Caring for Students)",
  sources: [{ label: "Michigan Medicaid Provider Manual, School Services Program chapter (July 2026)", url: "https://www.mdch.state.mi.us/dch-medicaid/manuals/MedicaidProviderManual.pdf" }],
  noteDeadline: null,
  requireTimes: true,
  requireGoalLink: false,
  group: { min: 2, max: 8 },
  orders: {
    slp: { required: true, validityDays: 365, label: "Referral" },
    ot: { required: true, validityDays: 365, label: "Prescription" },
    pt: { required: true, validityDays: 365, label: "Prescription" },
  },
  cosign: { required: true, withinDays: null, monthlyReview: false },
  codes: {
    slp: { individual: "92507", group: "92508", timed: false, modifiers: [], maxUnitsPerDay: null },
    ot: { individual: "97530", group: "97150", timed: true, groupTimed: false, modifiers: [], maxUnitsPerDay: null },
    pt: { individual: "97110", group: "97150", timed: true, groupTimed: false, modifiers: [], maxUnitsPerDay: null },
  },
  filingLimitDays: null,
  retentionYears: 7,
  requireCccForSlp: false,
  nonIepBillable: { slp: true, ot: true, pt: true },
};

export const RULE_PACKS: Record<StateCode, RulePack> = { IL, NY, TX, MI };

export function rulePack(state: string | undefined | null): RulePack {
  return RULE_PACKS[(state ?? "IL") as StateCode] ?? IL;
}
