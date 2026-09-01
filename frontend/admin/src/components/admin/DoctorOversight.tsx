"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { ComplianceItem, MockData } from "@/lib/mock";
import { itemsForAppointment } from "@/lib/mock";
import { cn, formatDate } from "@/lib/utils";
import { DoctorModal } from "./modals/DoctorModal";
import {
  AlertIcon,
  CalendarIcon,
  ChevronRightIcon,
  SearchIcon,
  StethoscopeIcon,
} from "./ui/icons";
import { Avatar, Kicker } from "./ui/primitives";

export function DoctorOversight({
  data,
  items,
}: {
  data: MockData;
  items: ComplianceItem[];
}) {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState<string>(data.anchor);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    const filtered = data.doctors.filter(
      (d) =>
        q === "" ||
        d.name.toLowerCase().includes(q) ||
        d.specialty.toLowerCase().includes(q) ||
        d.room.toLowerCase().includes(q)
    );
    return filtered
      .map((doctor) => ({
        doctor,
        appts: data.appointments
          .filter((a) => a.doctorId === doctor.id && a.date === date && a.status !== "cancelled")
          .sort((a, b) => a.time.localeCompare(b.time)),
      }))
      .sort((a, b) => b.appts.length - a.appts.length);
  }, [data, q, date]);

  const maxVolume = Math.max(1, ...rows.map((r) => r.appts.length));
  const total = rows.reduce((sum, r) => sum + r.appts.length, 0);
  const selectedDoctor = data.doctors.find((d) => d.id === selectedDoctorId) ?? null;

  return (
    <div className="space-y-8">
      {/* ––––– Header / filters ––––– */}
      <section>
        <Kicker>Doctor oversight</Kicker>
        <h3 className="mt-1 font-display text-xl font-semibold text-forest-900">
          Workload tracking
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <label className="flex min-w-[260px] flex-1 items-center gap-3 rounded-full border border-white/80 bg-white/60 px-4 py-2.5 backdrop-blur-xl transition-colors focus-within:bg-white/80 sm:max-w-sm">
            <SearchIcon className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search doctors, specialties…"
              className="w-full bg-transparent text-sm font-medium text-forest-900 outline-none placeholder:text-ink-400"
            />
          </label>

          {/* Date filter */}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-full border border-white/80 bg-white/60 px-4 py-2.5 text-sm font-semibold text-forest-800 backdrop-blur-xl transition-colors hover:bg-white/80">
            <CalendarIcon className="h-4 w-4 text-forest-600" />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="date-native w-[110px] bg-transparent outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setDate(data.anchor)}
            className={cn(
              "rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
              date === data.anchor
                ? "bg-forest-800 text-alabaster-50 shadow-md shadow-forest-900/20"
                : "bg-white/60 text-forest-700 hover:bg-white/90"
            )}
          >
            Today
          </button>

          <span className="ml-auto rounded-full border border-forest-600/20 bg-forest-600/8 px-3.5 py-2 text-xs font-semibold text-forest-700">
            {total} appointment{total === 1 ? "" : "s"} · {formatDate(date)}
          </span>
        </div>
      </section>

      {/* ––––– Doctor volume list ––––– */}
      <section>
        {rows.length === 0 ? (
          <div className="glass rounded-3xl px-6 py-14 text-center">
            <StethoscopeIcon className="mx-auto h-8 w-8 text-ink-400" />
            <p className="mt-3 font-display text-lg font-semibold text-forest-900">
              No doctors match your search
            </p>
            <p className="mt-1 text-sm text-ink-500">Try a different name or specialty.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {rows.map((row, index) => {
                const open = row.appts.reduce(
                  (sum, a) =>
                    sum +
                    itemsForAppointment(items, a.id).filter((i) => i.status !== "closed").length,
                  0
                );
                return (
                  <motion.button
                    key={row.doctor.id}
                    type="button"
                    layout
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: index * 0.05, type: "spring", stiffness: 280, damping: 28 }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.995 }}
                    onClick={() => setSelectedDoctorId(row.doctor.id)}
                    className="glass group grid w-full cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-4 rounded-3xl p-4 text-left sm:p-5"
                  >
                    <span className="hidden w-8 font-display text-sm italic text-ink-400 sm:block">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Avatar name={row.doctor.name} hue={row.doctor.hue} size={48} />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <p className="truncate font-display text-[17px] font-semibold text-forest-900">
                          {row.doctor.name}
                        </p>
                        <div className="flex items-center gap-2.5">
                          {open > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-warn-500/30 bg-warn-500/15 px-2.5 py-1 text-[11px] font-semibold text-warn-700">
                              <AlertIcon className="h-3 w-3" />
                              {open} open
                            </span>
                          )}
                          <span className="font-display text-2xl font-semibold leading-none text-forest-900">
                            {row.appts.length}
                          </span>
                          <span className="text-[11px] text-ink-400">
                            {row.appts.length === 1 ? "appt" : "appts"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                        <span>{row.doctor.specialty}</span>
                        <span className="text-ink-300">·</span>
                        <span>{row.doctor.room}</span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-forest-900/8">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-forest-700 to-forest-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${(row.appts.length / maxVolume) * 100}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 90,
                              damping: 22,
                              delay: 0.12 + index * 0.05,
                            }}
                          />
                        </div>
                        <span className="hidden shrink-0 text-[11px] text-ink-400 transition-colors group-hover:text-forest-700 sm:block">
                          Open workload card →
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
          <ChevronRightIcon className="h-3.5 w-3.5" />
          Select a physician to open their 3D workload card with categorized appointments and live compliance status.
        </p>
      </section>

      {/* ––––– 3D Liquid Glass doctor modal ––––– */}
      <DoctorModal
        doctor={selectedDoctor}
        data={data}
        items={items}
        onClose={() => setSelectedDoctorId(null)}
      />
    </div>
  );
}
