/* ------------------------------------------------------------------ */
/*  Verdant Health · Mock Data Layer                                   */
/* ------------------------------------------------------------------ */

export interface Patient {
  name: string;
  firstName: string;
  age: number;
  id: string;
  initials: string;
  plan: string;
  memberSince: string;
  bloodType: string;
  email: string;
  concierge: { name: string; phone: string };
}

export type AppointmentKind = "consult" | "service";

export interface Appointment {
  id: string;
  kind: AppointmentKind;
  title: string;
  provider: string;
  dept: string;
  dayOffset: number;
  time: string;
  duration: string;
  location: string;
  status: "confirmed" | "completed";
  note?: string;
  hasRecord?: boolean;
  /** Links this visit to a lab/test report in the records vault */
  recordId?: string;
  /** Links this consult to a prescription issued by the physician */
  prescriptionId?: string;
}

export interface Slot {
  time: string;
  free: number;
}

export interface Doctor {
  id: string;
  name: string;
  initials: string;
  dept: string;
  rating: number;
  reviews: number;
  fee: number;
  duration: string;
  dayOffset: number;
  slots: Slot[];
}

export interface ClinicalService {
  id: string;
  name: string;
  dept: string;
  duration: string;
  fee: number;
  dayOffset: number;
  prep: string;
  slots: Slot[];
}

export interface ChecklistItem {
  label: string;
  done: boolean;
  /** Saved answer, shown once the item is completed */
  value?: string;
  /** Placeholder shown inside the inline answer field */
  placeholder?: string;
}

export interface Checklist {
  id: string;
  title: string;
  for: string;
  dueOffset: number;
  submitted?: boolean;
  items: ChecklistItem[];
}

export interface Prescription {
  id: string;
  rx: string;
  medication: string;
  dosage: string;
  prescriber: string;
  dept: string;
  dayOffset: number;
  refills: number;
  notes: string;
}

export interface LabMetric {
  label: string;
  value: string;
  ref: string;
}

export interface ServiceRecord {
  id: string;
  refId: string;
  title: string;
  dept: string;
  dayOffset: number;
  status: string;
  note: string;
  metrics: LabMetric[];
}

/* ---------------------------- Patient ------------------------------ */

export const patient: Patient = {
  name: "Amelia Hartwell",
  firstName: "Amelia",
  age: 34,
  id: "MDC-2481",
  initials: "AH",
  plan: "Concierge Platinum",
  memberSince: "2021",
  bloodType: "O+",
  email: "amelia.hartwell@verdant.health",
  concierge: { name: "Sofia Marchetti", phone: "+1 (415) 555-0184" },
};

/* -------------------------- Appointments --------------------------- */

