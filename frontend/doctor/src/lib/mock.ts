/* ------------------------------------------------------------------ */
/*  AEGIS · Doctor Workspace — mock data layer                        */
/* ------------------------------------------------------------------ */

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "Female" | "Male";
  blood: string;
  phone: string;
  email: string;
  conditions: string[];
  allergies: string[];
  insurance: string;
  hue: number; // avatar duotone hue
  memberSince: number;
}

export type AppointmentStatus =
  | "upcoming"
  | "in-progress"
  | "completed"
  | "cancelled";

export interface Appointment {
  id: string;
  patientId: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "09:30"
  type: "Consultation" | "Follow-up" | "Review" | "Diagnostics";
  status: AppointmentStatus;
  duration: number; // minutes
  notes?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  done: boolean;
}

export interface Checklist {
  id: string;
  patientId: string;
  title: string;
  items: ChecklistItem[];
  status: "pending" | "completed";
  assignedAt: string; // ISO
  updatedAt: string | null; // ISO — when patient completed it
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  fileName: string;
  medications: Medication[];
  notes?: string;
  issuedAt: string; // ISO
  ref: string;
}

/* ----------------------------- helpers ---------------------------- */

const pad = (n: number) => String(n).padStart(2, "0");

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const TODAY = new Date();
export const todayKey = dateKey(TODAY);
export const yesterdayKey = dateKey(addDays(TODAY, -1));

const k = (n: number) => dateKey(addDays(TODAY, n));

const parseKey = (key: string) => new Date(key + "T12:00:00");

export const fmtLong = (key: string) =>
  parseKey(key).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export const fmtShort = (key: string) =>
  parseKey(key).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export const fmtDayNum = (key: string) => parseKey(key).getDate();

export const fmtWeekdayShort = (key: string) =>
  parseKey(key).toLocaleDateString("en-GB", { weekday: "short" });

export const fmtTimeAgo = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
};

export const fmtIssued = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const sortAppointments = (list: Appointment[]) =>
  [...list].sort((a, b) =>
    (a.date + " " + a.time).localeCompare(b.date + " " + b.time)
  );

export const nextAppointment = (
  list: Appointment[],
  patientId: string,
  excludeId?: string
): Appointment | undefined => {
  const now = Date.now();
  const upcoming = list
    .filter(
      (a) =>
        a.patientId === patientId &&
        a.id !== excludeId &&
        (a.status === "upcoming" || a.status === "in-progress")
    )
    .sort((a, b) => (a.date + " " + a.time).localeCompare(b.date + " " + b.time));
  return (
    upcoming.find((a) => new Date(`${a.date}T${a.time}`).getTime() > now) ??
    upcoming[0]
  );
};

/* ------------------------ smart compliance ------------------------ */

export type ComplianceKind =
  | "missing"
  | "pending"
  | "complete"
  | "issued"
  | "not-required"
  | "none";

export function assessCompliance(
  status: AppointmentStatus,
  checklist?: Checklist,
  prescription?: Prescription
): { ck: ComplianceKind; rx: ComplianceKind } {
  const upcomingLike = status === "upcoming" || status === "in-progress";
  const done = status === "completed";

  let ck: ComplianceKind = "none";
  if (checklist) ck = checklist.status === "completed" ? "complete" : "pending";
  else if (upcomingLike) ck = "missing";

  let rx: ComplianceKind = "not-required";
  if (prescription) rx = "issued";
  else if (done) rx = "missing";

  return { ck, rx };
}

/* ------------------------------ data ------------------------------ */

export const DOCTOR = {
  id: "DOC-01",
  name: "Dr. Lena Verhoven",
  specialty: "Neurology",
  title: "Senior Consultant",
  hue: 152,
};

