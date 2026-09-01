import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Droplets,
  FileText,
  Info,
  Mail,
  Phone,
  ShieldCheck,
UploadCloud,
  X,
} from "lucide-react";
import { useWorkspace } from "../lib/store";
import {
  assessCompliance,
  fmtIssued,
  fmtLong,
  fmtShort,
  fmtTimeAgo,
  nextAppointment,
  type Appointment,
  type Checklist,
  type ComplianceKind,
  type Patient,
  type Prescription,
} from "../lib/mock";
import { Avatar, Field, IconTile, Pill, SectionLabel, StatusPill } from "./ui";
import { cn } from "../utils/cn";

/* ================================================================== */
/*  3D PATIENT POP-OUT                                                */
/* ================================================================== */

export default function PatientModal({
  patient,
  appointment,
  onClose,
  onAction,
}: {
  patient: Patient;
  appointment: Appointment;
  onClose: () => void;
  onAction: (mode: "prescription" | "checklist", patientId: string) => void;
}) {
  const { checklists, prescriptions, appointments, doctor } = useWorkspace();

  const checklist = checklists.find((c) => c.patientId === patient.id);
  const prescription = prescriptions.find((p) => p.patientId === patient.id);
  const { ck, rx } = assessCompliance(appointment.status, checklist, prescription);
  const next = nextAppointment(appointments, patient.id, appointment.id);

  /* esc + scroll lock */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /* pointer tilt */
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [6.5, -6.5]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-6.5, 6.5]), {
    stiffness: 140,
    damping: 18,
  });

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const resetTilt = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <motion.div
      data-modal="open"
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* backdrop */}
      <motion.div
        className="fixed inset-0 bg-forest-950/72 backdrop-blur-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
      />

      <div className="relative flex min-h-full items-center justify-center px-4 py-10 sm:px-8">
        {/* rotating halo */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(210,174,116,0.14),rgba(62,122,95,0.12),rgba(142,211,176,0.1),rgba(210,174,116,0.14))] blur-[90px] animate-spin-slower" />
        </div>

        {/* morph wrapper – animates from the appointment row */}
        <motion.div
          layoutId={`patient-card-${appointment.id}`}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="relative w-full max-w-4xl"
          style={{ perspective: 1500 }}
        >
          {/* entrance */}
          <motion.div
            initial={{ rotateX: 16, y: 90, scale: 0.94, opacity: 0 }}
            animate={{ rotateX: 0, y: 0, scale: 1, opacity: 1 }}
            exit={{ rotateX: 12, y: 70, scale: 0.95, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 26,
              delay: 0.04,
            }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* tilt */}
            <motion.div
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              onPointerMove={onPointerMove}
              onPointerLeave={resetTilt}
              className="glass-strong relative rounded-[1.75rem] shadow-[0_70px_140px_-40px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]"
            >
              {/* shimmer sweep */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]">
                <div className="absolute inset-y-0 w-1/3 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.07),transparent)] animate-shimmer" />
              </div>

              {/* ---------------- header band ---------------- */}
              <div
                className="relative flex flex-col gap-5 border-b border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-transparent p-6 sm:p-8"
                style={{ transform: "translateZ(28px)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 sm:gap-5">
                    <Avatar name={patient.name} hue={patient.hue} size="xl" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h2 className="font-display text-3xl tracking-tight text-alabaster sm:text-4xl">
                          {patient.name}
                        </h2>
                        <Pill tone="sage" className="hidden sm:inline-flex">
                          {patient.id}
                        </Pill>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Pill>{patient.gender}</Pill>
                        <Pill>{patient.age} years</Pill>
                        <Pill>Blood {patient.blood}</Pill>
                        <Pill>{patient.insurance}</Pill>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ rotate: 90, scale: 1.05 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={onClose}
                    className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/12 bg-white/[0.05] text-sage transition-colors hover:border-white/25 hover:text-alabaster"
                    aria-label="Close patient file"
                  >
                    <X size={17} />
                  </motion.button>
                </div>
              </div>

              {/* ---------------- body ---------------- */}
              <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-5">
                {/* ---- left · profile ---- */}
                <div className="space-y-5 lg:col-span-2">
                  <SectionLabel>Patient Profile</SectionLabel>

                  <div className="glass-inset space-y-3.5 rounded-2xl p-4">
                    <Field icon={<Droplets size={14} />} label="Blood group" value={patient.blood} />
                    <Field icon={<Phone size={14} />} label="Contact" value={patient.phone} />
                    <Field icon={<Mail size={14} />} label="Email" value={patient.email} />
                    <Field icon={<ShieldCheck size={14} />} label="Coverage" value={patient.insurance} />
                  </div>

                  <div>
                    <div className="field-label">Active conditions</div>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.conditions.map((c) => (
                        <Pill key={c} tone="gold">
                          {c}
                        </Pill>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="field-label">Allergies</div>
                    {patient.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {patient.allergies.map((a) => (
                          <Pill key={a} tone="crimson">
                            {a}
                          </Pill>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-sage-dim">
                        None recorded
                      </p>
                    )}
                  </div>

                  <p className="text-[11px] leading-relaxed text-sage-dim">
                    Member since {patient.memberSince} · Managed by{" "}
                    <span className="text-sage">{doctor.name}</span>
                  </p>
                </div>

                {/* ---- right · visit + compliance ---- */}
                <div className="space-y-5 lg:col-span-3">
                  <SectionLabel>Current Visit</SectionLabel>

                  <div className="glass rounded-2xl p-5">
                    <div className="flex flex-wrap items-center gap-4">
                      <IconTile tone="gold">
                        <Clock size={16} />
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-xl text-alabaster">
                          {appointment.type}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-sage">
                          <Clock size={11} />
                          {fmtLong(appointment.date)} · {appointment.time} ·{" "}
                          {appointment.duration} minutes
                        </div>
                      </div>
                      <StatusPill status={appointment.status} />
                    </div>

                    {appointment.notes && (
                      <p className="mt-4 border-l-2 border-gold/40 pl-3 text-[13px] leading-relaxed text-sage italic">
                        {appointment.notes}
                      </p>
                    )}

                    {/* quick document links */}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                      <QuickLink
                        icon={<ClipboardList size={12} />}
                        label="View checklist"
                        disabled={!checklist}
                        onClick={() => scrollToCard("ck-card")}
                      />
                      <QuickLink
                        icon={<FileText size={12} />}
                        label="View prescription"
                        disabled={!prescription}
                        onClick={() => scrollToCard("rx-card")}
                      />
                      <span className="ml-auto self-center text-[10px] tracking-[0.18em] text-sage-dim uppercase">
                        File · Live
                      </span>
                    </div>
                  </div>

                  {/* next appointment */}
                  <div className="glass flex items-center justify-between gap-4 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <IconTile tone="sage" className="h-9 w-9">
                        <CalendarClock size={15} />
                      </IconTile>
                      <div>
                        <div className="text-[9.5px] font-semibold tracking-[0.22em] text-sage-dim uppercase">
                          Next appointment
                        </div>
                        {next ? (
                          <div className="font-display text-[15px] text-alabaster">
                            {next.type} · {next.time} · {fmtShort(next.date)}
                          </div>
                        ) : (
                          <div className="text-[13px] text-sage-dim">
                            Nothing further scheduled
                          </div>
                        )}
                      </div>
                    </div>
                    {next && (
                      <span className="flex items-center gap-1 text-xs text-gold-soft">
                        Confirmed <ArrowRight size={13} />
                      </span>
                    )}
                  </div>

                  <SectionLabel>Documents & Compliance</SectionLabel>

                  <ChecklistCard
                    id="ck-card"
                    kind={ck}
                    checklist={checklist}
                    onAction={() => onAction("checklist", patient.id)}
                  />
                  <PrescriptionCard
                    id="rx-card"
                    kind={rx}
                    prescription={prescription}
                    onAction={() => onAction("prescription", patient.id)}
                  />
                </div>
              </div>

              {/* ---------------- footer ---------------- */}
              <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-b-[1.75rem] border-t border-white/[0.07] bg-forest-950/30 px-6 py-4 sm:px-8">
                <span className="text-[10.5px] tracking-[0.2em] text-sage-dim uppercase">
                  File {patient.id} · Ref {appointment.id}
                </span>
                <span className="flex items-center gap-2 text-[10.5px] tracking-[0.18em] text-mint-dim uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint animate-pulse-ring" />
                  Records synced
                </span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* --------------------------- smart cards --------------------------- */

function scrollToCard(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function QuickLink({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-300",
        disabled
          ? "cursor-not-allowed border-white/[0.07] text-sage-dim/60"
          : "cursor-pointer border-white/12 text-sage hover:border-gold/40 hover:text-gold-soft"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusCardShell({
  id,
  tone,
  icon,
  title,
  badge,
  children,
}: {
  id: string;
  tone: "mint" | "amber" | "crimson" | "sage";
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones = {
    mint: "border-mint/25 bg-mint/[0.06]",
    amber: "border-amber/30 bg-amber/[0.07]",
    crimson: "border-crimson/30 bg-crimson/[0.07]",
    sage: "border-white/[0.09] bg-white/[0.03]",
  };
  return (
    <motion.div
      id={id}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn("relative rounded-2xl border p-5", tones[tone])}
    >
      <div className="flex items-start gap-4">
        <IconTile tone={tone === "sage" ? "sage" : tone}>{icon}</IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-[17px] text-alabaster">{title}</h4>
            {badge}
          </div>
          {children}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------ checklist smart card ------------------------ */

function ChecklistCard({
  id,
  kind,
  checklist,
  onAction,
}: {
  id: string;
  kind: ComplianceKind;
  checklist?: Checklist;
  onAction: () => void;
}) {
  if (kind === "complete" && checklist) {
    return (
      <StatusCardShell
        id={id}
        tone="mint"
        icon={<CheckCircle2 size={16} />}
        title={checklist.title}
        badge={<Pill tone="mint">Complete</Pill>}
      >
        <p className="mt-1 text-[13px] text-mint">
          Checklist complete – updated {fmtTimeAgo(checklist.updatedAt!)}.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {checklist.items.slice(0, 3).map((i) => (
            <Pill key={i.id} tone="sage">
              <CheckCircle2 size={10} className="text-mint-dim" />
              {i.label}
            </Pill>
          ))}
          {checklist.items.length > 3 && (
            <Pill tone="sage">+{checklist.items.length - 3} more</Pill>
          )}
        </div>
      </StatusCardShell>
    );
  }

  if (kind === "pending" && checklist) {
    const done = checklist.items.filter((i) => i.done).length;
    const pct = Math.round((done / checklist.items.length) * 100);
    return (
      <StatusCardShell
        id={id}
        tone="amber"
        icon={<AlertTriangle size={16} />}
        title={checklist.title}
        badge={<Pill tone="amber">Awaiting patient</Pill>}
      >
        <p className="mt-1 text-[13px] font-semibold text-amber">
          Not updated by user.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-sage">
          Assigned {fmtTimeAgo(checklist.assignedAt)} – the patient hasn't
          completed this checklist yet.
        </p>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] tracking-[0.16em] text-sage-dim uppercase">
            <span>Patient progress</span>
            <span>
              {done}/{checklist.items.length}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-amber/70 to-amber"
            />
          </div>
        </div>
      </StatusCardShell>
    );
  }

  if (kind === "missing") {
    return (
      <StatusCardShell
        id={id}
        tone="crimson"
        icon={<ClipboardList size={16} />}
        title="Checklist missing"
        badge={<Pill tone="crimson">Action required</Pill>}
      >
        <p className="mt-1 text-[13px] font-semibold text-crimson">
          Checklist is not updated/given for the patient. Please provide the
          checklist.
        </p>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          className="btn-gold mt-4 px-4 py-2.5 text-xs"
        >
          <ClipboardList size={13} />
          Create checklist
        </motion.button>
      </StatusCardShell>
    );
  }

  return (
    <StatusCardShell
      id={id}
      tone="sage"
      icon={<Info size={16} />}
      title="No checklist attached"
    >
      <p className="mt-1 text-xs leading-relaxed text-sage">
        No checklist was required for this visit.
      </p>
    </StatusCardShell>
  );
}

/* ----------------------- prescription smart card ---------------------- */

function PrescriptionCard({
  id,
  kind,
  prescription,
  onAction,
}: {
  id: string;
  kind: ComplianceKind;
  prescription?: Prescription;
  onAction: () => void;
}) {
  if (kind === "issued" && prescription) {
    return (
      <StatusCardShell
        id={id}
        tone="mint"
        icon={<FileText size={16} />}
        title="Prescription on file"
        badge={<Pill tone="mint">Issued {fmtIssued(prescription.issuedAt)}</Pill>}
      >
        <p className="mt-1 text-xs leading-relaxed text-sage">
          <span className="font-semibold text-alabaster/90">
            {prescription.fileName}
          </span>{" "}
          · {prescription.medications.length} medication
          {prescription.medications.length === 1 ? "" : "s"} · Ref{" "}
          {prescription.ref}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {prescription.medications.slice(0, 3).map((m) => (
            <Pill key={m.id} tone="sage">
              {m.name} {m.dosage}
            </Pill>
          ))}
          {prescription.medications.length > 3 && (
            <Pill tone="sage">
              +{prescription.medications.length - 3} more
            </Pill>
          )}
        </div>
      </StatusCardShell>
    );
  }

  if (kind === "missing") {
    return (
      <StatusCardShell
        id={id}
        tone="crimson"
        icon={<FileText size={16} />}
        title="Prescription missing"
        badge={<Pill tone="crimson">Action required</Pill>}
      >
        <p className="mt-1 text-[13px] font-semibold text-crimson">
          Prescription is not provided. Please provide the prescription.
        </p>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          className="btn-gold mt-4 px-4 py-2.5 text-xs"
        >
          <UploadCloud size={13} />
          Upload prescription
        </motion.button>
      </StatusCardShell>
    );
  }

  return (
    <StatusCardShell
      id={id}
      tone="sage"
      icon={<Info size={16} />}
      title="Prescription not yet required"
    >
      <p className="mt-1 text-xs leading-relaxed text-sage">
        This prescription will be issued after the consultation completes.
      </p>
    </StatusCardShell>
  );
}






