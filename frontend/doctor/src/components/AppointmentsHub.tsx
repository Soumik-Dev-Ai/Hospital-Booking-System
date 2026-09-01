import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CalendarClock,
  CalendarX2,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  RotateCcw,
  ScanLine,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import { useWorkspace } from "../lib/store";
import {
  assessCompliance,
  fmtDayNum,
  fmtLong,
  fmtWeekdayShort,
  sortAppointments,
  todayKey,
  yesterdayKey,
  type Appointment,
  type Patient,
} from "../lib/mock";
import { Avatar, Pill, SectionLabel, StatusPill } from "./ui";
import { cn } from "../utils/cn";

/* --------------------------- type meta --------------------------- */

const TYPE_ICONS: Record<Appointment["type"], typeof Stethoscope> = {
  Consultation: Stethoscope,
  "Follow-up": HeartPulse,
  Review: Activity,
  Diagnostics: ScanLine,
};

type Flag = "ck" | "rx" | null;

function visitMeta(p: Patient, a: Appointment) {
  return `${p.gender} · ${p.age} yrs · ${a.type}`;
}

/* --------------------------- component --------------------------- */

export default function AppointmentsHub({
  onOpen,
}: {
  onOpen: (patient: Patient, appointment: Appointment) => void;
}) {
  const { doctor, patients, appointments, checklists, prescriptions } =
    useWorkspace();

  const [query, setQuery] = useState("");
  const [day, setDay] = useState<string | "all">("all");
  const [flag, setFlag] = useState<Flag>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  /* "/" focuses the ledger search – command desk shortcut */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[data-modal="open"]')) return;
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (e.key === "/" && !["input", "textarea", "select"].includes(tag)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const railDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 8; i++) days.push(dateKeyFromToday(i));
    return days;
  }, []);

  const stats = useMemo(() => {
    const todayCount = appointments.filter(
      (a) => a.date === todayKey && a.status !== "cancelled"
    ).length;
    let ckAttention = 0;
    let rxAttention = 0;
    for (const p of patients) {
      const c = checklists.find((x) => x.patientId === p.id);
      const rx = prescriptions.find((x) => x.patientId === p.id);
      const appts = appointments.filter(
        (a) => a.patientId === p.id && a.status !== "cancelled"
      );
      for (const a of appts) {
        const { ck, rx: rxK } = assessCompliance(a.status, c, rx);
        if (ck === "missing" || ck === "pending") ckAttention++;
        if (rxK === "missing") rxAttention++;
        break;
      }
    }
    return { todayCount, ckAttention, rxAttention };
  }, [appointments, checklists, patients, prescriptions]);

  const filtered = useMemo(() => {
    let list = sortAppointments(appointments);
    if (day !== "all") list = list.filter((a) => a.date === day);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const p = patients.find((x) => x.id === a.patientId);
        if (!p) return false;
        return (
          p.name.toLowerCase().includes(q) ||
          p.conditions.some((c) => c.toLowerCase().includes(q)) ||
          a.type.toLowerCase().includes(q)
        );
      });
    }
    if (flag) {
      list = list.filter((a) => {
        const c = checklists.find((x) => x.patientId === a.patientId);
        const rx = prescriptions.find((x) => x.patientId === a.patientId);
        const { ck, rx: rxK } = assessCompliance(a.status, c, rx);
        return flag === "ck"
          ? ck === "missing" || ck === "pending"
          : rxK === "missing";
      });
    }
    return list;
  }, [appointments, checklists, day, flag, prescriptions, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const arr = map.get(a.date) ?? [];
      arr.push(a);
      map.set(a.date, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const todayLabel = fmtLong(todayKey);

  return (
    <div className="space-y-7">
      {/* ------- hero ------- */}
      <header>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 text-[10.5px] font-semibold tracking-[0.3em] text-gold-soft/90 uppercase"
        >
          <span className="h-px w-9 bg-gold/50" />
          Doctor Workspace · Hub 01
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 font-display text-4xl tracking-tight text-alabaster sm:text-5xl"
        >
          Schedule <em className="text-gold-soft italic">Command</em>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2.5 max-w-md text-sm leading-relaxed text-sage"
        >
          {doctor.name} · Neurology – {todayLabel}. Every visit, checklist and
          prescription across your ledger at a glance.
        </motion.p>
      </header>

      {/* ------- search command bar · between header & stats ------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        className="glass flex items-center gap-3 rounded-2xl px-3.5 py-2 transition-colors duration-300 hover:border-white/20 focus-within:border-gold/40 sm:gap-4 sm:px-4"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold-soft">
          <Search size={16} />
        </span>
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the ledger – patient, condition, visit type…"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-alabaster placeholder:text-sage-dim/70 outline-none"
        />
        {!query && (
          <span className="hidden shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-[0.2em] text-sage-dim uppercase sm:flex">
            <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-sans text-[9px] tracking-normal text-sage">
              /
            </kbd>
            to search
          </span>
        )}
        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              onClick={() => setQuery("")}
              className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full border border-white/10 text-sage-dim transition hover:border-white/25 hover:text-alabaster"
              aria-label="Clear search"
            >
              <X size={13} />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ------- attention stats ------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap gap-3"
      >
        <StatChip
          icon={<CalendarClock size={16} />}
          tone="mint"
          value={stats.todayCount}
          label="Visits today"
          active={flag === null && day === todayKey}
          onClick={() => {
            setDay(todayKey);
            setFlag(null);
          }}
        />
        <StatChip
          icon={<ClipboardList size={16} />}
          tone="amber"
          value={stats.ckAttention}
          label="Checklists pending"
          active={flag === "ck"}
          onClick={() => {
            setFlag(flag === "ck" ? null : "ck");
            setDay("all");
          }}
        />
        <StatChip
          icon={<FileText size={16} />}
          tone="crimson"
          value={stats.rxAttention}
          label="Prescriptions missing"
          active={flag === "rx"}
          onClick={() => {
            setFlag(flag === "rx" ? null : "rx");
            setDay("all");
          }}
        />
        <div className="ml-auto hidden items-center gap-2 text-[11px] text-sage-dim md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-gold/60" />
          Tap a chip to triage your ledger
        </div>
      </motion.div>

      {/* ------- date rail ------- */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        <DateChip
          label="All"
          sub="days"
          active={day === "all"}
          onClick={() => setDay("all")}
        />
        {railDays.map((key) => (
          <DateChip
            key={key}
            label={key === todayKey ? "Today" : key === yesterdayKey ? "Yest." : fmtWeekdayShort(key)}
            sub={String(fmtDayNum(key))}
            active={day === key}
            onClick={() => setDay(key)}
          />
        ))}
      </motion.div>

      {/* ------- grouped list ------- */}
      <div className="space-y-9">
        <AnimatePresence mode="popLayout" initial={false}>
          {groups.map(([date, list]) => (
            <motion.section
              key={date}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-2.5"
            >
              <div className="flex items-center gap-4 pt-1">
                <h2 className="font-display text-lg text-alabaster">
                  {date === todayKey
                    ? "Today"
                    : date === yesterdayKey
                      ? "Yesterday"
                      : fmtLong(date)}
                </h2>
                <span className="hairline flex-1" />
                <span className="text-[10px] font-semibold tracking-[0.22em] text-sage-dim uppercase">
                  {list.length} visit{list.length === 1 ? "" : "s"}
                </span>
              </div>
              <AnimatePresence mode="popLayout" initial={false}>
                {list.map((a) => {
                  const p = patients.find((x) => x.id === a.patientId);
                  if (!p) return null;
                  return (
                    <AppointmentRow
                      key={a.id}
                      patient={p}
                      appointment={a}
                      onOpen={onOpen}
                    />
                  );
                })}
              </AnimatePresence>
            </motion.section>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass mx-auto max-w-md rounded-3xl p-10 text-center"
          >
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-sage">
              <CalendarX2 size={22} />
            </span>
            <h3 className="mt-5 font-display text-xl text-alabaster">
              A clear ledger
            </h3>
            <p className="mt-2 text-sm text-sage">
              No appointments match this view – nothing here requires your
              attention right now.
            </p>
            <button
              onClick={() => {
                setDay("all");
                setQuery("");
                setFlag(null);
              }}
              className="btn-ghost mt-6 px-4 py-2 text-xs"
            >
              <RotateCcw size={13} />
              Reset all filters
            </button>
          </motion.div>
        )}
      </div>

      <SectionLabel>Ledger complete · {filtered.length} entries in view</SectionLabel>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function dateKeyFromToday(offset: number) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function StatChip({
  icon,
  tone,
  value,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  tone: "mint" | "amber" | "crimson";
  value: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    mint: "border-mint/25 bg-mint/10 text-mint",
    amber: "border-amber/30 bg-amber/10 text-amber",
    crimson: "border-crimson/30 bg-crimson/10 text-crimson",
  };
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={cn(
        "glass flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-300",
        active
          ? "border-gold/45 bg-gold/[0.08] shadow-[0_0_0_1px_rgba(210,174,116,0.25)]"
          : "hover:border-white/20"
      )}
    >
      <span className={cn("grid h-9 w-9 place-items-center rounded-xl border", tones[tone])}>
        {icon}
      </span>
      <span>
        <span className="block font-display text-xl leading-none text-alabaster">
          {value}
        </span>
        <span className="mt-1 block text-[9.5px] font-semibold tracking-[0.18em] text-sage-dim uppercase">
          {label}
        </span>
      </span>
    </motion.button>
  );
}

function DateChip({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex min-w-[62px] shrink-0 cursor-pointer flex-col items-center rounded-2xl border px-4 py-2.5 transition-colors duration-300",
        active
          ? "border-white/20 text-alabaster"
          : "border-white/[0.08] bg-white/[0.02] text-sage hover:border-white/20 hover:text-alabaster"
      )}
    >
      {active && (
        <motion.span
          layoutId="day-pill"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(245,242,234,0.12)]"
        />
      )}
      <span className="relative text-[9.5px] font-semibold tracking-[0.18em] uppercase">
        {label}
      </span>
      <span
        className={cn(
          "relative font-display text-base leading-tight",
          active ? "text-gold-soft" : "text-alabaster/80"
        )}
      >
        {sub}
      </span>
    </button>
  );
}

function AppointmentRow({
  patient,
  appointment,
  onOpen,
}: {
  patient: Patient;
  appointment: Appointment;
  onOpen: (p: Patient, a: Appointment) => void;
}) {
  const { checklists, prescriptions } = useWorkspace();
  const checklist = checklists.find((c) => c.patientId === patient.id);
  const prescription = prescriptions.find((p) => p.patientId === patient.id);
  const { ck, rx } = assessCompliance(appointment.status, checklist, prescription);
  const cancelled = appointment.status === "cancelled";
  const TypeIcon = TYPE_ICONS[appointment.type];

  return (
    <motion.button
      layout
      layoutId={`patient-card-${appointment.id}`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      whileHover={{ y: -3 }}
      onClick={() => onOpen(patient, appointment)}
      className={cn(
        "glass group relative w-full cursor-pointer rounded-2xl p-4 text-left transition-colors duration-300 sm:p-5",
        cancelled ? "opacity-45" : "hover:border-white/20"
      )}
    >
      <div className="flex items-center gap-4 sm:gap-5">
        {/* time chip */}
        <div
          className={cn(
            "flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2",
            "border-white/[0.08] bg-forest-900/60"
          )}
        >
          <span
            className={cn(
              "text-[13px] font-semibold tabular-nums text-alabaster",
              cancelled && "line-through opacity-60"
            )}
          >
            {appointment.time}
          </span>
          <span className="mt-0.5 text-[8.5px] font-semibold tracking-[0.14em] text-sage-dim uppercase">
            {appointment.duration}m
          </span>
        </div>

        <Avatar name={patient.name} hue={patient.hue} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[17px] leading-snug text-alabaster">
              {patient.name}
            </span>
            <span className="hidden items-center gap-1.5 md:flex">
              {ck === "missing" && (
                <Pill tone="crimson" icon={<ClipboardList size={10} />}>
                  Checklist due
                </Pill>
              )}
              {ck === "pending" && (
                <Pill tone="amber" icon={<ClipboardList size={10} />}>
                  Awaiting patient
                </Pill>
              )}
              {rx === "missing" && (
                <Pill tone="crimson" icon={<FileText size={10} />}>
                  Rx missing
                </Pill>
              )}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-sage">
            <TypeIcon size={12} className="text-sage-dim" />
            <span className="truncate">{visitMeta(patient, appointment)}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden sm:block">
            <StatusPill status={appointment.status} />
          </span>
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border transition-all duration-300",
              "border-white/10 text-sage-dim",
              "group-hover:translate-x-0.5 group-hover:border-gold/40 group-hover:text-gold-soft"
            )}
          >
            <ChevronRight size={15} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
