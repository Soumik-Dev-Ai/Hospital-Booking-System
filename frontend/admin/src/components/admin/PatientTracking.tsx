"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { ComplianceItem, MockData, Patient } from "@/lib/mock";
import {
  APPT_STATUS_META,
  STATUS_META,
  nextStatusFor,
  itemsForPatient,
  summarizeItems,
} from "@/lib/mock";
import { cn, formatDate, relativeDay } from "@/lib/utils";
import { ComplianceModal, STAT_LOOKUP, type StatKey } from "./modals/ComplianceModal";
import {
  AlertIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardIcon,
  ClockIcon,
  FileTextIcon,
  UsersIcon,
} from "./ui/icons";
import {
  AnimatedNumber,
  Avatar,
  IconChip,
  Kicker,
  StatusBadge,
} from "./ui/primitives";

export function PatientTracking({
  data,
  items,
  setItems,
  notify,
}: {
  data: MockData;
  items: ComplianceItem[];
  setItems: Dispatch<SetStateAction<ComplianceItem[]>>;
  notify: (message: string) => void;
}) {
  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      registered: data.patients.length,
      "not-sent": items.filter((i) => i.status === "not-sent").length,
      sent: items.filter((i) => i.status === "sent").length,
      "pending-results": items.filter((i) => i.status === "pending-results").length,
    }),
    [items, data.patients.length]
  );

  const doctorById = useMemo(
    () => new Map(data.doctors.map((d) => [d.id, d])),
    [data.doctors]
  );
  const serviceById = useMemo(
    () => new Map(data.services.map((s) => [s.id, s])),
    [data.services]
  );

  const appointmentsByPatient = useMemo(() => {
    const map = new Map<string, MockData["appointments"]>();
    for (const a of data.appointments) {
      const list = map.get(a.patientId) ?? [];
      list.push(a);
      map.set(a.patientId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        a.date === b.date ? b.time.localeCompare(a.time) : a.date < b.date ? 1 : -1
      );
    }
    return map;
  }, [data.appointments]);

  function advanceItem(id: string) {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const next = nextStatusFor(target);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: next } : i)));
    notify(`"${target.label}" → ${STATUS_META[next].label}`);
  }

  const statCards: Array<{
    key: StatKey | "registered";
    label: string;
    caption: string;
    value: number;
    clickable: boolean;
    tint: "green" | "amber";
    Icon: typeof UsersIcon;
  }> = [
    {
      key: "registered",
      label: "Registered Patients",
      caption: "Active members across all programs",
      value: stats.registered,
      clickable: false,
      tint: "green",
      Icon: UsersIcon,
    },
    {
      key: "not-sent",
      label: STAT_LOOKUP["not-sent"].label,
      caption: "Checklists & prescriptions awaiting the physician",
      value: stats["not-sent"],
      clickable: true,
      tint: "amber",
      Icon: ClipboardIcon,
    },
    {
      key: "sent",
      label: STAT_LOOKUP.sent.label,
      caption: "Sent to the patient, awaiting their response",
      value: stats.sent,
      clickable: true,
      tint: "amber",
      Icon: ClockIcon,
    },
    {
      key: "pending-results",
      label: STAT_LOOKUP["pending-results"].label,
      caption: "Labs & imaging awaiting a final report",
      value: stats["pending-results"],
      clickable: true,
      tint: "amber",
      Icon: FileTextIcon,
    },
  ];

  return (
    <div className="space-y-10">
      {/* ––––– Overview statistics ––––– */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Kicker>Overview statistics</Kicker>
            <h3 className="mt-1 font-display text-xl font-semibold text-forest-900">
              Compliance at a glance
            </h3>
          </div>
          <p className="text-xs text-ink-400">
            Click an amber statistic to inspect the exact queue behind it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((stat) => {
            const clickable = stat.clickable;
            const inner = (
              <>
                <div className="flex items-start justify-between">
                  <IconChip
                    className={cn(
                      stat.tint === "amber"
                        ? "bg-warn-500/15 text-warn-600"
                        : "bg-forest-600/10 text-forest-600"
                    )}
                  >
                    <stat.Icon className="h-5 w-5" />
                  </IconChip>
                  {clickable && (
                    <span className="text-[11px] font-semibold text-ink-400 transition-colors group-hover:text-warn-700">
                      Inspect →
                    </span>
                  )}
                </div>
                <AnimatedNumber
                  value={stat.value}
                  className="mt-4 block font-display text-[44px] font-semibold leading-none text-forest-900"
                />
                <p className="mt-2 text-sm font-semibold text-forest-800">{stat.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{stat.caption}</p>
              </>
            );

            if (!clickable) {
              return (
                <div key={stat.key} className="glass relative rounded-[26px] p-5">
                  {inner}
                </div>
              );
            }

            return (
              <motion.button
                key={stat.key}
                type="button"
                onClick={() => setOpenStat(stat.key as StatKey)}
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="glass group relative cursor-pointer rounded-[26px] p-5 text-left"
              >
                {stat.tint === "amber" && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-warn-500/15 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                  />
                )}
                {inner}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* ––––– Patient master list ––––– */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Kicker>Patient master list</Kicker>
            <h3 className="mt-1 font-display text-xl font-semibold text-forest-900">
              Registered patients
            </h3>
          </div>
          <span className="rounded-full border border-forest-600/20 bg-forest-600/8 px-3 py-1.5 text-xs font-semibold text-forest-700">
            {data.patients.length} members
          </span>
        </div>

        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {data.patients.map((patient, index) => (
              <PatientRow
                key={patient.id}
                patient={patient}
                index={index}
                expanded={expandedId === patient.id}
                onToggle={() => setExpandedId((id) => (id === patient.id ? null : patient.id))}
                data={data}
                items={items}
                appointments={appointmentsByPatient.get(patient.id) ?? []}
                doctorById={doctorById}
                serviceById={serviceById}
              />
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* ––––– Drill-down modal ––––– */}
      <ComplianceModal
        open={openStat !== null}
        statKey={openStat ?? "not-sent"}
        data={data}
        items={items}
        onAdvance={advanceItem}
        onClose={() => setOpenStat(null)}
      />
    </div>
  );
}

/* ––––– Patient row ––––– */

function PatientRow({
  patient,
  index,
  expanded,
  onToggle,
  data,
  items,
  appointments,
  doctorById,
  serviceById,
}: {
  patient: Patient;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  data: MockData;
  items: ComplianceItem[];
  appointments: MockData["appointments"];
  doctorById: Map<string, MockData["doctors"][number]>;
  serviceById: Map<string, MockData["services"][number]>;
}) {
  const patientItems = itemsForPatient(items, patient.id, data.appointments);
  const summary = summarizeItems(patientItems);
  const primary = doctorById.get(patient.primaryDoctorId);
  const lastVisit = appointments[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.045, type: "spring", stiffness: 260, damping: 26 }}
      className={cn(
        "glass rounded-3xl transition-shadow",
        expanded && "shadow-[0_32px_90px_-30px_rgba(21,42,33,0.45)]"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-4 p-4 text-left sm:p-5"
      >
        <Avatar name={patient.name} hue={patient.hue} size={46} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-semibold text-forest-900">
            {patient.name}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-ink-600">
            {patient.condition} · {patient.insurance}
          </p>
        </div>

        <div className="hidden min-w-0 items-center gap-4 lg:flex">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
              Primary physician
            </p>
            <p className="mt-0.5 max-w-[170px] truncate text-[13px] font-medium text-forest-800">
              {primary?.name ?? "Unassigned"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">
              Last visit
            </p>
            <p className="mt-0.5 text-[13px] font-medium text-forest-800">
              {lastVisit ? relativeDay(lastVisit.date, data.anchor) : "–"}
            </p>
          </div>
        </div>

        {summary.open > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warn-500/30 bg-warn-500/15 px-3 py-1.5 text-xs font-semibold text-warn-700">
            <AlertIcon className="h-3.5 w-3.5" />
            {summary.open} open
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-forest-600/20 bg-forest-600/10 px-3 py-1.5 text-xs font-semibold text-forest-700">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Clear
          </span>
        )}

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-forest-700"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/70 px-4 pb-5 pt-4 sm:px-5">
              {/* Compliance badges */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
                  Compliance badges
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {summary.open === 0 ? (
                    <StatusBadge tone="green">All compliance clear</StatusBadge>
                  ) : (
                    <>
                      {summary.notSent > 0 && (
                        <StatusBadge tone="amber">
                          {summary.notSent} not sent by doctor
                        </StatusBadge>
                      )}
                      {summary.awaiting > 0 && (
                        <StatusBadge tone="amber">
                          {summary.awaiting} awaiting patient
                        </StatusBadge>
                      )}
                      {summary.pendingResults > 0 && (
                        <StatusBadge tone="amber">
                          {summary.pendingResults} results pending
                        </StatusBadge>
                      )}
                      {summary.closed > 0 && (
                        <StatusBadge tone="green">{summary.closed} closed</StatusBadge>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Appointment history */}
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
                  Appointment history
                </p>
                <div className="mt-2 space-y-2">
                  {appointments.length === 0 ? (
                    <p className="rounded-2xl bg-white/40 px-4 py-3 text-[13px] text-ink-500">
                      No appointments recorded yet.
                    </p>
                  ) : (
                    appointments.slice(0, 6).map((a) => {
                      const meta = APPT_STATUS_META[a.status];
                      return (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/45 px-4 py-2.5"
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
                                {doctorById.get(a.doctorId)?.name} ·{" "}
                                {formatDate(a.date)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-ink-400">
                              {relativeDay(a.date, data.anchor)}
                            </span>
                            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