export const PATIENTS: Patient[] = [
  {
    id: "PAT-001",
    name: "Amara Okafor",
    age: 34,
    gender: "Female",
    blood: "O+",
    phone: "+44 7700 900121",
    email: "amara.okafor@post.com",
    conditions: ["Chronic Migraine", "Tension Cephalea"],
    allergies: ["NSAIDs"],
    insurance: "Meridian Health · Gold",
    hue: 212,
    memberSince: 2021,
  },
  {
    id: "PAT-002",
    name: "Julian Mercer",
    age: 58,
    gender: "Male",
    blood: "A−",
    phone: "+44 7700 900438",
    email: "j.mercer@post.com",
    conditions: ["Post-Stroke Recovery", "Hypertension"],
    allergies: [],
    insurance: "Meridian Health · Gold",
    hue: 26,
    memberSince: 2019,
  },
  {
    id: "PAT-003",
    name: "Sofia Lindqvist",
    age: 27,
    gender: "Female",
    blood: "B+",
    phone: "+44 7700 900822",
    email: "sofia.lindqvist@post.com",
    conditions: ["Focal Epilepsy"],
    allergies: ["Penicillin"],
    insurance: "Halcyon Care · Silver",
    hue: 328,
    memberSince: 2024,
  },
  {
    id: "PAT-004",
    name: "David Chen",
    age: 42,
    gender: "Male",
    blood: "AB+",
    phone: "+44 7700 901144",
    email: "d.chen@post.com",
    conditions: ["Obstructive Sleep Apnoea", "Nocturnal Hypoxemia"],
    allergies: [],
    insurance: "Halcyon Care · Silver",
    hue: 158,
    memberSince: 2022,
  },
  {
    id: "PAT-005",
    name: "Priya Nair",
    age: 45,
    gender: "Female",
    blood: "O−",
    phone: "+44 7700 901660",
    email: "priya.nair@post.com",
    conditions: ["Early-Onset Parkinson's", "Mild Dyskinesia"],
    allergies: ["Sulfites"],
    insurance: "Meridian Health · Platinum",
    hue: 276,
    memberSince: 2018,
  },
  {
    id: "PAT-006",
    name: "Marcus Webb",
    age: 61,
    gender: "Male",
    blood: "A+",
    phone: "+44 7700 902013",
    email: "m.webb@post.com",
    conditions: ["ALS · Bulbar Onset", "Dysphagia"],
    allergies: ["Latex"],
    insurance: "Meridian Health · Platinum",
    hue: 188,
    memberSince: 2017,
  },
  {
    id: "PAT-007",
    name: "Elena Petrova",
    age: 52,
    gender: "Female",
    blood: "B−",
    phone: "+44 7700 902549",
    email: "e.petrova@post.com",
    conditions: ["Relapsing MS"],
    allergies: [],
    insurance: "Halcyon Care · Gold",
    hue: 18,
    memberSince: 2020,
  },
  {
    id: "PAT-008",
    name: "Tomás Rivera",
    age: 38,
    gender: "Male",
    blood: "O+",
    phone: "+44 7700 903042",
    email: "t.rivera@post.com",
    conditions: ["Cluster Headaches"],
    allergies: ["Codeine"],
    insurance: "Halcyon Care · Silver",
    hue: 96,
    memberSince: 2023,
  },
  {
    id: "PAT-009",
    name: "Grace Kim",
    age: 29,
    gender: "Female",
    blood: "AB−",
    phone: "+44 7700 903517",
    email: "grace.kim@post.com",
    conditions: ["Idiopathic Vertigo", "Migraine with Aura"],
    allergies: [],
    insurance: "Halcyon Care · Silver",
    hue: 350,
    memberSince: 2025,
  },
  {
    id: "PAT-010",
    name: "Hana Yoshida",
    age: 49,
    gender: "Female",
    blood: "A−",
    phone: "+44 7700 904120",
    email: "h.yoshida@post.com",
    conditions: ["Peripheral Neuropathy", "Type 2 Diabetes"],
    allergies: ["Shellfish"],
    insurance: "Meridian Health · Gold",
    hue: 44,
    memberSince: 2019,
  },
];

