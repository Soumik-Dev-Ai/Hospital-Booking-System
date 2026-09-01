import { motion } from "framer-motion";
import { cn } from "../utils/cn";
import {
  dayLabel,
  fullDate,
  greeting,
  patient,
  type Appointment,
} from "../data/mock";
import { Icon } from "./Icons";
import {
  Eyebrow,
  Medallion,
  SectionHeading,
  StatusChip,
  fadeUp,
  staggerContainer,
} from "./ui";

export interface HubStats {
  next: Appointment | undefined;
  openChecklists: number;
  prescriptions: number;
}

interface Props {
  appointments: Appointment[];
  stats: HubStats;
  highlightId: string | null;
  onBook: () => void;
  onRecords: () => void;
  onViewPrescription: (rxId: string) => void;
  onViewRecord: (recId: string) => void;
}

export default function AppointmentsHub({
  appointments,
  stats,
  highlightId,
  onBook,
  onRecords,
  onViewPrescription,
  onViewRecord,
}: Props) {
  const upcoming = appointments
    .filter((a) => a.status === "confirmed")
    .sort((a, b) => a.dayOffset - b.dayOffset);

  const past = appointments
    .filter((a) => a.status === "completed")
    .sort((a, b) => b.dayOffset - a.dayOffset);

  return (
    <div className="pb-10">
      {/* ------------------------- Hero ------------------------- */}
      <motion.section
        initial={{ opacity: 0, y: 34, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-forest-900 via-forest-800 to-forest-950 text-alabaster-100 shadow-[0_40px_90px_-40px_rgba(10,30,23,0.65)] ring-1 ring-white/10 md:rounded-2xl"
      >
        {/* Aurora + decor */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-forest-500/35 blur-3xl" />
          <div className="absolute -bottom-36 -left-24 h-96 w-96 rounded-full bg-champagne-500/15 blur-3xl" />
          <div className="absolute right-1/3 top-8 h-44 w-44 rounded-full bg-forest-300/20 blur-2xl" />
          <div className="grain absolute inset-0 opacity-[0.14] mix-blend-overlay" />
          <svg className="absolute -right-12 -top-12 h-72 w-72 text-champagne-300/15" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="49" stroke="currentColor" strokeWidth="0.35" />
            <circle cx="50" cy="50" r="39" stroke="currentColor" strokeWidth="0.35" />
            <circle cx="50" cy="50" r="29" stroke="currentColor" strokeWidth="0.35" />
          </svg>
        </div>

        <div className="relative grid gap-10 p-7 md:p-12 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
          {/* Left – greeting */}
          <div className="flex flex-col justify-center">
            <Eyebrow tone="light">
              Member since {patient.memberSince} · {patient.plan}
            </Eyebrow>
            <h1 className="mt-5 font-display text-[2.6rem] font-medium leading-[1.04] tracking-tight md:text-6xl">
              {greeting()},{" "}
              <em className="italic text-champagne-300">{patient.firstName}.</em>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-forest-100/80">
              Your care team is standing by. You have{" "}
              <span className="font-semibold text-alabaster-100">{upcoming.length} upcoming</span>{" "}
              {upcoming.length === 1 ? "appointment" : "appointments"} on the calendar. Here's
              how the week looks.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onBook}
                className="group relative overflow-hidden rounded-full bg-alabaster-100 px-5 py-3 text-[13px] font-semibold text-forest-900 shadow-xl shadow-forest-950/30 transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
              >
                <span className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-champagne-300/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-sheen" />
                <span className="relative z-10 flex items-center gap-2">
                  <Icon name="plus" size={14} strokeWidth={2.2} />
                  Book an appointment
                </span>
              </button>
              <button
                onClick={onRecords}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-alabaster-100/5 px-5 py-3 text-[13px] font-semibold text-alabaster-100/90 backdrop-blur-md transition-all duration-300 hover:border-white/30 hover:bg-alabaster-100/10"
              >
                Browse records
                <Icon name="arrow-right" size={14} className="transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Right – stat stack */}
          <div className="grid content-center gap-3">
            <StatCard
              icon="calendar"
              label="Next appointment"
              value={stats.next ? dayLabel(stats.next.dayOffset) : "–"}
              sub={stats.next ? `${stats.next.time} · ${stats.next.provider}` : "Nothing scheduled"}
              onClick={onRecords}
              index={0}
            />
            <StatCard
              icon="list"
              label="Open intake checklists"
              value={String(stats.openChecklists)}
              sub={stats.openChecklists ? "due before your next visit" : "All intake forms complete"}
              onClick={onRecords}
              index={1}
            />
            <StatCard
              icon="pill"
              label="Active prescriptions"
              value={String(stats.prescriptions)}
              sub="View & download in records"
              onClick={onRecords}
              index={2}
            />
          </div>
        </div>
      </motion.section>

      {/* --------------------- Upcoming --------------------- */}
      <section className="mt-16">
        <SectionHeading
          eyebrow="Schedule"
          title="Upcoming appointments"
          right={
            <span className="inline-flex items-center gap-2 rounded-full border border-forest-900/10 bg-alabaster-200/60 px-3.5 py-1.5 text-[11.5px] font-semibold text-forest-700 shadow-sm backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
              {upcoming.length} upcoming
            </span>
          }
        />

        {upcoming.length === 0 ? (
          <EmptyCalendar onBook={onBook} />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-4 md:grid-cols-2"
          >
            {upcoming.map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} isNew={highlightId === apt.id} />
            ))}
          </motion.div>
        )}
      </section>

      {/* ---------------------- History ---------------------- */}
      {past.length > 0 && (
        <section className="mt-16">
          <SectionHeading
            eyebrow="History"
            title="Past appointments"
            right={
              <span className="inline-flex items-center gap-2 rounded-full border border-forest-900/10 bg-alabaster-200/60 px-3.5 py-1.5 text-[11.5px] font-semibold text-forest-700 shadow-sm backdrop-blur-md">
                {past.length} completed
              </span>
            }
          />
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="relative ml-3 space-y-3.5 border-l border-forest-900/10 pl-7 md:ml-5"
          >
            {past.map((apt) => (
              <PastRow
                key={apt.id}
                apt={apt}
                onViewPrescription={onViewPrescription}
                onViewRecord={onViewRecord}
              />
            ))}
          </motion.div>
        </section>
      )}
    </div>
  );
}