export const seedAppointments: Appointment[] = [
  {
    id: "apt-101",
    kind: "consult",
    title: "Annual Wellness Review",
    provider: "Dr. Adrian Vale",
    dept: "Internal Medicine",
    dayOffset: 1,
    time: "09:30",
    duration: "45 min",
    location: "In-clinic · Suite 12",
    status: "confirmed",
    note: "Fasting not required. Bring your current supplement list.",
  },
  {
    id: "apt-102",
    kind: "service",
    title: "Cardiac Stress Test",
    provider: "Verdant Diagnostics",
    dept: "Cardiology",
    dayOffset: 3,
    time: "08:15",
    duration: "60 min",
    location: "Diagnostics Wing · Level 2",
    status: "confirmed",
    note: "Wear comfortable shoes. No caffeine 3 hours prior.",
  },
  {
    id: "apt-103",
    kind: "consult",
    title: "Dermatology Follow-up",
    provider: "Dr. Marcus Chen",
    dept: "Dermatology",
    dayOffset: 6,
    time: "14:00",
    duration: "30 min",
    location: "In-clinic · Suite 7",
    status: "confirmed",
  },
  {
    id: "apt-091",
    kind: "service",
    title: "Comprehensive Blood Panel",
    provider: "Verdant Diagnostics",
    dept: "Clinical Pathology",
    dayOffset: -6,
    time: "07:45",
    duration: "20 min",
    location: "Diagnostics Wing · Level 2",
    status: "completed",
    note: "Results reviewed by Dr. Vale. All values within range.",
    hasRecord: true,
    recordId: "rec-01",
  },
  {
    id: "apt-084",
    kind: "consult",
    title: "Sleep & Hormone Consultation",
    provider: "Dr. Elena Rossi",
    dept: "Endocrinology",
    dayOffset: -13,
    time: "11:00",
    duration: "45 min",
    location: "In-clinic · Suite 4",
    status: "completed",
    note: "New sleep-hygiene plan issued. Follow-up in 8 weeks.",
    prescriptionId: "rx-2001",
  },
  {
    id: "apt-079",
    kind: "consult",
    title: "Hypertension Follow-up",
    provider: "Dr. Adrian Vale",
    dept: "Internal Medicine",
    dayOffset: -18,
    time: "16:30",
    duration: "30 min",
    location: "In-clinic · Suite 12",
    status: "completed",
    note: "BP trending well at 121/79. Lisinopril continued at 10 mg.",
    prescriptionId: "rx-2041",
  },
  {
    id: "apt-074",
    kind: "consult",
    title: "Nutritional Wellness Review",
    provider: "Dr. Adrian Vale",
    dept: "Internal Medicine",
    dayOffset: -32,
    time: "15:00",
    duration: "30 min",
    location: "In-clinic · Suite 12",
    status: "completed",
    note: "Vitamin D at 42 ng/mL. Supplement continued at 2,000 IU.",
    prescriptionId: "rx-2033",
  },
  {
    id: "apt-077",
    kind: "consult",
    title: "Seasonal Influenza Vaccination",
    provider: "Nurse P. Delgado",
    dept: "Preventive Care",
    dayOffset: -20,
    time: "10:30",
    duration: "15 min",
    location: "In-clinic · Suite 1",
    status: "completed",
  },
  {
    id: "apt-066",
    kind: "service",
    title: "DEXA Bone Density Scan",
    provider: "Verdant Diagnostics",
    dept: "Imaging",
    dayOffset: -34,
    time: "09:00",
    duration: "20 min",
    location: "Diagnostics Wing · Level 1",
    status: "completed",
    note: "T-score −0.4 — within normal range.",
    hasRecord: true,
    recordId: "rec-02",
  },
];

/* ----------------------- Booking catalogue ------------------------- */

export const doctors: Doctor[] = [
  {
    id: "doc-01",
    name: "Dr. Adrian Vale",
    initials: "AV",
    dept: "Internal Medicine",
    rating: 4.9,
    reviews: 128,
    fee: 220,
    duration: "45 min",
    dayOffset: 1,
    slots: [
      { time: "09:30", free: 4 },
      { time: "10:15", free: 2 },
      { time: "11:00", free: 1 },
      { time: "14:30", free: 3 },
      { time: "15:15", free: 4 },
      { time: "16:00", free: 0 },
    ],
  },
  {
    id: "doc-02",
    name: "Dr. Priya Nair",
    initials: "PN",
    dept: "Cardiology",
    rating: 4.8,
    reviews: 96,
    fee: 260,
    duration: "45 min",
    dayOffset: 2,
    slots: [
      { time: "08:45", free: 3 },
      { time: "09:30", free: 1 },
      { time: "10:15", free: 0 },
      { time: "13:30", free: 2 },
      { time: "14:15", free: 3 },
    ],
  },
  {
    id: "doc-03",
    name: "Dr. Marcus Chen",
    initials: "MC",
    dept: "Dermatology",
    rating: 4.7,
    reviews: 87,
    fee: 200,
    duration: "30 min",
    dayOffset: 1,
    slots: [
      { time: "09:00", free: 2 },
      { time: "10:00", free: 3 },
      { time: "11:15", free: 0 },
      { time: "15:00", free: 4 },
      { time: "16:00", free: 2 },
    ],
  },
  {
    id: "doc-04",
    name: "Dr. Elena Rossi",
    initials: "ER",
    dept: "Endocrinology",
    rating: 4.9,
    reviews: 112,
    fee: 240,
    duration: "45 min",
    dayOffset: 3,
    slots: [
      { time: "09:15", free: 1 },
      { time: "10:00", free: 0 },
      { time: "11:30", free: 3 },
      { time: "14:45", free: 2 },
      { time: "15:30", free: 4 },
    ],
  },
  {
    id: "doc-05",
    name: "Dr. Jonah Weiss",
    initials: "JW",
    dept: "Neurology",
    rating: 4.6,
    reviews: 74,
    fee: 280,
    duration: "45 min",
    dayOffset: 2,
    slots: [
      { time: "08:30", free: 2 },
      { time: "09:45", free: 3 },
      { time: "11:00", free: 1 },
      { time: "14:00", free: 0 },
      { time: "15:30", free: 2 },
    ],
  },
  {
    id: "doc-06",
    name: "Dr. Imogen Clarke",
    initials: "IC",
    dept: "Gastroenterology",
    rating: 4.8,
    reviews: 59,
    fee: 230,
    duration: "45 min",
    dayOffset: 4,
    slots: [
      { time: "09:00", free: 4 },
      { time: "10:30", free: 2 },
      { time: "13:15", free: 3 },
      { time: "14:45", free: 1 },
      { time: "16:15", free: 0 },
    ],
  },
];