export const APPOINTMENTS: Appointment[] = [
  // yesterday
  {
    id: "APT-101",
    patientId: "PAT-008",
    date: k(-1),
    time: "13:45",
    type: "Review",
    status: "completed",
    duration: 30,
    notes: "Cluster frequency dropping. Continuing prophylactic course.",
  },
  // today
  {
    id: "APT-102",
    patientId: "PAT-001",
    date: k(0),
    time: "09:30",
    type: "Consultation",
    status: "completed",
    duration: 45,
    notes: "Initial migraine mapping — aura scoring completed in session.",
  },
  {
    id: "APT-103",
    patientId: "PAT-002",
    date: k(0),
    time: "10:45",
    type: "Follow-up",
    status: "completed",
    duration: 30,
    notes: "Blood pressure steady. Gait improving week over week.",
  },
  {
    id: "APT-104",
    patientId: "PAT-003",
    date: k(0),
    time: "11:30",
    type: "Consultation",
    status: "in-progress",
    duration: 45,
    notes: "Episode diary review — dosage titration discussion.",
  },
  {
    id: "APT-105",
    patientId: "PAT-010",
    date: k(0),
    time: "16:00",
    type: "Review",
    status: "cancelled",
    duration: 30,
    notes: "Rescheduled by patient.",
  },
  // tomorrow
  {
    id: "APT-106",
    patientId: "PAT-004",
    date: k(1),
    time: "09:00",
    type: "Consultation",
    status: "upcoming",
    duration: 45,
    notes: "CPAP pressure re-calibration request.",
  },
  {
    id: "APT-107",
    patientId: "PAT-005",
    date: k(1),
    time: "10:30",
    type: "Follow-up",
    status: "upcoming",
    duration: 30,
  },
  {
    id: "APT-108",
    patientId: "PAT-006",
    date: k(1),
    time: "14:00",
    type: "Diagnostics",
    status: "upcoming",
    duration: 60,
    notes: "Nerve conduction studies — bring sleep log.",
  },
  // +2 days
  {
    id: "APT-109",
    patientId: "PAT-007",
    date: k(2),
    time: "09:15",
    type: "Review",
    status: "upcoming",
    duration: 30,
  },
  {
    id: "APT-110",
    patientId: "PAT-008",
    date: k(2),
    time: "13:45",
    type: "Consultation",
    status: "upcoming",
    duration: 45,
  },
  {
    id: "APT-111",
    patientId: "PAT-003",
    date: k(2),
    time: "16:00",
    type: "Follow-up",
    status: "upcoming",
    duration: 30,
  },
  // +3 days
  {
    id: "APT-112",
    patientId: "PAT-009",
    date: k(3),
    time: "10:00",
    type: "Consultation",
    status: "upcoming",
    duration: 45,
  },
  {
    id: "APT-113",
    patientId: "PAT-002",
    date: k(3),
    time: "15:30",
    type: "Review",
    status: "upcoming",
    duration: 30,
  },
  // +4 days
  {
    id: "APT-114",
    patientId: "PAT-001",
    date: k(4),
    time: "11:00",
    type: "Follow-up",
    status: "upcoming",
    duration: 30,
  },
  // +5 days
  {
    id: "APT-115",
    patientId: "PAT-004",
    date: k(5),
    time: "08:45",
    type: "Review",
    status: "upcoming",
    duration: 30,
  },
  // +6 days
  {
    id: "APT-116",
    patientId: "PAT-005",
    date: k(6),
    time: "09:30",
    type: "Review",
    status: "upcoming",
    duration: 30,
  },
];