/* ---------------------------- Pieces ---------------------------- */

function StatCard({
  icon,
  label,
  value,
  sub,
  onClick,
  index,
}: {
  icon: "calendar" | "list" | "pill";
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: 26 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.25 + index * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-alabaster-100/[0.07] p-4 text-left backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-alabaster-100/[0.12] md:p-5"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-champagne-400/10 text-champagne-300 ring-1 ring-champagne-300/20 transition-transform duration-300 group-hover:scale-110">
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-forest-100/60">
          {label}
        </div>
        <div className="mt-1 truncate font-display text-xl text-alabaster-100">{value}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-forest-100/65">{sub}</div>
      </div>
      <Icon
        name="arrow-right"
        size={15}
        className="ml-auto shrink-0 text-forest-100/40 transition-all duration-300 group-hover:translate-x-1 group-hover:text-champagne-300"
      />
    </motion.button>
  );
}

function AppointmentCard({ apt, isNew }: { apt: Appointment; isNew: boolean }) {
  const date = dayLabel(apt.dayOffset);
  const dayNum = new Date();
  dayNum.setDate(dayNum.getDate() + apt.dayOffset);

  return (
    <motion.article
      variants={fadeUp}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/60 bg-alabaster-200/55 p-6 shadow-[0_24px_60px_-32px_rgba(18,43,34,0.35)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_36px_70px_-32px_rgba(18,43,34,0.45)]",
        isNew && "animate-glow-pulse ring-2 ring-champagne-400/50"
      )}
    >
      {/* hairline accent */}
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-champagne-400/70 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Medallion icon={apt.kind === "consult" ? "stethoscope" : "flask"} tone={apt.kind === "consult" ? "forest" : "champagne"} />
          <div>
            <h3 className="font-display text-[1.2rem] font-medium leading-snug text-forest-950">
              {apt.title}
            </h3>
            <p className="mt-0.5 text-[12.5px] font-medium text-forest-600">
              {apt.provider} <span className="text-forest-400">·</span> {apt.dept}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {isNew && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 18 }}
            >
              <StatusChip tone="champagne" icon="clock">Just booked</StatusChip>
            </motion.span>
          )}
          <StatusChip tone="green" icon="check">Confirmed</StatusChip>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="rounded-xl border border-forest-900/10 bg-alabaster-100/90 px-3.5 py-2 text-center shadow-sm">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-forest-500">
            {date}
          </div>
          <div className="mt-0.5 font-display text-[1.35rem] leading-none text-forest-900">
            {dayNum.getDate()}
          </div>
          <div className="mt-0.5 text-[9.5px] font-medium text-forest-500">
            {fullDate(apt.dayOffset).split(" ")[0].slice(0, 3)}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-forest-600/10 px-2.5 py-1 text-[11.5px] font-semibold text-forest-700 ring-1 ring-forest-600/20">
            <Icon name="clock" size={11} /> {apt.time} · {apt.duration}
          </span>
          <span className="inline-flex w-fit items-center gap-1.5 text-[11.5px] font-medium text-forest-500">
            <Icon name="pin" size={12} /> {apt.location}
          </span>
        </div>
      </div>

      {apt.note && (
        <p className="mt-4 border-t border-forest-900/8 pt-3.5 text-[12.5px] italic leading-relaxed text-forest-600">
          {apt.note}
        </p>
      )}
    </motion.article>
  );
}

