"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth, dashPath } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import type { Role } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

const ROLE_LABEL: Record<Role, string> = {
  patient: "Patient",
  doctor: "Physician",
  admin: "Administrator",
};

const ROLE_MENU: Record<Role, { icon: string; label: string }[]> = {
  patient: [
    { icon: "â–ˆ", label: "Overview" },
    { icon: "â–‰", label: "Appointments" },
    { icon: "✦", label: "Care Team" },
    { icon: "â–'", label: "Records Vault" },
  ],
  doctor: [
    { icon: "â–ˆ", label: "Schedule" },
    { icon: "â–‰", label: "Queue" },
    { icon: "✦", label: "Patients" },
    { icon: "â–'", label: "Availability" },
  ],
  admin: [
    { icon: "â–ˆ", label: "Platform" },
    { icon: "â–‰", label: "Members" },
    { icon: "✦", label: "Revenue" },
    { icon: "â–'", label: "Audit Log" },
  ],
};

export function DashboardShell({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const { user, status, openAuth, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (status === "guest") {
      openAuth({ mode: "login", intent: "book" });
      router.replace("/");
    }
    if (status === "authed" && user && user.role !== role) {
      router.replace(dashPath(user.role));
    }
  }, [status, user, role, openAuth, router]);

  if (status !== "authed" || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-forest-950">
        <div className="flex flex-col items-center gap-4">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.3em] text-alabaster/40">
            Verifying session
          </p>
        </div>
      </div>
    );
  }

  const menu = ROLE_MENU[role];
  const initial = user.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-forest-950 text-alabaster">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(110% 80% at 50% -10%, #0d2b1e 0%, #071a12 52%, #040d09 100%)",
        }}
      />
      <div className="noise-layer" aria-hidden="true" />

      <div className="mx-auto flex max-w-7xl gap-6 px-4 pt-6 sm:px-6">
        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="glass-deep sticky top-6 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col rounded-[24px] p-5 md:flex"
        >
          <div className="flex items-center gap-3">
            <span className="relative grid h-9 w-9 place-items-center">
              <svg viewBox="0 0 36 36" fill="none" className="h-9 w-9">
                <circle cx="18" cy="18" r="15" stroke="rgba(230,205,161,0.5)" strokeWidth="1" />
                <path d="M18 10.5v15M10.5 18h15" stroke="rgba(244,242,232,0.9)" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="18" cy="18" r="2.6" fill="#c9a26b" />
              </svg>
            </span>
            <span className="font-display text-base tracking-[0.2em]">AURELIS</span>
          </div>

          <nav className="mt-8 space-y-1.5">
            {menu.map((m, i) => (
              <button
                key={m.label}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[0.78rem] font-semibold tracking-wide transition ${
                  i === 0
                    ? "border border-gold/25 bg-gradient-to-b from-forest-600/40 to-forest-900/60 text-gold-soft"
                    : "text-alabaster/55 hover:bg-alabaster/5 hover:text-alabaster"
                }`}
              >
                <span className="text-[0.7rem]">{m.icon}</span>
                {m.label}
                {i > 0 && (
                  <span className="ml-auto text-[0.56rem] font-bold uppercase tracking-[0.16em] text-alabaster/25">
                    Phase {i + 3}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-3 border-t border-alabaster/8 pt-4">
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-[0.66rem] font-extrabold"
                style={{
                  background: "linear-gradient(150deg, #276f4d, #123c2a)",
                  border: "1px solid rgba(230,205,161,0.4)",
                  color: "#f4f2e8",
                }}
              >
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.78rem] font-bold">{user.fullName}</p>
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-gold/70">
                  {user.role}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                toast({ kind: "info", title: "Signed out", message: "Your session has been cleared." });
                router.push("/");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-alabaster/12 bg-alabaster/4 py-2.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-alabaster/60 transition hover:border-red-300/30 hover:text-red-200"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                <path d="M8 3H4.5A1.5 1.5 0 003 4.5v11A1.5 1.5 0 004.5 17H8M13 6l4 4-4 4M17 10H8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </div>
        </motion.aside>

        {/* Main */}
        <motion.main
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
          className="min-w-0 flex-1 pb-16"
        >
          <header className="flex flex-wrap items-center justify-between gap-4 px-1 pt-3">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-gold">
                {ROLE_LABEL[role]} workspace · Phase {role === "patient" ? 3 : role === "doctor" ? 4 : 5}
              </p>
              <h1 className="mt-2 font-display text-[1.9rem] leading-tight text-gradient-alabaster sm:text-[2.3rem]">
                {user.fullName}
              </h1>
            </div>
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-400" />
              Session secure · JWT
            </span>
          </header>
          {children}
        </motion.main>
      </div>
    </div>
  );
}
