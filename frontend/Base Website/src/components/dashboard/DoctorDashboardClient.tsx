"use client";

import { motion } from "motion/react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const EASE = [0.16, 1, 0.3, 1] as const;

const QUEUE = [
  { slot: "09:00", patient: "Alex Mercer", reason: "Annual cardiac review", status: "Confirmed", tone: "#9fc9ab" },
  { slot: "09:45", patient: "Priya Nair", reason: "Post-procedure follow-up", status: "Arriving", tone: "#e6cda1" },
  { slot: "11:15", patient: "Thomas Vogel", reason: "Echocardiogram review", status: "To confirm", tone: "rgba(244,242,232,0.5)" },
];

const METRICS = [
  { label: "Today's consults", value: "07" },
  { label: "Avg. review time", value: "26m" },
  { label: "Completion rate", value: "98%" },
];

export function DoctorDashboardClient() {
  return (
    <DashboardShell role="doctor">
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: i * 0.07 }}
            className="glass rounded-[22px] p-5"
          >
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.26em] text-alabaster/45">{m.label}</p>
            <p className="mt-2 font-display text-3xl text-gold-soft">{m.value}</p>
          </motion.div>
        ))}
      </div>

      <section className="glass-deep mt-6 rounded-[24px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-alabaster">Today&apos;s queue</h2>
          <span className="chip">Mock schedule · Phase 4</span>
        </div>
        <div className="mt-4 space-y-3">
          {QUEUE.map((q) => (
            <div
              key={q.slot}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-alabaster/8 bg-alabaster/[0.04] px-4 py-3.5 transition hover:border-gold/25"
            >
              <span className="font-display text-lg text-gold-soft">{q.slot}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.84rem] font-semibold text-alabaster">{q.patient}</p>
                <p className="truncate text-[0.7rem] text-alabaster/50">{q.reason}</p>
              </div>
              <span
                className="chip"
                style={{ borderColor: `${q.tone}55`, background: `${q.tone}14`, color: q.tone }}
              >
                {q.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="glass-deep rounded-[24px] p-6">
          <h2 className="font-display text-lg text-alabaster">Availability</h2>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {["08:30", "09:00", "09:45", "10:30", "11:15", "13:30"].map((t, i) => (
              <span
                key={t}
                className={`rounded-xl border px-2 py-2.5 text-center text-[0.74rem] font-bold ${
                  i === 2
                    ? "border-gold bg-gradient-to-b from-gold-soft to-gold text-forest-950"
                    : "border-alabaster/12 bg-forest-950/50 text-alabaster/70"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-alabaster/30">
            Slot management lands in Phase 4
          </p>
        </section>

        <section className="glass-deep rounded-[24px] p-6">
          <h2 className="font-display text-lg text-alabaster">Clinical notes</h2>
          <ul className="mt-4 space-y-2.5 text-[0.8rem] text-alabaster/60">
            <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />Review MRIs for Thomas Vogel before 11:15.</li>
            <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />Approve the longevity protocol for member M-2044.</li>
            <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />Sign off on the second-opinion panel brief.</li>
          </ul>
        </section>
      </div>
    </DashboardShell>
  );
}