export const clinicalServices: ClinicalService[] = [
  {
    id: "svc-01",
    name: "Comprehensive Blood Panel",
    dept: "Clinical Pathology",
    duration: "20 min",
    fee: 95,
    dayOffset: 2,
    prep: "Fasting required — 8 hours, water only.",
    slots: [
      { time: "07:30", free: 5 },
      { time: "08:00", free: 4 },
      { time: "08:30", free: 2 },
      { time: "09:00", free: 1 },
      { time: "09:30", free: 0 },
    ],
  },
  {
    id: "svc-02",
    name: "Full-Body MRI · 3T",
    dept: "Imaging",
    duration: "45 min",
    fee: 480,
    dayOffset: 3,
    prep: "Remove all metal. Comfortable clothing recommended.",
    slots: [
      { time: "08:00", free: 1 },
      { time: "09:15", free: 2 },
      { time: "10:30", free: 0 },
      { time: "13:00", free: 1 },
      { time: "14:15", free: 2 },
    ],
  },
  {
    id: "svc-03",
    name: "Cardiac Stress Test",
    dept: "Cardiology",
    duration: "60 min",
    fee: 310,
    dayOffset: 4,
    prep: "No caffeine or heavy meals for 3 hours prior.",
    slots: [
      { time: "07:45", free: 2 },
      { time: "09:00", free: 1 },
      { time: "11:00", free: 3 },
      { time: "13:30", free: 0 },
      { time: "15:00", free: 2 },
    ],
  },
  {
    id: "svc-04",
    name: "DEXA Bone Density",
    dept: "Imaging",
    duration: "20 min",
    fee: 140,
    dayOffset: 2,
    prep: "No calcium supplements on the day of the scan.",
    slots: [
      { time: "08:15", free: 3 },
      { time: "09:30", free: 2 },
      { time: "10:45", free: 1 },
      { time: "13:45", free: 4 },
      { time: "15:00", free: 2 },
    ],
  },
  {
    id: "svc-05",
    name: "Allergy Screening Panel",
    dept: "Immunology",
    duration: "30 min",
    fee: 160,
    dayOffset: 3,
    prep: "Avoid antihistamines for 5 days prior.",
    slots: [
      { time: "08:30", free: 4 },
      { time: "09:45", free: 1 },
      { time: "11:15", free: 0 },
      { time: "14:00", free: 3 },
      { time: "15:30", free: 2 },
    ],
  },
  {
    id: "svc-06",
    name: "Resting ECG & Holter Fit",
    dept: "Cardiology",
    duration: "30 min",
    fee: 180,
    dayOffset: 1,
    prep: "No body lotion on chest area.",
    slots: [
      { time: "09:00", free: 2 },
      { time: "10:15", free: 3 },
      { time: "11:30", free: 1 },
      { time: "14:15", free: 4 },
      { time: "15:45", free: 0 },
    ],
  },
];

/* ----------------------------- Records ----------------------------- */

