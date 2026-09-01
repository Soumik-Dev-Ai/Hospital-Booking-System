import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import {
  clinicalServices,
  dayLabel,
  doctors,
  fullDate,
  generateSlotsForOffset,
  patient,
  type Appointment,
  type ClinicalService,
  type Doctor,
} from "../data/mock";
import Calendar3DPopup from "./Calendar3DPopup";
import { FilledStar, Icon } from "./Icons";
import { DrawCheck, Eyebrow, Medallion, Monogram, TiltCard } from "./ui";

interface Props {
  onBooked: (apt: Appointment) => void;
}

type Kind = "doctor" | "service" | null;
type Pending = { optionId: string; time: string } | null;

export default function BookingFlow({ onBooked }: Props) {
  const [kind, setKind] = useState<Kind>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
  const [dateOverrides, setDateOverrides] = useState<Record<string, number>>({});
  const [calendarFor, setCalendarFor] = useState<string | null>(null);

  const catalogue = kind === "doctor" ? doctors : kind === "service" ? clinicalServices : [];

  const pendingOption = useMemo(() => {
    if (!pending) return null;
    return catalogue.find((o) => o.id === pending.optionId) ?? null;
  }, [pending, catalogue]);

  /** Effective day offset for an option: user-chosen date, else the default. */
  const offsetFor = (option: Doctor | ClinicalService) =>
    dateOverrides[option.id] ?? option.dayOffset;

  /** Slot list for an option: generated for the chosen date, else the default. */
  const slotsFor = (option: Doctor | ClinicalService) =>
    dateOverrides[option.id] !== undefined
      ? generateSlotsForOffset(option.id, dateOverrides[option.id])
      : option.slots;

  function selectSlot(optionId: string, time: string) {
    setPending({ optionId, time });
  }

  function confirm() {
    if (!pendingOption || !pending) return;
    const isDoctor = kind === "doctor";
    const apt: Appointment = {
      id: `apt-${Date.now()}`,
      kind: isDoctor ? "consult" : "service",
      title: isDoctor
        ? `${(pendingOption as Doctor).dept} Consultation`
        : (pendingOption as ClinicalService).name,
      provider: isDoctor ? (pendingOption as Doctor).name : "Verdant Diagnostics",
      dept: pendingOption.dept,
      dayOffset: offsetFor(pendingOption),
      time: pending.time,
      duration: pendingOption.duration,
      location: isDoctor ? "In-clinic · Suite 12" : "Diagnostics Wing · Level 2",
      status: "confirmed",
      note: isDoctor
        ? "A nurse will call 24h before your visit to confirm."
        : (pendingOption as ClinicalService).prep,
    };
    setConfirmed(apt);
    setPending(null);
  }

  return (
    <div className="pb-28">
      {/* Heading */}
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-6"
      >
        <div>
          <Eyebrow tone="dark">Concierge desk</Eyebrow>
          <h1 className="mt-2.5 font-display text-4xl font-medium tracking-tight text-forest-950 md:text-5xl">
            Book an appointment
          </h1>
          <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-forest-600">
            {kind === null
              ? "Choose how you'd like to see us today. Every visit is private, unhurried and arranged around you."
              : `Step 2 of 2: pick a time that suits you, ${patient.firstName}. We'll hold it for 10 minutes.`}
          </p>
        </div>

        {/* Step indicator */}
        <div className="hidden items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500 md:flex">
          <StepDot active label="01 · Choose type" done={kind !== null} />
          <span className="h-px w-8 bg-forest-900/15" />
          <StepDot active={kind !== null} label="02 · Select time" done={false} />
        </div>
      </motion.header>

      {/* ------------------- Step 1 — choose type ------------------- */}
      <AnimatePresence mode="wait">
        {kind === null ? (
          <motion.div
            key="types"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 grid gap-5 md:grid-cols-2"
          >
            <TypeCard
              icon="stethoscope"
              title="Consult a doctor"
              desc="Private, in-depth consultations with our specialist physicians, never rushed, always thorough."
              chips={[`${doctors.length} specialists`, "From $200", "45 min visits"]}
              onClick={() => setKind("doctor")}
            />
            <TypeCard
              icon="flask"
              title="Book a clinical service"
              desc="Imaging, pathology and diagnostics in our in-house wing. Most results returned within 24 hours."
              chips={[`${clinicalServices.length} services`, "From $95", "Same-week slots"]}
              onClick={() => setKind("service")}
            />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="mt-1 flex items-center gap-2.5 text-[12.5px] font-medium text-forest-500 md:col-span-2"
            >
              <Icon name="phone" size={14} className="text-forest-400" />
              Prefer the concierge desk? {patient.concierge.name} is available 24/7 on{" "}
              <span className="font-semibold text-forest-700">{patient.concierge.phone}</span>
            </motion.p>
          </motion.div>
        ) : (
          /* ------------------- Step 2 — catalogue ------------------- */
          <motion.div
            key="catalogue"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8"
          >
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={() => {
                  setKind(null);
                  setOpenId(null);
                  setPending(null);
                }}
                className="flex items-center gap-2 rounded-full border border-forest-900/12 bg-alabaster-200/60 px-4 py-2 text-[12.5px] font-semibold text-forest-700 backdrop-blur-md transition-colors hover:bg-alabaster-100"
              >
                <Icon name="arrow-left" size={14} />
                Change type
              </button>
              <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-forest-400">
                {kind === "doctor" ? "Specialist physicians" : "Clinical services"}
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {catalogue.map((option, i) => {
                const isDoctor = kind === "doctor";
                const d = option as Doctor;
                const s = option as ClinicalService;
                const open = openId === option.id;
                return (
                  <motion.div
                    key={option.id}
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full"
                  >
                    <TiltCard className="group h-full">
                      <div className="flex h-full flex-col rounded-xl border border-white/70 bg-alabaster-200/60 shadow-[0_30px_70px_-34px_rgba(18,43,34,0.4)] backdrop-blur-xl">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setOpenId(open ? null : option.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenId(open ? null : option.id);
                            }
                          }}
                          className="cursor-pointer p-6 text-left outline-none focus-visible:ring-2 focus-visible:ring-forest-600/40"
                          style={{ transform: "translateZ(26px)" }}
                        >
                          <div className="flex items-start justify-between">
                            {isDoctor ? (
                              <Monogram initials={d.initials} />
                            ) : (
                              <Medallion icon={s.dept === "Imaging" ? "scan" : s.dept === "Cardiology" ? "activity" : s.dept === "Clinical Pathology" ? "droplet" : s.dept === "Immunology" ? "leaf" : "flask"} tone="champagne" size="lg" />
                            )}
                            {isDoctor && (
                              <span className="flex items-center gap-1.5 rounded-full bg-champagne-400/15 px-2.5 py-1 text-[11.5px] font-semibold text-champagne-600 ring-1 ring-champagne-500/25">
                                <FilledStar size={11} className="text-champagne-500" />
                                {d.rating.toFixed(1)}
                                <span className="font-medium text-champagne-600/60">({d.reviews})</span>
                              </span>
                            )}
                          </div>

                          <h3 className="mt-4 font-display text-[1.35rem] font-medium leading-tight text-forest-950">
                            {option.name}
                          </h3>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-400">
                            {option.dept}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] font-semibold">
                            <span className="rounded-full bg-forest-600/10 px-2.5 py-1 text-forest-700 ring-1 ring-forest-600/15">
                              {isDoctor ? `$${d.fee} · ${d.duration}` : `${s.duration}`}
                            </span>
                            {!isDoctor && (
                              <span className="rounded-full bg-forest-600/10 px-2.5 py-1 text-forest-700 ring-1 ring-forest-600/15">
                                ${s.fee}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCalendarFor(option.id);
                              }}
                              className="ml-auto flex items-center gap-1.5 rounded-full border border-forest-900/10 bg-alabaster-100/80 px-2.5 py-1 text-forest-600 transition-colors hover:border-forest-600/40 hover:text-forest-800"
                              aria-label={`Change date for ${option.name}`}
                            >
                              <Icon name="calendar" size={11} />
                              {dayLabel(offsetFor(option))}
                            </button>
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-forest-900/8 pt-3.5">
                            <span className="text-[12px] font-medium text-forest-500">
                              {open ? "Choose a time" : "View availability"}
                            </span>
                            <span className="grid h-7 w-7 place-items-center rounded-full border border-forest-900/10 bg-alabaster-100/70 text-forest-700 transition-transform duration-300 group-hover:bg-forest-800 group-hover:text-alabaster-100">
                              <Icon
                                name="chevron-down"
                                size={14}
                                className={cn("transition-transform duration-300", open && "rotate-180")}
                              />
                            </span>
                          </div>
                        </div>

                        {/* Slot picker */}
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              key="slots"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="rounded-b-xl border-t border-forest-900/8 bg-alabaster-50/70 p-6 pt-5">
                                <div className="flex items-baseline justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-[12px] font-semibold text-forest-700">
                                      {dayLabel(offsetFor(option))}, {fullDate(offsetFor(option))}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setCalendarFor(option.id)}
                                      className="flex items-center gap-1 rounded-full border border-forest-900/10 bg-alabaster-100/80 px-2 py-1 text-[10.5px] font-semibold text-forest-600 transition-colors hover:border-forest-600/40 hover:text-forest-800"
                                    >
                                      <Icon name="calendar" size={10} />
                                      Choose another date
                                    </button>
                                  </div>
                                  <span className="text-[10.5px] font-medium text-forest-400">
                                    {dateOverrides[option.id] !== undefined
                                      ? "Times refresh for the chosen date"
                                      : "Times shown in local time"}
                                  </span>
                                </div>
                                <div className="mt-3.5 grid grid-cols-3 gap-2">
                                  {slotsFor(option).map((slot) => {
                                    const selected =
                                      pending?.optionId === option.id && pending.time === slot.time;
                                    const full = slot.free === 0;
                                    return (
                                      <button
                                        key={slot.time}
                                        disabled={full}
                                        onClick={() => selectSlot(option.id, slot.time)}
                                        className={cn(
                                          "group/slot relative rounded-xl border px-2 py-2.5 text-center transition-all duration-300",
                                          full &&
                                            "cursor-not-allowed border-forest-900/5 bg-forest-900/[0.03] opacity-50",
                                          !full && !selected &&
                                            "border-forest-900/10 bg-alabaster-100/80 hover:-translate-y-0.5 hover:border-forest-600/40 hover:shadow-md",
                                          selected &&
                                            "border-forest-800 bg-forest-800 shadow-lg shadow-forest-900/30"
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "block text-[13.5px] font-bold",
                                            selected ? "text-alabaster-100" : "text-forest-900"
                                          )}
                                        >
                                          {slot.time}
                                        </span>
                                        <span
                                          className={cn(
                                            "mt-0.5 block text-[10px] font-semibold",
                                            full
                                              ? "text-forest-400 line-through"
                                              : selected
                                                ? "text-champagne-300"
                                                : slot.free === 1
                                                  ? "text-champagne-600"
                                                  : "text-forest-500"
                                          )}
                                        >
                                          {full ? "Full" : slot.free === 1 ? "1 slot left" : `${slot.free} slots free`}
                                        </span>
                                        {selected && (
                                          <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-champagne-400 text-forest-950 shadow"
                                          >
                                            <Icon name="check" size={11} strokeWidth={3} />
                                          </motion.span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                {!isDoctor && s.prep && (
                                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-champagne-400/10 px-3.5 py-2.5 text-[11.5px] font-medium leading-relaxed text-champagne-600 ring-1 ring-champagne-500/20">
                                    <Icon name="flask" size={13} className="mt-0.5 shrink-0" />
                                    {s.prep}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </TiltCard>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------- Confirm bar --------------------- */}
      <AnimatePresence>
        {pendingOption && pending && kind !== null && (
          <motion.div
            key="confirm"
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed inset-x-0 bottom-4 z-40 px-4 md:bottom-6"
          >
            <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-forest-900/90 px-5 py-4 text-alabaster-100 shadow-[0_30px_80px_-20px_rgba(10,30,23,0.8)] backdrop-blur-2xl">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-champagne-400/15 text-champagne-300 ring-1 ring-champagne-300/25">
                <Icon name="calendar" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {kind === "doctor"
                    ? `${(pendingOption as Doctor).name} · ${pendingOption.dept}`
                    : (pendingOption as ClinicalService).name}
                </div>
                <div className="mt-0.5 text-[11.5px] font-medium text-forest-100/70">
                  {dayLabel(offsetFor(pendingOption))}, {fullDate(offsetFor(pendingOption))} ·{" "}
                  {pending.time} · {pendingOption.duration}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPending(null)}
                  className="rounded-full border border-white/15 px-4 py-2.5 text-[12.5px] font-semibold text-forest-100/80 transition-colors hover:bg-alabaster-100/10"
                >
                  Clear
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={confirm}
                  className="rounded-full bg-champagne-400 px-5 py-2.5 text-[12.5px] font-bold text-forest-950 shadow-lg shadow-champagne-500/25 transition-colors hover:bg-champagne-300"
                >
                  Confirm booking
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------- Success modal --------------------- */}
      <AnimatePresence>
        {confirmed && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="fixed inset-0 z-[60] grid place-items-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onBooked(confirmed)}
              className="absolute inset-0 bg-forest-950/45 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.88, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-forest-800 to-forest-950 p-8 text-center text-alabaster-100 shadow-[0_60px_140px_-30px_rgba(10,30,23,0.9)] md:p-10"
            >
              <div className="grain pointer-events-none absolute inset-0 opacity-10 mix-blend-overlay" />
              <div className="pointer-events-none absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-champagne-400/20 blur-3xl" />

              <div className="relative mx-auto w-fit text-champagne-300">
                <DrawCheck size={64} />
              </div>
              <h3 className="relative mt-5 font-display text-3xl font-medium">You're booked</h3>
              <p className="relative mt-2 text-[13px] leading-relaxed text-forest-100/70">
                A confirmation has been sent to {patient.email}
              </p>

              <div className="relative mt-6 space-y-2.5 rounded-2xl border border-white/10 bg-alabaster-100/[0.06] p-5 text-left backdrop-blur-md">
                <InfoRow label="Visit" value={confirmed.title} />
                <InfoRow
                  label="When"
                  value={`${dayLabel(confirmed.dayOffset)}, ${fullDate(confirmed.dayOffset)} · ${confirmed.time}`}
                />
                <InfoRow label="With" value={confirmed.provider} />
                <InfoRow label="Where" value={confirmed.location} />
              </div>

              <div className="relative mt-7 flex flex-col gap-2.5">
                <button
                  onClick={() => onBooked(confirmed)}
                  className="w-full rounded-full bg-champagne-400 py-3 text-[13.5px] font-bold text-forest-950 shadow-lg shadow-champagne-500/20 transition-colors hover:bg-champagne-300"
                >
                  Back to my appointments
                </button>
                <button
                  onClick={() => setConfirmed(null)}
                  className="w-full rounded-full border border-white/15 py-3 text-[13px] font-semibold text-forest-100/80 transition-colors hover:bg-alabaster-100/10"
                >
                  Book another
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --------------------- 3D date picker --------------------- */}
      <Calendar3DPopup
        open={calendarFor !== null}
        optionId={calendarFor ?? ""}
        initialOffset={
          calendarFor
            ? dateOverrides[calendarFor] ??
              catalogue.find((o) => o.id === calendarFor)?.dayOffset ??
              0
            : 0
        }
        onSelect={(offset) => {
          if (calendarFor) {
            setDateOverrides((m) => ({ ...m, [calendarFor]: offset }));
            setOpenId(calendarFor);
          }
          setCalendarFor(null);
        }}
        onClose={() => setCalendarFor(null)}
      />
    </div>
  );
}

/* ----------------------------- Pieces ----------------------------- */

function TypeCard({
  icon,
  title,
  desc,
  chips,
  onClick,
}: {
  icon: "stethoscope" | "flask";
  title: string;
  desc: string;
  chips: string[];
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-white/70 bg-alabaster-200/55 p-7 text-left shadow-[0_30px_70px_-36px_rgba(18,43,34,0.4)] backdrop-blur-xl transition-colors duration-300 hover:border-champagne-400/50 md:p-9"
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-forest-200/40 blur-3xl transition-all duration-500 group-hover:bg-champagne-300/50" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Medallion icon={icon} tone="forest" size="lg" />
          <span className="grid h-10 w-10 place-items-center rounded-full border border-forest-900/10 bg-alabaster-100/70 text-forest-700 transition-all duration-300 group-hover:translate-x-1 group-hover:bg-forest-800 group-hover:text-alabaster-100">
            <Icon name="arrow-right" size={16} />
          </span>
        </div>
        <h3 className="mt-6 font-display text-[1.7rem] font-medium leading-tight text-forest-950">
          {title}
        </h3>
        <p className="mt-2.5 max-w-sm text-[13.5px] leading-relaxed text-forest-600">{desc}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-forest-600/8 px-3 py-1.5 text-[11px] font-semibold text-forest-700 ring-1 ring-forest-600/15"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  );
}

function StepDot({ active, label, done }: { active: boolean; label: string; done: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 transition-colors duration-300", active && "text-forest-700")}>
      <span
        className={cn(
          "grid h-5 w-5 place-items-center rounded-full border text-[9px] font-bold transition-all duration-300",
          active
            ? "border-forest-700 bg-forest-700 text-alabaster-100"
            : "border-forest-900/20 bg-alabaster-200/60 text-forest-400"
        )}
      >
        {done ? <Icon name="check" size={10} strokeWidth={3} /> : active ? "▏" : ""}
      </span>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-100/50">
        {label}
      </span>
      <span className="text-right text-[13px] font-semibold text-alabaster-100">{value}</span>
    </div>
  );
}
