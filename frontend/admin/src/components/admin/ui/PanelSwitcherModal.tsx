"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface PanelOption {
  id: "admin" | "doctor" | "patient";
  title: string;
  badge: string;
  description: string;
  route: string;
  color: string;
  active: boolean;
  icon: ReactNode;
}

export function PanelSwitcherModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);

  const panels: PanelOption[] = [
    {
      id: "admin",
      title: "Admin Command Center",
      badge: "ACTIVE",
      description: "Operations suite, live audit ledger, staff & system health telemetry",
      route: "/admin/",
      color: "#e6cda1",
      active: true,
      icon: (
        <svg className="h-5 w-5 text-champagne-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: "doctor",
      title: "Doctor Oversight & Clinical Desk",
      badge: "SWITCH",
      description: "Patient appointment queue, clinical intake triage & prescription approvals",
      route: "/doctor/",
      color: "#9fc9ab",
      active: false,
      icon: (
        <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
    {
      id: "patient",
      title: "Patient Concierge Portal",
      badge: "SWITCH",
      description: "Concierge booking flow, health records vault & pre-consultation intake",
      route: "/patient/",
      color: "#6ee7b7",
      active: false,
      icon: (
        <svg className="h-5 w-5 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const handleSelect = (panel: PanelOption) => {
    if (panel.active) {
      onClose();
      return;
    }
    setTransitioningTo(panel.title);
    setTimeout(() => {
      window.location.href = panel.route;
    }, 480);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:pt-24 bg-forest-950/40 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="relative w-full max-w-lg rounded-3xl border border-white/70 bg-gradient-to-b from-[#0a1711] to-[#050e0a] p-6 text-alabaster-50 shadow-2xl shadow-forest-950/60 ring-1 ring-white/10"
              initial={{ opacity: 0, scale: 0.93, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -12 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-800/80 ring-1 ring-champagne-400/30">
                    <svg viewBox="0 0 36 36" fill="none" className="h-5 w-5">
                      <circle cx="18" cy="18" r="15" stroke="rgba(230,205,161,0.6)" strokeWidth="1.5" />
                      <circle cx="18" cy="18" r="10.5" stroke="rgba(244,242,232,0.6)" strokeWidth="1" />
                      <path d="M18 10.5v15M10.5 18h15" stroke="rgba(244,242,232,0.95)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-base font-semibold tracking-wide text-alabaster-50">
                      Master Panel Switcher
                    </h3>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-forest-400">
                      hospitalbookingsystem.0512@gmail.com
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-forest-400 hover:bg-white/10 hover:text-alabaster-50 transition"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Instructions */}
              <p className="mt-3 text-xs text-alabaster-200/70">
                Universal master privileges verified. Select any portal to switch contexts with zero re-authentication.
              </p>

              {/* Option Cards */}
              <div className="mt-4 space-y-2.5">
                {panels.map((p) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    whileHover={{ scale: 1.02, x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`group relative flex w-full items-start gap-3.5 rounded-2xl border p-3.5 text-left transition-all ${
                      p.active
                        ? "border-champagne-400/40 bg-white/[0.08] shadow-inner"
                        : "border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-900/90 ring-1 ring-white/10 group-hover:scale-105 transition-transform">
                      {p.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-alabaster-50 group-hover:text-champagne-300 transition-colors">
                          {p.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
                            p.active
                              ? "bg-champagne-400/20 text-champagne-300 border border-champagne-400/30"
                              : "bg-white/10 text-forest-300 border border-white/10 group-hover:bg-emerald-500/20 group-hover:text-emerald-300"
                          }`}
                        >
                          {p.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-alabaster-200/60">
                        {p.description}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Footer hint */}
              <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-forest-400">
                <span>Click outside or Esc to dismiss</span>
                <span className="text-champagne-400/80 font-medium">RBAC Universal Bypass Active</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen smooth dissolve transition */}
      <AnimatePresence>
        {transitioningTo && (
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050e0a]/90 backdrop-blur-2xl text-alabaster-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center"
            >
              {/* Golden Rotating Ring */}
              <div className="relative mb-6 h-16 w-16">
                <div className="absolute inset-0 rounded-full border-2 border-champagne-400/20 animate-ping" />
                <div className="h-16 w-16 rounded-full border-3 border-champagne-400/25 border-t-champagne-300 animate-spin" />
              </div>

              <h4 className="font-display text-2xl font-semibold tracking-wide text-champagne-200">
                Switching Context
              </h4>
              <p className="mt-2 text-xs font-mono uppercase tracking-widest text-forest-300">
                Loading {transitioningTo}...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