export const seedChecklists: Checklist[] = [
  {
    id: "chk-01",
    title: "Pre-Visit Intake",
    for: "Dr. Adrian Vale",
    dueOffset: 1,
    items: [
      {
        label: "List current medications & supplements",
        done: true,
        value: "Lisinopril 10 mg · Vitamin D3 2000 IU · Omega-3",
        placeholder: "e.g., Lisinopril 10 mg, Vitamin D3 2000 IU…",
      },
      {
        label: "Describe symptoms, onset & duration",
        done: true,
        value: "Mild shoulder ache — onset 6 weeks ago, worse after workouts",
        placeholder: "e.g., Mild shoulder ache since last Tuesday…",
      },
      {
        label: "Rate sleep & REM quality over the last 7 days",
        done: false,
        placeholder: "e.g., 7h 20m average · REM 22% · waking twice nightly",
      },
      {
        label: "Add last 3 blood-pressure readings",
        done: false,
        placeholder: "e.g., 118/76 · 121/79 · 116/75",
      },
      {
        label: "Note any family-history updates",
        done: false,
        placeholder: "e.g., Father — hypertension, onset age 61",
      },
    ],
  },
  {
    id: "chk-02",
    title: "Cardiac Pre-Test Questionnaire",
    for: "Cardiology Dept.",
    dueOffset: 3,
    items: [
      {
        label: "Confirm exercise comfort level (1–10)",
        done: false,
        placeholder: "e.g., 7 — light jog for 20 min",
      },
      {
        label: "Log caffeine & alcohol intake this week",
        done: false,
        placeholder: "e.g., 2 espressos/day · no alcohol",
      },
      {
        label: "Confirm no fever or infection (past 48h)",
        done: true,
        value: "Confirmed — no fever or infection in the last 48h",
        placeholder: "e.g., Confirmed — no symptoms",
      },
      {
        label: "Sign exercise consent form",
        done: false,
        placeholder: "e.g., Signed & dated 03/04",
      },
    ],
  },
  {
    id: "chk-03",
    title: "Lifestyle & Nutrition Survey",
    for: "Wellness Team",
    dueOffset: 8,
    items: [
      {
        label: "Log a typical weekday of meals",
        done: true,
        value: "Oats 8:00 · salmon salad 12:30 · chicken & greens 19:00",
        placeholder: "e.g., Oats 8am, salmon salad 12:30…",
      },
      {
        label: "Weekly movement routine (type & duration)",
        done: false,
        placeholder: "e.g., 3× strength · 2× 5k runs",
      },
      {
        label: "Current stress levels & triggers",
        done: false,
        placeholder: "e.g., 5/10 — deadlines, improving with walks",
      },
      {
        label: "Hydration habits — average glasses / day",
        done: false,
        placeholder: "e.g., 8 glasses",
      },
      {
        label: "Sleep environment preferences",
        done: false,
        placeholder: "e.g., 19°C, blackout blinds, no screens after 22:00",
      },
    ],
  },
];

export const seedPrescriptions: Prescription[] = [
  {
    id: "rx-2041",
    rx: "RX-2041",
    medication: "Lisinopril",
    dosage: "10 mg · once daily, morning",
    prescriber: "Dr. Adrian Vale",
    dept: "Internal Medicine",
    dayOffset: -18,
    refills: 2,
    notes:
      "Take with a full glass of water. Continue weekly blood-pressure monitoring and log readings in your intake forms.",
  },
  {
    id: "rx-2033",
    rx: "RX-2033",
    medication: "Vitamin D3",
    dosage: "2,000 IU · once daily with breakfast",
    prescriber: "Dr. Adrian Vale",
    dept: "Internal Medicine",
    dayOffset: -32,
    refills: 5,
    notes: "Recheck serum level at your next blood panel.",
  },
  {
    id: "rx-1994",
    rx: "RX-1994",
    medication: "Amoxicillin",
    dosage: "500 mg · twice daily for 7 days",
    prescriber: "Dr. Priya Nair",
    dept: "Cardiology",
    dayOffset: -58,
    refills: 0,
    notes: "Course completed — discontinue on day 7.",
  },
  {
    id: "rx-2001",
    rx: "RX-2001",
    medication: "Melatonin",
    dosage: "3 mg · 30 min before bed, as needed",
    prescriber: "Dr. Elena Rossi",
    dept: "Endocrinology",
    dayOffset: -12,
    refills: 3,
    notes: "Begin with 3 mg for 4 weeks alongside the sleep-hygiene plan, then review at follow-up.",
  },
];

export const seedServiceRecords: ServiceRecord[] = [
  {
    id: "rec-01",
    refId: "LAB-2214",
    title: "Comprehensive Blood Panel",
    dept: "Clinical Pathology",
    dayOffset: -6,
    status: "Normal",
    note: "Reviewed & signed by Dr. Adrian Vale.",
    metrics: [
      { label: "Hemoglobin", value: "13.8 g/dL", ref: "12.0 – 15.5" },
      { label: "Vitamin D (25-OH)", value: "42 ng/mL", ref: "30 – 100" },
      { label: "Fasting Glucose", value: "88 mg/dL", ref: "70 – 99" },
      { label: "LDL Cholesterol", value: "102 mg/dL", ref: "< 130" },
    ],
  },
  {
    id: "rec-02",
    refId: "IMG-1187",
    title: "DEXA Bone Density Scan",
    dept: "Imaging",
    dayOffset: -34,
    status: "Normal",
    note: "Lumbar spine & hip. T-scores within normal range.",
    metrics: [
      { label: "Lumbar spine T-score", value: "−0.4", ref: "> −1.0" },
      { label: "Femoral neck T-score", value: "−0.6", ref: "> −1.0" },
      { label: "Bone mineral density", value: "1.12 g/cm²", ref: "0.90 – 1.25" },
    ],
  },
  {
    id: "rec-03",
    refId: "IMG-1142",
    title: "Resting Electrocardiogram",
    dept: "Cardiology",
    dayOffset: -41,
    status: "Normal",
    note: "Sinus rhythm, 62 bpm. No ST-T changes.",
    metrics: [
      { label: "Heart rate", value: "62 bpm", ref: "60 – 100" },
      { label: "PR interval", value: "158 ms", ref: "120 – 200" },
      { label: "QRS duration", value: "92 ms", ref: "80 – 120" },
    ],
  },
];

