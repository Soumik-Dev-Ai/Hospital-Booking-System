import { addDays } from "@/lib/utils";

/* ––––––––––––––––––––––––––––––––––––––––––––––––
   Alderfeld Concierge Medicine · Phase 05 Mock State
   All dates are generated relative to a single anchor
   date ("today") so every filter & range is testable.
   –––––––––––––––––––––––––––––––––––––––––––––––– */

export type ItemStatus = "not-sent" | "sent" | "pending-results" | "closed";
export type ItemKind = "checklist" | "prescription" | "lab";
export type AppointmentStatus =
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled";
export type BookingStatus =
  | "confirmed"
  | "completed"
  | "pending-results"
  | "cancelled";

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  bloodType: string;
  insurance: string;
  condition: string;
  note: string;
  primaryDoctorId: string;
  registeredAt: string; // ISO date
  hue: number;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  room: string;
  hue: number;
}

export type ServiceIconId =
  | "mri"
  | "xray"
  | "ultrasound"
  | "ct"
  | "cardio"
  | "blood"
  | "physio"
  | "derm";

export interface Service {
  id: string;
  name: string;
  tagline: string;
  price: number;
  icon: ServiceIconId;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  serviceId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
}

export interface ComplianceItem {
  id: string;
  appointmentId: string;
  kind: ItemKind;
  label: string;
  status: ItemStatus;
}

export interface Booking {
  id: string;
  patientId: string;
  doctorId: string;
  serviceId: string;
  date: string;
  time: string;
  status: BookingStatus;
}

export interface MockData {
  anchor: string;
  patients: Patient[];
  doctors: Doctor[];
  services: Service[];
  appointments: Appointment[];
  items: ComplianceItem[];
  bookings: Booking[];
}

/* ––––– Status metadata ––––– */

export const STATUS_META: Record<
  ItemStatus,
  { label: string; tone: "amber" | "green" }
> = {
  "not-sent": { label: "Not sent by doctor", tone: "amber" },
  sent: { label: "Awaiting patient", tone: "amber" },
  "pending-results": { label: "Results pending", tone: "amber" },
  closed: { label: "Closed", tone: "green" },
};

export const KIND_META: Record<ItemKind, { label: string }> = {
  checklist: { label: "Checklist" },
  prescription: { label: "Prescription" },
  lab: { label: "Lab work" },
};

export const APPT_STATUS_META: Record<
  AppointmentStatus,
  { label: string; tone: "green" | "amber" | "neutral" }
