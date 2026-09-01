"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ComplianceItem, ItemStatus, MockData } from "@/lib/mock";
import {
  KIND_META,
  STATUS_META,
  actionLabelFor,
} from "@/lib/mock";
import { cn, formatDateTime, relativeDay } from "@/lib/utils";
import { ModalShell } from "../ui/ModalShell";
import { KindIcon, AlertIcon, CheckCircleIcon, CloseIcon } from "../ui/icons";
import {
  Avatar,
  GlassButton,
  IconChip,
  Kicker,
  StatusBadge,
  AnimatedNumber,
} from "../ui/primitives";

export type StatKey = "not-sent" | "sent" | "pending-results";

export const STAT_LOOKUP: Record<
  StatKey,
  { label: string; caption: string; status: ItemStatus }
> = {
  "not-sent": {
    label: "Not Sent By Doctor",
    caption: "Checklists & prescriptions still waiting to be issued by the physician.",
    status: "not-sent",
  },
  sent: {
    label: "Pending Patient Response",
    caption: "Items sent to patients that have not yet received a response.",
    status: "sent",
  },
  "pending-results": {
    label: "Pending Test Results",
    caption: "Laboratory work & imaging with reports still outstanding.",
    status: "pending-results",
  },
};

export function ComplianceModal({
  open,
  statKey,
  data,
  items,
  onAdvance,
  onClose,
}: {
  open: boolean;
  statKey: StatKey;
  data: MockData;
  items: ComplianceItem[];
  onAdvance: (id: string) => void;
  onClose: () => void;
}) {
  const meta = STAT_LOOKUP[statKey];

  const rows = useMemo(() => {
    const apptById = new Map(data.appointments.map((a) => [a.id, a]));
    const patientById = new Map(data.patients.map((p) => [p.id, p]));
    const doctorById = new Map(data.doctors.map((d) => [d.id, d]));
    const serviceById = new Map(data.services.map((s) => [s.id, s]));

    return items
      .filter((item) => item.status === meta.status)
      .map((item) => {
        const appt = apptById.get(item.appointmentId);
        return { item, appt };
      })
      .filter((r) => r.appt !== undefined)
      .map((r) => ({
        item: r.item,
        appt: r.appt!,
        patient: patientById.get(r.appt!.patientId),
        doctor: doctorById.get(r.appt!.doctorId),
        service: serviceById.get(r.appt!.serviceId),
      }))
      .sort((a, b) =>
        a.appt.date === b.appt.date
          ? a.appt.time.localeCompare(b.appt.time)
          : a.appt.date < b.appt.date
            ? -1
            : 1
      );
  }, [items, data, meta.status]);

  return (
    <ModalShell open={open} onClose={onClose} width="max-w-3xl">
      <div className="glass-deep relative flex max-h-[86vh] flex-col overflow-hidden rounded-[32px]">
        {/* Liquid ambient blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
          <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-warn-500/12 blur-[70px]" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-forest-400/20 blur-[80px]" />
        </div>

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 border-b border-white/60 px-6 py-5 sm:px-7">
          <div className="flex items-center gap-4">
            <IconChip className="bg-warn-500/15 text-warn-600">
              <AlertIcon className="h-5 w-5" />
            </IconChip>
            <div>
              <Kicker>Compliance drill-down</Kicker>
              <h2 className="mt-1 font-display text-2xl font-semibold text-forest-900 sm:text-[26px]">
                {meta.label}
              </h2>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-600">
                {meta.caption}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <AnimatedNumber
                value={rows.length}
                className="block font-display text-4xl font-semibold leading-none text-forest-900"
              />
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                {rows.length === 1 ? "item" : "items"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-forest-700 transition-colors hover:bg-white/90"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="scroll-slim relative min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-5 sm:px-7">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-forest-600/15 bg-forest-600/5 px-6 py-14 text-center">
              <CheckCircleIcon className="h-9 w-9 text-forest-500" />
              <div>
                <p className="font-display text-lg font-semibold text-forest-900">
                  This queue is completely clear
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Nothing requires attention right now – excellent.
                </p>
              </div>
            </div>
          ) : (
            rows.map((row, index) => (
              <motion.div
                key={row.item.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + index * 0.045, type: "spring", stiffness: 300, damping: 28 }}
                className="rounded-2xl border border-white/70 bg-white/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={row.patient?.name ?? "–"} hue={row.patient?.hue ?? 150} size={38} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-forest-900">
                        {row.patient?.name}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {row.doctor?.name} · {formatDateTime(row.appt.date, row.appt.time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                        row.item.status === "closed"
                          ? "bg-forest-600/10 text-forest-700"
                          : "bg-warn-500/15 text-warn-700"
                      )}
                    >
                      {relativeDay(row.appt.date, data.anchor)}
                    </span>
                    <StatusBadge tone={STATUS_META[row.item.status].tone}>
                      {STATUS_META[row.item.status].label}
                    </StatusBadge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/45 px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <KindIcon kind={row.item.kind} className="h-4 w-4 shrink-0 text-forest-600" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-forest-900">
                        {row.item.label}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {KIND_META[row.item.kind].label}
                        {row.service ? ` · ${row.service.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <GlassButton size="sm" tone="primary" onClick={() => onAdvance(row.item.id)}>
                    {actionLabelFor(row.item)}
                  </GlassButton>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="relative border-t border-white/60 px-7 py-3.5">
          <p className="text-[11px] text-ink-400">
            Advancing an item updates the compliance queue and the overview statistics in real time.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
