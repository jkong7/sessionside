export type Discipline = "slp" | "ot" | "pt";
export type Role = "therapist" | "assistant" | "coordinator";
export type Attendance = "present" | "student_absent" | "provider_absent" | "school_closed";
export type Setting = "individual" | "group";
export type EncounterStatus = "draft" | "cosign_pending" | "signed";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  discipline: Discipline | null;
  credential: string;
  npi: string;
  license_number: string;
  license_expires: string;
  supervisor_id: string | null;
  district_id: string;
};

export type District = {
  id: string;
  name: string;
  state: string;
  settings: DistrictSettings;
};

export type DistrictSettings = {
  state: "IL" | "NY" | "TX" | "MI";
  noteDeadlineDays?: number;
  rates: Record<string, number>;
};

export type Student = {
  id: string;
  district_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  school: string;
  grade: string;
  medicaid_id: string | null;
  iep_start: string;
  iep_end: string;
};

export type Service = {
  id: string;
  student_id: string;
  discipline: Discipline;
  minutes_per_week: number;
  setting: Setting;
  provider_id: string;
};

export type Goal = {
  id: string;
  student_id: string;
  discipline: Discipline;
  area: string;
  text: string;
  keywords: string[];
};

export type Consent = {
  id: string;
  student_id: string;
  kind: string;
  signed_on: string;
  revoked_on: string | null;
};

export type Order = {
  id: string;
  student_id: string;
  discipline: Discipline;
  prescriber: string;
  prescriber_npi: string;
  signed_on: string;
  expires_on: string;
};

export type Slot = {
  id: string;
  provider_id: string;
  student_id: string;
  weekday: number;
  start: string;
  minutes: number;
  setting: Setting;
};

export type GoalData = {
  goal_id: string;
  correct: number | null;
  trials: number | null;
  percent: number | null;
  cue: string | null;
  evidence: string;
};

export type Note = {
  summary: string;
  activities: string[];
  goals: GoalData[];
  response: string;
  plan: string;
  minutes: number | null;
  minutes_source: "stated" | "entered" | "missing";
  setting: Setting;
  group_size: number | null;
  attendance: Attendance;
  cpt: string | null;
  units: number;
  modifiers?: string[];
  time_start?: string | null;
  time_end?: string | null;
  engine: string;
  uncertain: string[];
};

export type Encounter = {
  id: string;
  student_id: string;
  provider_id: string;
  date: string;
  start: string;
  transcript: string;
  note: Note;
  status: EncounterStatus;
  signed_at: string | null;
  signed_by: string | null;
  cosigned_at: string | null;
  cosigned_by: string | null;
  group_key?: string | null;
  draft_note?: Note | null;
  created_at: string;
  updated_at: string;
};
