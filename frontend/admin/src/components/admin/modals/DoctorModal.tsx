"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { ComplianceItem, Doctor, MockData } from "@/lib/mock";
import {
  APPT_STATUS_META,
  STATUS_META,
  itemsForAppointment,
} from "@/lib/mock";
import { addDays, cn, formatDate, formatShort } from "@/lib/utils";
import { ModalShell } from "../ui/ModalShell";
import { TiltGlass } from "../ui/TiltGlass";
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  KindIcon,
} from "../ui/icons";
import { Avatar, Kicker, StatusBadge } from "../ui/primitives";

export function DoctorModal({
  doctor,
  data,
  items,
  onClose,
}: {
  doctor: Doctor | null;
  data: MockData;
  items: ComplianceItem[];
  onClose: () => void;
}) {
  return (
    <ModalShell open={doctor !== null} onClose={onClose} width="max-w-3xl">
      {doctor && (
        <DoctorModalInner
          doctor={doctor}
          data={data}
          items={items}
          onClose={onClose}
        />
      )}
    </ModalShell>
  );
}

function DoctorModalInner({
  doctor,
  data,
  items,
  onClose,
}: {
  doctor: Doctor;
  data: MockData;
  items: ComplianceItem[];
  onClose: () => void;
}) {
  const [date, setDate] = useState<string>(data.anchor);

  const appts = useMemo(() => {
    return data.appointments
      .filter((a) => a.doctorId === doctor.id && a.status !== "cancelled")
      .sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1
      );
  }, [data, doctor.id]);

  const future = appts.filter((a) => a.date > date);
  const present = appts.filter((a) => a.date === date);
  const previous = appts.filter((a) => a.date < date).reverse();

  const openCount = appts.reduce(
    (sum, a) =>
      sum + itemsForAppointment(items, a.id).filter((i) => i.status !== "closed").length,
    0
  );

  const patientById = new Map(data.patients.map((p) => [p.id, p]));
  const serviceById = new Map(data.services.map((s) => [s.id, s]));

  const presets = [
    { label: "Yesterday", iso: addDays(data.anchor, -1) },
    { label: "Today", iso: data.anchor },
    { label: "Tomorrow", iso: addDays(data.anchor, 1) },
  ];

  return (
    <TiltGlass className="rounded-[32px]">
      <div
        className="relative flex max-h-[88vh] flex-col overflow-hidden rounded-[32px] border border-white/60 shadow-[0_60px_140px_-40px_rgba(13,29,22,0.6)]"
        style={{ transform: "translateZ(28px)" }}
      >
        {/* Forest header */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-forest-900 via-forest-800 to-forest-600 px-6 py-5 text-white sm:px-7">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-forest-400/25 blur-[70px]" />
              <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-alabaster-300/15 blur-[60px]" />
            </div>
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={doctor.name} hue={doctor.hue} size={56} />
                <div>
                  <Kicker className="text-forest-200/90">Physician profile</Kicker>
                  <h2 className="mt-0.5 font-display text-2xl font-semibold leading-tight sm:text-[27px]">
                    {doctor.name}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-forest-100/90">
                    {doctor.specialty} · {doctor.room}
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
                {appts.length} appointments on file
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur",
                  openCount > 0 ? "bg-warn-500/85 text-white" : "bg-white/12 text-white"
                )}
              >
                {openCount > 0
                  ? `⚠ ${openCount} compliance ${openCount === 1 ? "item" : "items"} not closed`
                  : "All compliance closed"}
              </span>
              <span className="rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
                {present.length} today
              </span>
            </div>
          </div>

          {/* Date filter row */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/60 bg-white/50 px-6 py-3 sm:px-7">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
              Viewing
            </span>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setDate(preset.iso)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  date === preset.iso
                    ? "bg-forest-800 text-alabaster-50 shadow-md shadow-forest-900/20"
                    : "bg-white/60 text-forest-700 hover:bg-white/90"
                )}
              >
                {preset.label}
              </button>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-xs font-semibold text-forest-800 transition-colors hover:bg-white/90">
              <CalendarIcon className="h-3.5 w-3.5 text-forest-600" />
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="date-native max-w-[110px] bg-transparent outline-none"
              />
            </label>
            <span className="ml-auto hidden text-xs text-ink-400 sm:block">
              {formatDate(date)}
            </span>
          </div>

          {/* Scrollable sections */}
          <div className="scroll-slim relative min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
            <Section
              title="Future"
              sub={`${future.length} scheduled after ${formatShort(date)}`}
            >
              {future.length === 0 && <EmptyNote text="Nothing scheduled beyond this date." />}
              {future.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  items={items}
                  patient={patientById.get(a.patientId)}
                  service={serviceById.get(a.serviceId)}
                  index={future.indexOf(a)}
                />
              ))}
            </Section>

            <Section
              title="Present"
              sub={
                date === data.anchor
                  ? `Today · ${formatDate(date)}`
                  : `Selected day · ${formatDate(date)}`
              }
              accent="amber"
            >
              {present.length === 0 && <EmptyNote text="No appointments on this day." />}
              {present.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  items={items}
                  patient={patientById.get(a.patientId)}
                  service={serviceById.get(a.serviceId)}
                  index={present.indexOf(a)}
                  highlight
                />
              ))}
            </Section>

            <Section
              title="Previous"
              sub={`${previous.length} already seen before ${formatShort(date)}`}
            >
              {previous.length === 0 && <EmptyNote text="No earlier appointments to show." />}
              {previous.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  items={items}
                  patient={patientById.get(a.patientId)}
                  service={serviceById.get(a.serviceId)}
                  index={previous.indexOf(a)}
                />
              ))}
            </Section>
          </div>
      </div>
    </TiltGlass>
  );
}

