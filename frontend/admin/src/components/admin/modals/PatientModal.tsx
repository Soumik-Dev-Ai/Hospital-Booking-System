"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ComplianceItem, MockData, Patient } from "@/lib/mock";
import {
  APPT_STATUS_META,
  BOOKING_STATUS_META,
  STATUS_META,
  itemsForPatient,
  summarizeItems,
} from "@/lib/mock";
import {
  ageFromDob,
  formatDate,
  formatShort,
  relativeDay,
} from "@/lib/utils";
import { ModalShell } from "../ui/ModalShell";
import { TiltGlass } from "../ui/TiltGlass";
import {
  CheckCircleIcon,
  CloseIcon,
  DropletIcon,
  KindIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
} from "../ui/icons";
import { Avatar, Kicker, StatusBadge } from "../ui/primitives";

export function PatientModal({
  patient,
  data,
  items,
  onClose,
}: {
  patient: Patient | null;
  data: MockData;
  items: ComplianceItem[];
  onClose: () => void;
}) {
  return (
    <ModalShell open={patient !== null} onClose={onClose} width="max-w-3xl">
      {patient && (
        <PatientModalInner
          patient={patient}
          data={data}
          items={items}
          onClose={onClose}
        />
      )}
    </ModalShell>
  );
}

function PatientModalInner({
  patient,
  data,
  items,
  onClose,
}: {
  patient: Patient;
  data: MockData;
  items: ComplianceItem[];
  onClose: () => void;
}) {
  const primaryDoctor = data.doctors.find((d) => d.id === patient.primaryDoctorId);

  const appointments = useMemo(
    () =>
      data.appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) =>
          a.date === b.date
            ? a.time.localeCompare(b.time)
            : a.date < b.date
              ? 1
              : -1
        ),
    [data.appointments, patient.id]
  );

  const bookings = useMemo(
    () =>
      data.bookings
        .filter((b) => b.patientId === patient.id)
        .sort((a, b) =>
          a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? 1 : -1
        ),
    [data.bookings, patient.id]
  );

  const patientItems = itemsForPatient(items, patient.id, data.appointments);
  const summary = summarizeItems(patientItems);
  const openItems = patientItems.filter((i) => i.status !== "closed");

  const doctorById = new Map(data.doctors.map((d) => [d.id, d]));
  const serviceById = new Map(data.services.map((s) => [s.id, s]));
  const age = ageFromDob(patient.dob, data.anchor);

  return (
    <TiltGlass className="rounded-[32px]">
        <div
          className="relative flex max-h-[88vh] flex-col overflow-hidden rounded-[32px] border border-white/60 shadow-[0_60px_140px_-40px_rgba(13,29,22,0.6)]"
          style={{ transform: "translateZ(24px)" }}
        >
          {/* Header */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-forest-900 via-forest-800 to-forest-600 px-6 py-5 text-white sm:px-7">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -left-14 -top-16 h-56 w-56 rounded-full bg-forest-400/25 blur-[70px]" />
              <div className="absolute -bottom-20 right-1/4 h-48 w-48 rounded-full bg-alabaster-300/15 blur-[60px]" />
            </div>
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={patient.name} hue={patient.hue} size={56} />
                <div>
                  <Kicker className="text-forest-200/90">Patient record</Kicker>
                  <h2 className="mt-0.5 font-display text-2xl font-semibold leading-tight sm:text-[27px]">
                    {patient.name}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-forest-100/90">
                    {patient.condition}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
                Member since {formatDate(patient.registeredAt)}
              </span>
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
                {primaryDoctor?.name ?? "Unassigned"}
              </span>
              {summary.open > 0 && (
                <span className="rounded-full bg-warn-500/85 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
                  ⚠ {summary.open} open compliance {summary.open === 1 ? "item" : "items"}
                </span>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="scroll-slim relative min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <p className="rounded-2xl border border-forest-600/15 bg-forest-600/5 px-4 py-3 text-[13px] leading-relaxed text-forest-800">
              {patient.note}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {/* Identity */}
              <div className="rounded-3xl border border-white/70 bg-white/55 p-4">
                <Kicker className="text-[10px]">Identity & coverage</Kicker>
                <ul className="mt-3 space-y-3">
                  <InfoRow
                    icon={<span className="font-display text-sm font-semibold text-forest-600">•</span>}
                    label="Date of birth"
                    value={`${formatDate(patient.dob)} · ${age} yrs`}
                  />
                  <InfoRow
                    icon={<DropletIcon className="h-4 w-4 text-forest-600" />}
                    label="Blood type"
                    value={patient.bloodType}
                  />
                  <InfoRow
                    icon={<ShieldIcon className="h-4 w-4 text-forest-600" />}
                    label="Insurance"
                    value={patient.insurance}
                  />
                  <InfoRow
                    icon={<MailIcon className="h-4 w-4 text-forest-600" />}
                    label="Email"
                    value={patient.email}
                  />
                  <InfoRow
                    icon={<PhoneIcon className="h-4 w-4 text-forest-600" />}
                    label="Phone"
                    value={patient.phone}
                  />
                </ul>
              </div>

              {/* Compliance */}
              <div className="rounded-3xl border border-white/70 bg-white/55 p-4">
                <Kicker className="text-[10px]">Compliance snapshot</Kicker>
                {summary.open === 0 ? (
                  <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-forest-600/20 bg-forest-600/8 px-4 py-3.5">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-forest-500" />
                    <p className="text-sm font-semibold text-forest-800">
                      All compliance items closed
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summary.notSent > 0 && (
                        <StatusBadge tone="amber">{summary.notSent} not sent</StatusBadge>
                      )}
                      {summary.awaiting > 0 && (
                        <StatusBadge tone="amber">{summary.awaiting} awaiting patient</StatusBadge>
                      )}
                      {summary.pendingResults > 0 && (
                        <StatusBadge tone="amber">{summary.pendingResults} results pending</StatusBadge>
                      )}
                      {summary.closed > 0 && (
                        <StatusBadge tone="green">{summary.closed} closed</StatusBadge>
                      )}
                    </div>
                    <ul className="mt-3 space-y-2">
                      {openItems.slice(0, 5).map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white/50 px-3 py-2 text-[13px]"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-ink-900">
                            <KindIcon kind={item.kind} className="h-3.5 w-3.5 shrink-0 text-warn-600" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-warn-700">
                            {STATUS_META[item.status].label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {/* Appointment history */}
            <div className="mt-4 rounded-3xl border border-white/70 bg-white/55 p-4">
              <div className="flex items-baseline justify-between">
                <Kicker className="text-[10px]">Appointment history</Kicker>
                <span className="text-xs text-ink-400">{appointments.length} total</span>
              </div>
              <div className="mt-3 space-y-2">
                {appointments.length === 0 && (
                  <p className="py-3 text-center text-[13px] text-ink-500">
                    No appointments on record.
                  </p>
                )}
                {appointments.slice(0, 5).map((a, i) => {
                  const meta = APPT_STATUS_META[a.status];
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/45 px-3.5 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="font-display text-sm font-semibold text-forest-800">
                          {a.time}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-forest-900">
                            {serviceById.get(a.serviceId)?.name ?? "–"}
                          </p>
                          <p className="truncate text-[11px] text-ink-500">
                            {doctorById.get(a.doctorId)?.name} · {relativeDay(a.date, data.anchor)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Recent bookings */}
            <div className="mt-4 rounded-3xl border border-white/70 bg-white/55 p-4">
              <div className="flex items-baseline justify-between">
                <Kicker className="text-[10px]">Service bookings</Kicker>
                <span className="text-xs text-ink-400">{bookings.length} total</span>
              </div>
              <div className="mt-3 space-y-2">
                {bookings.length === 0 && (
                  <p className="py-3 text-center text-[13px] text-ink-500">No bookings yet.</p>
                )}
                {bookings.slice(0, 4).map((b, i) => {
                  const meta = BOOKING_STATUS_META[b.status];
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/45 px-3.5 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-24 shrink-0 whitespace-nowrap text-[13px] font-medium text-forest-800">
                          {formatShort(b.date)} · {b.time}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-forest-900">
                            {serviceById.get(b.serviceId)?.name ?? "–"}
                          </p>
                          <p className="truncate text-[11px] text-ink-500">
                            {doctorById.get(b.doctorId)?.name} · Ref {b.id.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
    </TiltGlass>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-forest-600/8 text-forest-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">{label}</p>
        <p className="truncate text-[13px] font-medium text-forest-900">{value}</p>
      </div>
    </li>
  );
}
