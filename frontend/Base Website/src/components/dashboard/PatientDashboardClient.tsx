"use client";

import { motion } from "motion/react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const EASE = [0.16, 1, 0.3, 1] as const;

const UPCOMING = [
  { time: "Tomorrow · 09:45", title: "Precision Diagnostics: intake", doctor: "Dr. Sofia Reyes", tone: "gold" },
  { time: "Thu · 14:15", title: "Concierge Cardiology Consult", doctor: "Dr. Lena Kovač", tone: "sage" },
];

const CARETEAM = [
  { who: "Dr. Lena Kovač", role: "Lead Cardiologist" },
  { who: "Dr. Theo Lindqvist", role: "Wellness Psychiatrist" },
  { who: "Mara Quinn, RN", role: "Care Coordinator" },
];

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="glass rounded-[22px] p-5"
    >
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.26em] text-alabaster/45">{label}</p>
      <p className="mt-2 font-display text-3xl text-gold-soft">{value}</p>
      <p className="mt-1 text-[0.7rem] text-alabaster/50">{sub}</p>
    </motion.div>
  );
}

export function PatientDashboardClient() {
  return (
    <DashboardShell role="patient">
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming" value="02" sub="Appointments this week" />
        <StatCard label="Care Team" value="03" sub="Clinicians on your file" />
        <StatCard label="Vault" value="14" sub="Documents & results stored" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="glass-deep rounded-[24px] p-6">
          <h2 className="font-display text-lg text-alabaster">Upcoming care</h2>
          <div className="mt-4 space-y-3">
            {UPCOMING.map((a) => (
              <div
                key={a.title}
                className="flex items-center gap-4 rounded-2xl border border-alabaster/8 bg-alabaster/[0.04] px-4 py-3.5 transition hover:border-gold/25"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
                  style={{
                    borderColor: a.tone === "gold" ? "rgba(201,162,107,0.35)" : "rgba(159,184,164,0.35)",
                    background: "linear-gradient(150deg, rgba(39,111,77,0.4), rgba(18,60,42,0.6))",
                  }}
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 text-gold-soft">
                    <rect x="3.5" y="5" width="13" height="11.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3.5 9h13M7 2.5v4M13 2.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84rem] font-semibold text-alabaster">{a.title}</p>
                  <p className="text-[0.7rem] text-alabaster/50">{a.doctor}</p>
                </div>
                <span className="chip shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[0.64rem] font-semibold uppercase tracking-[0.22em] text-alabaster/30">
            Booking & rescheduling arrive in Phase 3
          </p>
        </section>

        <section className="glass-deep rounded-[24px] p-6">
          <h2 className="font-display text-lg text-alabaster">Your care team</h2>
          <div className="mt-4 space-y-2.5">
            {CARETEAM.map((m) => (
              <div key={m.who} className="flex items-center gap-3 rounded-2xl border border-alabaster/8 bg-alabaster/[0.04] px-4 py-3">
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-[0.6rem] font-extrabold"
                  style={{
                    background: "linear-gradient(150deg, #276f4d, #123c2a)",
                    border: "1px solid rgba(230,205,161,0.4)",
                    color: "#f4f2e8",
                  }}
                >
                  {m.who.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.8rem] font-semibold text-alabaster">{m.who}</p>
                  <p className="text-[0.66rem] text-alabaster/50">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