/* ––––– Section ––––– */

function Section({
  title,
  sub,
  accent,
  children,
}: {
  title: string;
  sub: string;
  accent?: "amber";
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2.5">
        {accent === "amber" && (
          <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full bg-warn-500" />
        )}
        <h4 className="font-display text-lg font-semibold text-forest-900">{title}</h4>
        <span className="text-xs text-ink-400">{sub}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-forest-600/20 bg-white/30 px-4 py-4 text-center text-[13px] text-ink-500">
      {text}
    </p>
  );
}

/* ––––– Appointment card with compliance block ––––– */

function AppointmentCard({
  appt,
  items,
  patient,
  service,
  index,
  highlight,
}: {
  appt: MockData["appointments"][number];
  items: ComplianceItem[];
  patient?: MockData["patients"][number];
  service?: MockData["services"][number];
  index: number;
  highlight?: boolean;
}) {
  const apptItems = itemsForAppointment(items, appt.id);
  const openItems = apptItems.filter((i) => i.status !== "closed");
  const statusMeta = APPT_STATUS_META[appt.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 + index * 0.04, type: "spring", stiffness: 320, damping: 30 }}
      className={cn(
        "rounded-2xl border p-4",
        highlight
          ? "border-warn-500/25 bg-warn-500/[0.06]"
          : "border-white/70 bg-white/55"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-14 shrink-0">
            <p className="font-display text-[17px] font-semibold leading-none text-forest-900">
              {appt.time}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {formatShort(appt.date)}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-forest-900">{patient?.name ?? "–"}</p>
            <p className="text-xs text-ink-500">{service?.name ?? "–"}</p>
          </div>
        </div>
        <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
      </div>

      {apptItems.length === 0 ? (
        <p className="mt-3 text-xs text-ink-400">No compliance items attached to this appointment.</p>
      ) : openItems.length > 0 ? (
        <div className="mt-3 rounded-xl border border-warn-500/30 bg-warn-500/10 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-warn-700">
            <AlertIcon className="h-3.5 w-3.5" />
            {openItems.length} compliance {openItems.length === 1 ? "item" : "items"} not closed
          </p>
          <ul className="mt-2 space-y-1.5">
            {openItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2 text-ink-900">
                  <KindIcon kind={item.kind} className="h-3.5 w-3.5 shrink-0 text-warn-600" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 font-semibold text-warn-700">
                  {STATUS_META[item.status].label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-forest-600">
          <CheckIcon className="h-3.5 w-3.5" />
          {apptItems.length} compliance {apptItems.length === 1 ? "item" : "items"} · all closed
        </p>
      )}
    </motion.div>
  );
}
