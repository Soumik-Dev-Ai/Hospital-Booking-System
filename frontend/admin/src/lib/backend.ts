import { apiFetch } from "./api";
import type { MockData, Doctor } from "./mock";

export async function loadAdminData(fallback: MockData): Promise<MockData> {
  const get = <T,>(path: string) => apiFetch<T>(path).catch(() => null);

  const [patients, doctors, appointments, items, bookings] = await Promise.all([
    get<any[]>("/api/patients"),
    get<any[]>("/api/admin/doctors"),
    get<any[]>("/api/appointments"),
    get<any[]>("/api/v1/admin/patients/compliance"),
    get<any[]>("/api/v1/service-records")
  ]);

  const normalizedDoctors: Doctor[] = doctors && Array.isArray(doctors) && doctors.length > 0
    ? doctors.map((d: any, idx: number) => ({
        id: String(d.id),
        name: d.name || d.full_name || "Doctor",
        specialty: d.specialty || "General Medicine",
        room: d.room || `Consultation Suite ${idx + 1}`,
        hue: typeof d.hue === "number" ? d.hue : (140 + idx * 37) % 360,
      }))
    : fallback.doctors;

  return {
    ...fallback,
    patients: patients && Array.isArray(patients) && patients.length ? patients : fallback.patients,
    doctors: normalizedDoctors,
    appointments: appointments && Array.isArray(appointments) && appointments.length ? appointments : fallback.appointments,
    items: items && Array.isArray(items) && items.length ? items : fallback.items,
    bookings: bookings && Array.isArray(bookings) && bookings.length ? bookings : fallback.bookings,
  };
}