function PastRow({
  apt,
  onViewPrescription,
  onViewRecord,
}: {
  apt: Appointment;
  onViewPrescription: (rxId: string) => void;
  onViewRecord: (recId: string) => void;
}) {
  return (
    <motion.div variants={fadeUp} className="relative">
      <span className="absolute -left-[31px] top-5 h-2.5 w-2.5 rounded-full bg-forest-400 ring-4 ring-forest-400/15 md:-left-[36px]" />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-alabaster-200/45 px-5 py-4 backdrop-blur-xl transition-all duration-300 hover:bg-alabaster-200/70">
        <div className="min-w-0">
          <h4 className="text-[14.5px] font-semibold text-forest-950">{apt.title}</h4>
          <p className="mt-0.5 text-[12px] font-medium text-forest-500">
            {apt.provider} · {fullDate(apt.dayOffset)} · {apt.time}
          </p>
          {apt.note && (
            <p className="mt-1 hidden text-[11.5px] italic text-forest-400 sm:block">{apt.note}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {apt.recordId && (
            <button
              onClick={() => onViewRecord(apt.recordId!)}
              className="flex items-center gap-1.5 rounded-full border border-forest-900/12 bg-alabaster-200/60 px-3 py-1.5 text-[11.5px] font-semibold text-forest-700 transition-all duration-300 hover:bg-forest-800 hover:text-alabaster-100"
            >
              <Icon name="file" size={11} strokeWidth={2} />
              View record
            </button>
          )}
          {apt.prescriptionId && (
            <button
              onClick={() => onViewPrescription(apt.prescriptionId!)}
              className="flex items-center gap-1.5 rounded-full border border-champagne-500/30 bg-champagne-400/15 px-3 py-1.5 text-[11.5px] font-semibold text-champagne-600 transition-all duration-300 hover:bg-champagne-400 hover:text-forest-950"
            >
              <Icon name="pill" size={11} strokeWidth={2} />
              View prescription
            </button>
          )}
          <StatusChip tone="green" icon="check">Completed</StatusChip>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyCalendar({ onBook }: { onBook: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-dashed border-forest-900/20 bg-alabaster-200/40 px-8 py-16 text-center backdrop-blur-xl"
    >
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-forest-100 to-forest-200 text-forest-700 shadow-lg ring-1 ring-forest-800/10">
        <Icon name="calendar" size={24} strokeWidth={1.4} />
      </div>
      <h3 className="mt-6 font-display text-2xl text-forest-950">Your calendar is clear</h3>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-forest-500">
        No upcoming visits are scheduled. Your care team is one call away whenever you'd like to
        see us.
      </p>
      <button
        onClick={onBook}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-forest-800 px-6 py-3 text-[13px] font-semibold text-alabaster-100 shadow-lg shadow-forest-900/25 transition-transform duration-300 hover:scale-[1.03]"
      >
        <Icon name="plus" size={14} strokeWidth={2.2} />
        Book an appointment
      </button>
    </motion.div>
  );
}
