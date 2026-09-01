"use client";

import { motion } from "motion/react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

const EASE = [0.16, 1, 0.3, 1] as const;

const METRICS = [
  { label: "Active members", value: "1,284" },
  { label: "Physician roster", value: "42" },
  { label: "Monthly revenue", value: "$412k" },
  { label: "Avg. NPS", value: "87" },
];

const MEMBERS = [
  { who: "Alex Mercer", plan: "Concierge Annual", status: "Active", tone: "#9fc9ab" },
  { who: "Priya Nair", plan: "Executive Quarterly", status: "Active", tone: "#9fc9ab" },
  { who: "Thomas Vogel", plan: "Per-Consult", status: "Paused", tone: "#e6cda1" },
];

export function AdminDashboardClient() {
  return (
    <DashboardShell role="admin">
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <h2 className="font-display text-lg text-alabaster">Member ledger</h2>
          <span className="chip">Mock data · Phase 5</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-alabaster/8 text-[0.6rem] font-bold uppercase tracking-[0.24em] text-alabaster/40">
                <th className="pb-3 pr-4 font-bold">Member</th>
                <th className="pb-3 pr-4 font-bold">Plan</th>
                <th className="pb-3 pr-4 font-bold">Status</th>
                <th className="pb-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {MEMBERS.map((m) => (
                <tr key={m.who} className="border-b border-alabaster/5 transition hover:bg-alabaster/[0.03]">
                  <td className="py-3.5 pr-4 text-[0.82rem] font-semibold text-alabaster">{m.who}</td>
                  <td className="py-3.5 pr-4 text-[0.78rem] text-alabaster/60">{m.plan}</td>
                  <td className="py-3.5 pr-4">
                    <span className="chip" style={{ borderColor: `${m.tone}55`, background: `${m.tone}14`, color: m.tone }}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <button
                      type="button"
                      className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-gold underline-offset-4 hover:underline"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="glass-deep rounded-[24px] p-6">
          <h2 className="font-display text-lg text-alabaster">Platform health</h2>
          <ul className="mt-4 space-y-2.5 text-[0.8rem] text-alabaster/60">
            <li className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />Auth service: 99.99% uptime</li>
            <li className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />JWT issuance: nominal</li>
            <li className="flex gap-2.5"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-forest-400" />PostgreSQL: healthy</li>
          </ul>
        </section>
        <section className="glass-deep rounded-[24px] p-6">
          <h2 className="font-display text-lg text-alabaster">Recent sign-ups</h2>
          <div className="mt-4 space-y-2.5">
            {["eleanor.v · Patient · 2h ago", "dr.hugo · Physician · 6h ago", "ms.bennett · Patient · 1d ago"].map((r) => (
              <p key={r} className="rounded-xl border border-alabaster/8 bg-alabaster/[0.04] px-4 py-2.5 text-[0.78rem] text-alabaster/65">
                {r}
              </p>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
