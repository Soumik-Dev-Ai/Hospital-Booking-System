"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { ComplianceItem, MockData } from "@/lib/mock";
import { BOOKING_STATUS_META } from "@/lib/mock";
import { cn, formatDateTime } from "@/lib/utils";
import { PatientModal } from "./modals/PatientModal";
import { RangePicker, type DateRange } from "./ui/RangePicker";
import {
  CalendarIcon,
  ChevronDownIcon,
  SearchIcon,
} from "./ui/icons";
import { Avatar, Kicker, Pill, StatusBadge } from "./ui/primitives";
import { ServiceIcon } from "./ui/icons";

export function ServicesBookings({
  data,
  items,
}: {
  data: MockData;
  items: ComplianceItem[];
}) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const patientById = useMemo(
    () => new Map(data.patients.map((p) => [p.id, p])),
    [data.patients]
  );
  const doctorById = useMemo(
    () => new Map(data.doctors.map((d) => [d.id, d])),
    [data.doctors]
  );

  function inRange(iso: string): boolean {
    if (!range) return true;
    const end = range.end ?? range.start;
    return iso >= range.start && iso <= end;
  }

  const scopedBookings = useMemo(
    () => data.bookings.filter((b) => inRange(b.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.bookings, range]
  );

  const rows = useMemo(() => {
    return data.services
      .filter(
        (s) =>
          q === "" ||
          s.name.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q)
      )
      .map((service) => {
        const bookings = scopedBookings.filter((b) => b.serviceId === service.id);
        return {
          service,
          bookings,
          total: bookings.length,
          pending: bookings.filter((b) => b.status === "pending-results").length,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [data.services, scopedBookings, q]);

  const totals = scopedBookings.reduce(
    (acc, b) => {
      acc.all += 1;
      if (b.status === "pending-results") acc.pending += 1;
      return acc;
    },
    { all: 0, pending: 0 }
  );

  const selectedPatient = patientId ? patientById.get(patientId) ?? null : null;

  return (
    <div className="space-y-8">
      {/* ––––– Header / filters ––––– */}
      <section>
        <Kicker>Services & bookings</Kicker>
        <h3 className="mt-1 font-display text-xl font-semibold text-forest-900">
          Booking volume by service
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex min-w-[260px] flex-1 items-center gap-3 rounded-full border border-white/80 bg-white/60 px-4 py-2.5 backdrop-blur-xl transition-colors focus-within:bg-white/80 sm:max-w-sm">
            <SearchIcon className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services…"
              className="w-full bg-transparent text-sm font-medium text-forest-900 outline-none placeholder:text-ink-400"
            />
          </label>

          <RangePicker value={range} onChange={setRange} anchor={data.anchor} />

          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-forest-600/20 bg-forest-600/8 px-3.5 py-2 text-xs font-semibold text-forest-700">
              {totals.all} bookings
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-500/30 bg-warn-500/15 px-3.5 py-2 text-xs font-semibold text-warn-700">
              <CalendarIcon className="h-3.5 w-3.5" />
              {totals.pending} pending results
            </span>
          </div>
        </div>
      </section>

      {/* ––––– Service rows ––––– */}
      <section>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((row, index) => {
              const open = expandedId === row.service.id;
              return (
                <motion.div
                  key={row.service.id}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: "spring", stiffness: 280, damping: 28 }}
                  className={cn(
                    "glass rounded-3xl transition-shadow",
                    open && "shadow-[0_32px_90px_-30px_rgba(21,42,33,0.45)]"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-3 p-4 sm:gap-4 sm:p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-forest-600/10 text-forest-700">
                      <ServiceIcon id={row.service.icon} className="h-5.5 w-5.5" />
                    </span>

                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : row.service.id)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <p className="truncate font-display text-[17px] font-semibold text-forest-900">
                        {row.service.name}
                      </p>
                      <p className="truncate text-[13px] text-ink-500">
                        {row.service.tagline} · from ${row.service.price.toLocaleString()}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Pill tone="green">
                        Total bookings · {row.total}
                      </Pill>
                      <Pill tone={row.pending > 0 ? "amber" : "muted"}>
                        {row.pending > 0
                          ? `Pending results · ${row.pending}`
                          : "No pending results"}
                      </Pill>
                    </div>

                    <motion.button
                      type="button"
                      aria-label={open ? "Collapse booking ledger" : "Expand booking ledger"}
                      onClick={() => setExpandedId(open ? null : row.service.id)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.9 }}
                      className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/70 text-forest-700 transition-colors hover:bg-white/95"
                    >
                      <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ type: "spring", stiffness: 340, damping: 26 }}
                        className="flex"
                      >
                        <ChevronDownIcon className="h-4 w-4" />
                      </motion.span>
                    </motion.button>
                  </div>

                  {/* ––––– Booking ledger (scrollable dropdown) ––––– */}
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="ledger"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 34 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-white/70 px-4 pb-4 pt-3 sm:px-5">
                          <div className="scroll-slim max-h-[300px] overflow-y-auto rounded-2xl border border-white/60 bg-white/40">
                            <table className="w-full min-w-[560px] text-left text-sm">
                              <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl">
                                <tr className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">
                                  <th className="px-4 py-3">Patient</th>
                                  <th className="px-3 py-3">Date & time</th>
                                  <th className="px-3 py-3">Doctor</th>
                                  <th className="px-4 py-3 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.bookings.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={4}
                                      className="px-4 py-8 text-center text-[13px] text-ink-500"
                                    >
                                      No bookings for this service in the selected range.
                                    </td>
                                  </tr>
                                ) : (
                                  row.bookings.map((b) => {
                                    const patient = patientById.get(b.patientId);
                                    const doctor = doctorById.get(b.doctorId);
                                    const meta = BOOKING_STATUS_META[b.status];
                                    return (
                                      <tr
                                        key={b.id}
                                        className="border-t border-white/60 transition-colors hover:bg-white/50"
                                      >
                                        <td className="px-4 py-2.5">
                                          <button
                                            type="button"
                                            onClick={() => patient && setPatientId(patient.id)}
                                            className="group flex cursor-pointer items-center gap-2.5"
                                          >
                                            <Avatar
                                              name={patient?.name ?? "–"}
                                              hue={patient?.hue ?? 150}
                                              size={28}
                                            />
                                            <span className="font-semibold text-forest-800 underline-offset-2 group-hover:text-forest-600 group-hover:underline">
                                              {patient?.name ?? "–"}
                                            </span>
                                          </button>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-600">
                                          {formatDateTime(b.date, b.time)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5 text-[13px] text-ink-600">
                                          {doctor?.name ?? "–"}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                                          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-2.5 text-[11px] text-ink-400">
                            Booking ledger · {row.bookings.length} of {row.total}{" "}
                            {row.bookings.length === 1 ? "entry" : "entries"} shown · click a
                            patient name for their full 3D record.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* ––––– 3D patient pop-up ––––– */}
      <PatientModal
        patient={selectedPatient}
        data={data}
        items={items}
        onClose={() => setPatientId(null)}
      />
    </div>
  );
}