export const INITIAL_CHECKLISTS: Checklist[] = [
  {
    id: "CL-003",
    patientId: "PAT-003",
    title: "Seizure Episode Diary",
    status: "pending",
    assignedAt: addDays(TODAY, -2).toISOString(),
    updatedAt: null,
    items: [
      { id: "CLI-31", label: "Medication compliance log", required: true, done: true },
      { id: "CLI-32", label: "Episodes & trigger tracking", required: true, done: false },
      { id: "CLI-33", label: "Sleep quality (7 nights)", required: true, done: false },
      { id: "CLI-34", label: "Aura descriptions", required: false, done: false },
    ],
  },
  {
    id: "CL-002",
    patientId: "PAT-002",
    title: "Post-Stroke Recovery Check",
    status: "completed",
    assignedAt: addDays(TODAY, -7).toISOString(),
    updatedAt: addDays(TODAY, -1).toISOString(),
    items: [
      { id: "CLI-21", label: "Daily walking distance", required: true, done: true },
      { id: "CLI-22", label: "Blood pressure readings", required: true, done: true },
      { id: "CLI-23", label: "Speech exercise sessions", required: true, done: true },
      { id: "CLI-24", label: "Balance exercises", required: true, done: true },
      { id: "CLI-25", label: "Fatigue journal", required: false, done: true },
    ],
  },
  {
    id: "CL-005",
    patientId: "PAT-005",
    title: "Mobility & Tremor Log",
    status: "completed",
    assignedAt: addDays(TODAY, -6).toISOString(),
    updatedAt: addDays(TODAY, -2).toISOString(),
    items: [
      { id: "CLI-51", label: "Tremor severity (morning/evening)", required: true, done: true },
      { id: "CLI-52", label: "Walking gait notes", required: true, done: true },
      { id: "CLI-53", label: "Medication timing log", required: true, done: true },
      { id: "CLI-54", label: "Mood & energy rating", required: false, done: true },
    ],
  },
  {
    id: "CL-006",
    patientId: "PAT-006",
    title: "Pre-Diagnostics Sleep Log",
    status: "pending",
    assignedAt: addDays(TODAY, -1).toISOString(),
    updatedAt: null,
    items: [
      { id: "CLI-61", label: "Nightly sleep duration", required: true, done: true },
      { id: "CLI-62", label: "Choking episodes recorded", required: true, done: true },
      { id: "CLI-63", label: "Daytime sleepiness scale", required: true, done: false },
      { id: "CLI-64", label: "Alcohol & caffeine intake", required: true, done: false },
      { id: "CLI-65", label: "Bedroom environment notes", required: false, done: false },
      { id: "CLI-66", label: "Partner's observations", required: false, done: false },
    ],
  },
  {
    id: "CL-008",
    patientId: "PAT-008",
    title: "Cluster Headache Journal",
    status: "completed",
    assignedAt: addDays(TODAY, -5).toISOString(),
    updatedAt: addDays(TODAY, -1).toISOString(),
    items: [
      { id: "CLI-81", label: "Attack start/end times", required: true, done: true },
      { id: "CLI-82", label: "Pain intensity scale", required: true, done: true },
      { id: "CLI-83", label: "Oxygen use response", required: true, done: true },
      { id: "CLI-84", label: "Seasonal pattern notes", required: false, done: true },
    ],
  },
];

export const INITIAL_PRESCRIPTIONS: Prescription[] = [
  {
    id: "RX-002",
    patientId: "PAT-002",
    fileName: "RX-JUL-0042.pdf",
    ref: "RX-2025-1142",
    issuedAt: new Date().toISOString(),
    notes: "Continue physiotherapy. Review BP in 6 weeks.",
    medications: [
      { id: "RXM-21", name: "Lisinopril", dosage: "10 mg", frequency: "1× daily", duration: "90 days" },
      { id: "RXM-22", name: "Atorvastatin", dosage: "20 mg", frequency: "1× daily", duration: "90 days" },
      { id: "RXM-23", name: "Clopidogrel", dosage: "75 mg", frequency: "1× daily", duration: "30 days" },
    ],
  },
  {
    id: "RX-008",
    patientId: "PAT-008",
    fileName: "RX-TOM-0118.pdf",
    ref: "RX-2025-1133",
    issuedAt: addDays(TODAY, -1).toISOString(),
    notes: "Oxygen at 12 L/min for acute attacks.",
    medications: [
      { id: "RXM-81", name: "Sumatriptan", dosage: "50 mg", frequency: "As needed", duration: "30 days" },
      { id: "RXM-82", name: "Verapamil", dosage: "80 mg", frequency: "2× daily", duration: "60 days" },
    ],
  },
];