> = {
  confirmed: { label: "Confirmed", tone: "green" },
  "in-progress": { label: "In progress", tone: "amber" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const BOOKING_STATUS_META: Record<
  BookingStatus,
  { label: string; tone: "green" | "amber" | "neutral" }
> = {
  confirmed: { label: "Confirmed", tone: "green" },
  completed: { label: "Completed", tone: "neutral" },
  "pending-results": { label: "Results pending", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/* ––––– Compliance workflow helpers ––––– */

export function nextStatusFor(item: ComplianceItem): ItemStatus {
  if (item.status === "not-sent") return "sent";
  if (item.status === "sent") {
    return item.kind === "lab" ? "pending-results" : "closed";
  }
  return "closed";
}

export function actionLabelFor(item: ComplianceItem): string {
  if (item.status === "not-sent") return "Send to patient";
  if (item.status === "pending-results") return "Upload results";
  return item.kind === "lab" ? "Mark sample drawn" : "Patient responded";
}

export function itemsForAppointment(
  items: ComplianceItem[],
  appointmentId: string
): ComplianceItem[] {
  return items.filter((i) => i.appointmentId === appointmentId);
}

export function itemsForPatient(
  items: ComplianceItem[],
  patientId: string,
  appointments: Appointment[]
): ComplianceItem[] {
  const apptIds = new Set(
    appointments.filter((a) => a.patientId === patientId).map((a) => a.id)
  );
  return items.filter((i) => apptIds.has(i.appointmentId));
}

export interface ComplianceSummary {
  open: number;
  notSent: number;
  awaiting: number;
  pendingResults: number;
  closed: number;
}

export function summarizeItems(items: ComplianceItem[]): ComplianceSummary {
  const summary: ComplianceSummary = {
    open: 0,
    notSent: 0,
    awaiting: 0,
    pendingResults: 0,
    closed: 0,
  };
  for (const item of items) {
    if (item.status === "not-sent") {
      summary.notSent += 1;
      summary.open += 1;
    } else if (item.status === "sent") {
      summary.awaiting += 1;
      summary.open += 1;
    } else if (item.status === "pending-results") {
      summary.pendingResults += 1;
      summary.open += 1;
    } else {
      summary.closed += 1;
    }
  }
  return summary;
}

/* ––––– Dataset builder ––––– */

const DOCTORS: Doctor[] = [
  { id: "d1", name: "Dr. Elara Whitfield", specialty: "Internal Medicine", room: "Suite 2A", hue: 152 },
  { id: "d2", name: "Dr. Marcus Thorne", specialty: "Cardiology", room: "Suite 3B", hue: 205 },
  { id: "d3", name: "Dr. Amara Osei", specialty: "Endocrinology", room: "Suite 4C", hue: 26 },
  { id: "d4", name: "Dr. Julian Reyes", specialty: "Radiology", room: "Imaging Wing", hue: 268 },
  { id: "d5", name: "Dr. Sofia Lindqvist", specialty: "Neurology", room: "Suite 5A", hue: 322 },
  { id: "d6", name: "Dr. Theodore Ashford", specialty: "Orthopedics", room: "Suite 2C", hue: 44 },
  { id: "d7", name: "Dr. Priya Raghavan", specialty: "Dermatology", room: "Suite 6B", hue: 8 },
  { id: "d8", name: "Dr. Camille Beaumont", specialty: "Pulmonology", room: "Suite 3C", hue: 182 },
];

interface PatientSeed {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  bloodType: string;
  insurance: string;
  condition: string;
  note: string;
  primaryDoctorId: string;
  registeredAt: number;
  hue: number;
}

const PATIENT_SEEDS: PatientSeed[] = [
  {
    id: "p01", name: "Vivienne Aubert", email: "vivienne.aubert@mail.com",
    phone: "+1 415 218 0942", dob: "1978-04-22", bloodType: "A+",
    insurance: "Aurelia Prime", condition: "Hypertension management",
    note: "Annual wellness program · salt-sensitive hypertension, well controlled on lisinopril.",
    primaryDoctorId: "d1", registeredAt: -310, hue: 152,
  },
  {
    id: "p02", name: "Arthur Calloway", email: "arthur.calloway@mail.com",
    phone: "+1 415 662 4310", dob: "1959-11-03", bloodType: "O−",
    insurance: "Aurelia Prime", condition: "Atrial fibrillation",
    note: "Paroxysmal AF · rate-control strategy, quarterly echo surveillance.",
    primaryDoctorId: "d2", registeredAt: -284, hue: 205,
  },
  {
    id: "p03", name: "Isla Marchetti", email: "isla.marchetti@mail.com",
    phone: "+1 628 905 1187", dob: "1984-07-19", bloodType: "B+",
    insurance: "Meridian Health", condition: "Type 2 diabetes",
    note: "HbA1c trending downward · HbA1c retest due, glucose log requested.",
    primaryDoctorId: "d3", registeredAt: -251, hue: 26,
  },
  {
    id: "p04", name: "Henry Nakamura", email: "henry.nakamura@mail.com",
    phone: "+1 510 774 3392", dob: "1966-02-14", bloodType: "A−",
    insurance: "Aurelia Prime", condition: "Chronic shoulder pain",
    note: "Rotator cuff tendinopathy · imaging follow-up scheduled with orthopedics.",
    primaryDoctorId: "d6", registeredAt: -233, hue: 44,
  },
  {
    id: "p05", name: "Margaux Delacroix", email: "margaux.delacroix@mail.com",
    phone: "+1 415 903 6614", dob: "1991-09-30", bloodType: "O+",
    insurance: "Meridian Health", condition: "Migraine with aura",
    note: "Episodic migraine · MRI safety questionnaire outstanding before scan.",
    primaryDoctorId: "d5", registeredAt: -198, hue: 322,
  },
  {
    id: "p06", name: "Oliver Beck", email: "oliver.beck@mail.com",
    phone: "+1 650 418 5520", dob: "1988-01-26", bloodType: "AB+",
    insurance: "Aurelia Prime", condition: "Asthma & allergies",
    note: "Mild persistent asthma · allergen patch test completed, control journal pending.",
    primaryDoctorId: "d8", registeredAt: -176, hue: 182,
  },
  {
    id: "p07", name: "Sofia Andrade", email: "sofia.andrade@mail.com",
    phone: "+1 415 331 7789", dob: "1975-12-08", bloodType: "A+",
    insurance: "Meridian Health", condition: "Psoriasis treatment",
    note: "Plaque psoriasis · topical corticosteroid taper in progress.",
    primaryDoctorId: "d7", registeredAt: -154, hue: 6,
  },
  {
    id: "p08", name: "Felix Wren", email: "felix.wren@mail.com",
    phone: "+1 628 220 4517", dob: "1996-05-17", bloodType: "B−",
    insurance: "Aurelia Prime", condition: "Annual wellness program",
    note: "Preventive care · quarterly wellness questionnaire not yet issued.",
    primaryDoctorId: "d1", registeredAt: -121, hue: 96,
  },
  {
    id: "p09", name: "Beatrice Hollis", email: "beatrice.hollis@mail.com",
    phone: "+1 510 887 2310", dob: "1952-03-06", bloodType: "O+",
    insurance: "Aurelia Prime", condition: "Valve disease monitoring",
    note: "Mild mitral regurgitation · echo results under cardiology review.",
    primaryDoctorId: "d2", registeredAt: -98, hue: 260,
  },
  {
    id: "p10", name: "Leon Vidal", email: "leon.vidal@mail.com",
    phone: "+1 415 556 9023", dob: "1982-08-25", bloodType: "A+",
    insurance: "Meridian Health", condition: "Thyroid nodule follow-up",
    note: "TIRADS-3 nodule · levothyroxine refill authorization awaited.",
    primaryDoctorId: "d3", registeredAt: -74, hue: 38,
  },
  {
    id: "p11", name: "Cora Ellison", email: "cora.ellison@mail.com",
    phone: "+1 650 902 4471", dob: "1993-10-12", bloodType: "O−",
    insurance: "Aurelia Prime", condition: "ACL recovery",
    note: "Post-reconstruction week 14 · inflammation markers ordered, history form pending.",
    primaryDoctorId: "d6", registeredAt: -56, hue: 288,
  },
  {
    id: "p12", name: "Ravi Menon", email: "ravi.menon@mail.com",
    phone: "+1 628 774 1185", dob: "1970-06-01", bloodType: "B+",
    insurance: "Meridian Health", condition: "Sleep study review",
    note: "Insomnia review · cortisol bloodwork pending, physio course active.",
    primaryDoctorId: "d5", registeredAt: -33, hue: 210,
  },
  {
    id: "p13", name: "Greta Lindholm", email: "greta.lindholm@mail.com",
    phone: "+1 415 209 7734", dob: "1948-02-27", bloodType: "A−",
    insurance: "Aurelia Prime", condition: "Pre-operative clearance",
    note: "Knee replacement scheduled · consent form not yet sent by physician.",
    primaryDoctorId: "d1", registeredAt: -18, hue: 350,
  },
  {
    id: "p14", name: "Sebastian Marlowe", email: "sebastian.marlowe@mail.com",
    phone: "+1 510 331 9066", dob: "1986-12-15", bloodType: "AB−",
    insurance: "Meridian Health", condition: "Skin cancer screening",
    note: "Total body photography plan · vitamin D order sent, awaiting patient.",
    primaryDoctorId: "d7", registeredAt: -7, hue: 12,
  },
];

const SERVICES: Service[] = [
  { id: "svc-mri", name: "MRI Scan", tagline: "3T full-body magnetic resonance imaging", price: 1450, icon: "mri" },
  { id: "svc-xray", name: "X-Ray Imaging", tagline: "Digital radiography with same-day reads", price: 320, icon: "xray" },
  { id: "svc-ultrasound", name: "Ultrasound", tagline: "High-resolution sonography & Doppler", price: 480, icon: "ultrasound" },
  { id: "svc-ct", name: "CT Scan", tagline: "Low-dose computed tomography", price: 980, icon: "ct" },
  { id: "svc-cardio", name: "Cardiology Consult", tagline: "ECG, stress testing & heart health", price: 520, icon: "cardio" },
  { id: "svc-blood", name: "Blood Panel", tagline: "Comprehensive laboratory screening", price: 260, icon: "blood" },
  { id: "svc-physio", name: "Physical Therapy", tagline: "One-to-one rehabilitation sessions", price: 180, icon: "physio" },
  { id: "svc-derm", name: "Dermatology Review", tagline: "Full-body skin mapping & biopsy", price: 410, icon: "derm" },
];

interface AppointmentSeed {
  patientId: string;
  doctorId: string;
  serviceId: string;
  day: number;
  time: string;
  status: AppointmentStatus;
}

const APPOINTMENT_SEEDS: AppointmentSeed[] = [
  { patientId: "p01", doctorId: "d1", serviceId: "svc-blood", day: -12, time: "09:15", status: "completed" },
  { patientId: "p02", doctorId: "d2", serviceId: "svc-cardio", day: -11, time: "10:00", status: "completed" },
  { patientId: "p03", doctorId: "d3", serviceId: "svc-blood", day: -10, time: "11:30", status: "completed" },
  { patientId: "p04", doctorId: "d4", serviceId: "svc-xray", day: -9, time: "14:00", status: "completed" },
  { patientId: "p05", doctorId: "d4", serviceId: "svc-mri", day: -8, time: "09:45", status: "completed" },
  { patientId: "p06", doctorId: "d7", serviceId: "svc-derm", day: -7, time: "13:15", status: "completed" },
  { patientId: "p06", doctorId: "d8", serviceId: "svc-ct", day: -6, time: "15:30", status: "completed" },
  { patientId: "p07", doctorId: "d7", serviceId: "svc-ultrasound", day: -5, time: "10:20", status: "completed" },
  { patientId: "p08", doctorId: "d1", serviceId: "svc-blood", day: -4, time: "11:00", status: "completed" },
  { patientId: "p09", doctorId: "d2", serviceId: "svc-cardio", day: -3, time: "09:30", status: "completed" },
  { patientId: "p10", doctorId: "d3", serviceId: "svc-physio", day: -2, time: "14:45", status: "completed" },
  { patientId: "p11", doctorId: "d4", serviceId: "svc-xray", day: -1, time: "10:10", status: "completed" },
  { patientId: "p12", doctorId: "d3", serviceId: "svc-blood", day: -1, time: "16:00", status: "completed" },
  { patientId: "p13", doctorId: "d5", serviceId: "svc-ct", day: 0, time: "09:00", status: "confirmed" },
  { patientId: "p01", doctorId: "d1", serviceId: "svc-ultrasound", day: 0, time: "09:40", status: "in-progress" },
  { patientId: "p06", doctorId: "d8", serviceId: "svc-blood", day: 0, time: "10:20", status: "confirmed" },
  { patientId: "p03", doctorId: "d3", serviceId: "svc-blood", day: 0, time: "11:00", status: "confirmed" },
  { patientId: "p04", doctorId: "d6", serviceId: "svc-xray", day: 0, time: "11:40", status: "confirmed" },
  { patientId: "p05", doctorId: "d6", serviceId: "svc-physio", day: 0, time: "13:00", status: "confirmed" },
  { patientId: "p06", doctorId: "d5", serviceId: "svc-mri", day: 0, time: "14:30", status: "confirmed" },
  { patientId: "p07", doctorId: "d8", serviceId: "svc-ct", day: 0, time: "15:10", status: "confirmed" },
  { patientId: "p08", doctorId: "d7", serviceId: "svc-derm", day: 1, time: "09:30", status: "confirmed" },
  { patientId: "p09", doctorId: "d1", serviceId: "svc-ultrasound", day: 1, time: "11:15", status: "confirmed" },
  { patientId: "p10", doctorId: "d3", serviceId: "svc-blood", day: 2, time: "10:00", status: "confirmed" },
  { patientId: "p11", doctorId: "d3", serviceId: "svc-ultrasound", day: 3, time: "14:20", status: "confirmed" },
  { patientId: "p12", doctorId: "d6", serviceId: "svc-physio", day: 4, time: "09:50", status: "confirmed" },
  { patientId: "p13", doctorId: "d5", serviceId: "svc-blood", day: 5, time: "15:40", status: "confirmed" },
  { patientId: "p14", doctorId: "d4", serviceId: "svc-mri", day: 6, time: "10:30", status: "confirmed" },
  { patientId: "p01", doctorId: "d1", serviceId: "svc-blood", day: 8, time: "11:10", status: "confirmed" },
  { patientId: "p02", doctorId: "d2", serviceId: "svc-ultrasound", day: 10, time: "13:30", status: "confirmed" },
  { patientId: "p03", doctorId: "d3", serviceId: "svc-blood", day: 12, time: "09:20", status: "confirmed" },
  { patientId: "p04", doctorId: "d6", serviceId: "svc-ct", day: 14, time: "15:00", status: "confirmed" },
];

interface ItemSeed {
  appointmentIndex: number;
  kind: ItemKind;
  label: string;
  status: ItemStatus;
}

const ITEM_SEEDS: ItemSeed[] = [
  // – Not sent by doctor (7)
  { appointmentIndex: 13, kind: "checklist", label: "Pre-procedure consent form", status: "not-sent" },
  { appointmentIndex: 14, kind: "checklist", label: "Medication reconciliation list", status: "not-sent" },
  { appointmentIndex: 21, kind: "prescription", label: "Prednisolone 20mg taper", status: "not-sent" },
  { appointmentIndex: 22, kind: "checklist", label: "Quarterly wellness questionnaire", status: "not-sent" },
  { appointmentIndex: 24, kind: "lab", label: "Inflammation marker panel order", status: "not-sent" },
  { appointmentIndex: 26, kind: "prescription", label: "Zolpidem prescription review", status: "not-sent" },
  { appointmentIndex: 1, kind: "prescription", label: "Amiodarone course", status: "not-sent" },
  // – Awaiting patient response (7)
  { appointmentIndex: 15, kind: "checklist", label: "Asthma control journal", status: "sent" },
  { appointmentIndex: 16, kind: "lab", label: "HbA1c retest order", status: "sent" },
  { appointmentIndex: 19, kind: "checklist", label: "Pre-MRI safety questionnaire", status: "sent" },
  { appointmentIndex: 23, kind: "prescription", label: "Levothyroxine refill authorization", status: "sent" },
  { appointmentIndex: 25, kind: "checklist", label: "Injury history form", status: "sent" },
  { appointmentIndex: 27, kind: "lab", label: "Vitamin D level order", status: "sent" },
  { appointmentIndex: 2, kind: "checklist", label: "Glucose log review", status: "sent" },
  // – Results pending (6)
  { appointmentIndex: 3, kind: "lab", label: "Chest X-ray read", status: "pending-results" },
  { appointmentIndex: 4, kind: "lab", label: "MRI radiologist report", status: "pending-results" },
  { appointmentIndex: 9, kind: "lab", label: "Echocardiogram results", status: "pending-results" },
  { appointmentIndex: 11, kind: "lab", label: "Wrist X-ray comparison", status: "pending-results" },
  { appointmentIndex: 6, kind: "lab", label: "CT chest scan read", status: "pending-results" },
  { appointmentIndex: 12, kind: "lab", label: "Cortisol blood work", status: "pending-results" },
  // – Closed (8)
  { appointmentIndex: 0, kind: "checklist", label: "Annual wellness review", status: "closed" },
  { appointmentIndex: 5, kind: "lab", label: "Allergen patch test", status: "closed" },
  { appointmentIndex: 7, kind: "prescription", label: "Topical corticosteroid renewal", status: "closed" },
  { appointmentIndex: 8, kind: "checklist", label: "Hypertension monitoring plan", status: "closed" },
  { appointmentIndex: 10, kind: "prescription", label: "Iron supplement protocol", status: "closed" },
  { appointmentIndex: 1, kind: "lab", label: "CBC + lipid panel", status: "closed" },
  { appointmentIndex: 13, kind: "lab", label: "Pre-operative blood work", status: "closed" },
  { appointmentIndex: 17, kind: "checklist", label: "Rotator cuff intake questionnaire", status: "closed" },
];

interface BookingSeed {
  patientId: string;
  doctorId: string;
  serviceId: string;
  day: number;
  time: string;
  status: BookingStatus;
}

const BOOKING_SEEDS: BookingSeed[] = [
  { patientId: "p05", doctorId: "d4", serviceId: "svc-mri", day: -9, time: "09:30", status: "completed" },
  { patientId: "p04", doctorId: "d4", serviceId: "svc-xray", day: -8, time: "10:15", status: "completed" },
  { patientId: "p08", doctorId: "d1", serviceId: "svc-blood", day: -7, time: "08:45", status: "completed" },
  { patientId: "p09", doctorId: "d4", serviceId: "svc-mri", day: -6, time: "11:00", status: "pending-results" },
  { patientId: "p02", doctorId: "d4", serviceId: "svc-ct", day: -6, time: "13:30", status: "completed" },
  { patientId: "p12", doctorId: "d4", serviceId: "svc-ultrasound", day: -5, time: "09:20", status: "completed" },
  { patientId: "p01", doctorId: "d2", serviceId: "svc-cardio", day: -5, time: "15:00", status: "completed" },
  { patientId: "p11", doctorId: "d4", serviceId: "svc-xray", day: -4, time: "10:40", status: "pending-results" },
  { patientId: "p01", doctorId: "d1", serviceId: "svc-blood", day: -4, time: "08:15", status: "completed" },
  { patientId: "p13", doctorId: "d6", serviceId: "svc-physio", day: -3, time: "14:00", status: "completed" },
  { patientId: "p10", doctorId: "d4", serviceId: "svc-mri", day: -3, time: "12:30", status: "pending-results" },
  { patientId: "p07", doctorId: "d7", serviceId: "svc-derm", day: -2, time: "16:20", status: "completed" },
  { patientId: "p05", doctorId: "d4", serviceId: "svc-ultrasound", day: -2, time: "09:50", status: "pending-results" },
  { patientId: "p06", doctorId: "d1", serviceId: "svc-blood", day: -1, time: "08:30", status: "pending-results" },
  { patientId: "p09", doctorId: "d2", serviceId: "svc-cardio", day: -1, time: "11:20", status: "completed" },
  { patientId: "p03", doctorId: "d4", serviceId: "svc-ct", day: 0, time: "09:00", status: "confirmed" },
  { patientId: "p06", doctorId: "d4", serviceId: "svc-mri", day: 0, time: "10:30", status: "confirmed" },
  { patientId: "p05", doctorId: "d4", serviceId: "svc-xray", day: 0, time: "11:45", status: "confirmed" },
  { patientId: "p02", doctorId: "d1", serviceId: "svc-blood", day: 0, time: "08:20", status: "confirmed" },
  { patientId: "p12", doctorId: "d4", serviceId: "svc-ultrasound", day: 1, time: "13:40", status: "confirmed" },
  { patientId: "p08", doctorId: "d7", serviceId: "svc-derm", day: 1, time: "15:10", status: "confirmed" },
  { patientId: "p10", doctorId: "d6", serviceId: "svc-physio", day: 2, time: "10:00", status: "confirmed" },
  { patientId: "p01", doctorId: "d4", serviceId: "svc-mri", day: 3, time: "09:30", status: "confirmed" },
  { patientId: "p07", doctorId: "d2", serviceId: "svc-cardio", day: 4, time: "14:50", status: "confirmed" },
  { patientId: "p13", doctorId: "d1", serviceId: "svc-blood", day: 5, time: "08:40", status: "confirmed" },
  { patientId: "p11", doctorId: "d4", serviceId: "svc-ct", day: 6, time: "12:10", status: "confirmed" },
  { patientId: "p04", doctorId: "d4", serviceId: "svc-xray", day: 8, time: "09:15", status: "confirmed" },
  { patientId: "p01", doctorId: "d4", serviceId: "svc-ultrasound", day: 9, time: "11:35", status: "confirmed" },
  { patientId: "p09", doctorId: "d7", serviceId: "svc-derm", day: 11, time: "16:00", status: "confirmed" },
  { patientId: "p05", doctorId: "d4", serviceId: "svc-mri", day: 13, time: "10:20", status: "confirmed" },
  { patientId: "p12", doctorId: "d6", serviceId: "svc-physio", day: 14, time: "15:30", status: "confirmed" },
  { patientId: "p01", doctorId: "d1", serviceId: "svc-blood", day: -6, time: "08:25", status: "cancelled" },
  { patientId: "p03", doctorId: "d2", serviceId: "svc-cardio", day: 7, time: "14:15", status: "cancelled" },
];

export function buildMockData(anchor: string): MockData {
  const patients: Patient[] = PATIENT_SEEDS.map((seed) => ({
    ...seed,
    registeredAt: addDays(anchor, seed.registeredAt),
  }));

  const appointments: Appointment[] = APPOINTMENT_SEEDS.map((seed, index) => ({
    id: `a${index + 1}`,
    patientId: seed.patientId,
    doctorId: seed.doctorId,
    serviceId: seed.serviceId,
    date: addDays(anchor, seed.day),
    time: seed.time,
    status: seed.status,
  }));

  const items: ComplianceItem[] = ITEM_SEEDS.map((seed, index) => ({
    id: `ci${index + 1}`,
    appointmentId: `a${seed.appointmentIndex + 1}`,
    kind: seed.kind,
    label: seed.label,
    status: seed.status,
  }));

  const bookings: Booking[] = BOOKING_SEEDS.map((seed, index) => ({
    id: `b${index + 1}`,
    patientId: seed.patientId,
    doctorId: seed.doctorId,
    serviceId: seed.serviceId,
    date: addDays(anchor, seed.day),
    time: seed.time,
    status: seed.status,
  }));

  return {
    anchor,
    patients,
    doctors: DOCTORS,
    services: SERVICES,
    appointments,
    items,
    bookings,
  };
}