/* --------------------------- Date helpers -------------------------- */

export const today = new Date();

export function dateFromOffset(offset: number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d;
}

/**
 * Deterministic slot generator for an arbitrary chosen date.
 *
 * Given the same `optionId` + `dayOffset` this always returns the same set of
 * slots, so a picked date feels stable across popup re-opens while still
 * producing realistic, varying availability per day.
 */
export function generateSlotsForOffset(optionId: string, dayOffset: number): Slot[] {
  let seed = 2166136261;
  const key = `${optionId}::${dayOffset}`;
  for (let i = 0; i < key.length; i++) {
    seed ^= key.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const pool = [
    "08:30", "09:15", "10:00", "10:45", "11:30",
    "13:15", "14:00", "14:45", "15:30", "16:15",
  ];
  const count = 5 + Math.floor(rand() * 3);
  const start = Math.floor(rand() * (pool.length - count + 1));
  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const time = pool[start + i];
    const free = rand() < 0.22 ? 0 : 1 + Math.floor(rand() * 4);
    slots.push({ time, free });
  }
  return slots;
}

/** "Today", "Tomorrow" or the weekday name */
export function dayLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return dateFromOffset(offset).toLocaleDateString("en-US", { weekday: "long" });
}

/** "March 6" (adds year when it differs from the current year) */
export function fullDate(offset: number): string {
  const d = dateFromOffset(offset);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
  if (d.getFullYear() !== today.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

/** "Mar 6" */
export function shortDate(offset: number): string {
  return dateFromOffset(offset).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "Mar 6, 2025" for past records */
export function recordDate(offset: number): string {
  return dateFromOffset(offset).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ------------------------ Document downloads ----------------------- */

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const divider = "────────────────────────────────────────────";

export function prescriptionToText(p: Prescription): string {
  return [
    "VERDANT HEALTH · PRIVATE MEDICAL CONCIERGE",
    "88 Presidio Terrace, San Francisco",
    divider,
    `PRESCRIPTION · ${p.rx}`,
    `Issued ${recordDate(p.dayOffset)}`,
    divider,
    `Patient      Amelia Hartwell (${patient.id})`,
    `Medication   ${p.medication}`,
    `Dosage       ${p.dosage}`,
    `Prescriber   ${p.prescriber} · ${p.dept}`,
    `Refills      ${p.refills}`,
    "",
    "Clinical notes:",
    `  ${p.notes}`,
    divider,
    `Verified: ${p.rx}-VH · Concierge line ${patient.concierge.phone}`,
    "This document is issued electronically by Verdant Health.",
  ].join("\n");
}

export function reportToText(r: ServiceRecord): string {
  const lines = [
    "VERDANT HEALTH · PRIVATE MEDICAL CONCIERGE",
    "88 Presidio Terrace, San Francisco",
    divider,
    `${r.title.toUpperCase()} · ${r.refId}`,
    `Department: ${r.dept}`,
    `Performed: ${recordDate(r.dayOffset)}`,
    `Status: ${r.status.toUpperCase()}`,
    divider,
    "RESULTS",
  ];
  r.metrics.forEach((m) => {
    lines.push(`  ${m.label.padEnd(26, " ")} ${m.value.padEnd(12, " ")} (ref ${m.ref})`);
  });
  lines.push(divider, `Note: ${r.note}`, "", `Patient: ${patient.name} (${patient.id})`);
  lines.push(
    divider,
    "Downloaded from the Verdant Health patient vault.",
    `Concierge line ${patient.concierge.phone}`
  );
  return lines.join("\n");
}
