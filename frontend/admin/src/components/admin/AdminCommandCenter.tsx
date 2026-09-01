"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMockData, type ComplianceItem } from "@/lib/mock";
import { loadAdminData } from "@/lib/backend";
import { cn, formatDate } from "@/lib/utils";
import { DoctorOversight } from "./DoctorOversight";
import { PatientTracking } from "./PatientTracking";
import { ServicesBookings } from "./ServicesBookings";
import { OperationsSuite } from "./OperationsSuite";
import {
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  LeafIcon,
  StethoscopeIcon,
} from "./ui/icons";
import { Avatar, Kicker } from "./ui/primitives";

type TabKey = "patients" | "doctors" | "services" | "operations";

interface Toast {
  id: number;
  message: string;
}

export function AdminCommandCenter({ todayISO }: { todayISO: string }) {
  const fallbackData = useMemo(() => buildMockData(todayISO), [todayISO]);
  const [data, setData] = useState(fallbackData);
  useEffect(() => {
    setData(fallbackData);
    loadAdminData(fallbackData).then(setData).catch(() => undefined);
  }, [fallbackData]);
  const [tab, setTab] = useState<TabKey>("patients");
  const [items, setItems] = useState<ComplianceItem[]>(data.items);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const notify = useCallback((message: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const openCompliance = items.filter((i) => i.status !== "closed").length;

  const tabs: Array<{
    key: TabKey;
    label: string;
    Icon: typeof ClipboardIcon;
    badge?: number;
  }> = [
    {
      key: "patients",
      label: "Patient Tracking & Compliance",
      Icon: ClipboardIcon,
      badge: openCompliance,
    },
    { key: "doctors", label: "Doctor Oversight", Icon: StethoscopeIcon },
    { key: "services", label: "Services & Bookings", Icon: CalendarIcon },
    { key: "operations", label: "Operations Suite", Icon: CheckCircleIcon },
  ];

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* ––––– Ambient background ––––– */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-44 left-[6%] h-[540px] w-[540px] rounded-full bg-forest-300/25 blur-[130px]" />
        <div className="absolute -right-44 top-[26%] h-[580px] w-[580px] rounded-full bg-forest-200/45 blur-[140px]" />
        <div className="absolute -bottom-56 left-[28%] h-[520px] w-[520px] rounded-full bg-alabaster-300/60 blur-[120px]" />
        <div className="absolute inset-0 noise opacity-[0.05]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
        {/* ––––– Brand bar ––––– */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-800 text-alabaster-50 shadow-lg shadow-forest-900/25">
              <svg viewBox="0 0 36 36" fill="none" className="h-6 w-6">
                <circle cx="18" cy="18" r="15" stroke="rgba(230,205,161,0.5)" strokeWidth="1.5" />
                <circle cx="18" cy="18" r="10.5" stroke="rgba(244,242,232,0.5)" strokeWidth="1" />
                <path d="M18 10.5v15M10.5 18h15" stroke="rgba(244,242,232,0.9)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="18" cy="18" r="3" fill="#c9a26b" />
              </svg>
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-none text-forest-900 uppercase tracking-widest">
                AURELIS
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-forest-500">
                Private Medical Concierge
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-forest-600/20 bg-forest-600/8 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-forest-700 sm:inline-flex">
              Admin Console
            </span>
            <Avatar name="A. Mercer" hue={152} size={38} />
          </div>
        </header>

        {/* ––––– Hero ––––– */}
        <div className="flex flex-col gap-6 pb-9 pt-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Kicker>Phase 05 · Operations</Kicker>
            <h1 className="mt-3 font-display text-[clamp(2.3rem,5vw,3.7rem)] font-semibold leading-[1.04] tracking-tight text-forest-900">
              Admin Command{" "}
              <span className="font-light italic text-forest-600">Center</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-600">
              Patient compliance, physician workloads and service bookings –
              orchestrated from a single, calm vantage point.
            </p>
          </div>
          <div className="glass flex items-center gap-3.5 rounded-2xl px-4 py-3.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-forest-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-forest-600" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
                Live operations
              </p>
              <p className="mt-0.5 text-sm font-semibold text-forest-800">
                {formatDate(data.anchor)}
              </p>
            </div>
          </div>
        </div>

        {/* ––––– Tabs ––––– */}
        <nav className="sticky top-4 z-40 mx-auto mb-10 flex w-fit max-w-full items-center rounded-full p-1 glass">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors sm:px-5 sm:text-sm",
                  active
                    ? "text-forest-950"
                    : "text-sage hover:text-alabaster"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-tab-pill"
                    className="absolute inset-0 rounded-full bg-gradient-to-b from-gold-soft via-gold to-[#b89155] shadow-[0_8px_24px_-8px_rgba(210,174,116,0.7)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <t.Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10 hidden md:inline">{t.label}</span>
                <span className="relative z-10 md:hidden">
                  {t.label.split(" ")[0]}
                </span>
                {t.badge !== undefined && (
                  <span
                    className={cn(
                      "relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      active
                        ? "bg-warn-500 text-white"
                        : t.badge > 0
                          ? "bg-warn-500/15 text-warn-700"
                          : "bg-forest-600/10 text-forest-600"
                    )}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ––––– Active tab content ––––– */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            {tab === "patients" && (
              <PatientTracking
                data={data}
                items={items}
                setItems={setItems}
                notify={notify}
              />
            )}
            {tab === "doctors" && <DoctorOversight data={data} items={items} />}
            {tab === "services" && <ServicesBookings data={data} items={items} />} 
            {tab === "operations" && <OperationsSuite onToast={notify} />}
          </motion.div>
        </AnimatePresence>

        {/* ––––– Footer ––––– */}
        <footer className="mt-16 border-t border-white/60 pt-6">
        </footer>
      </div>

      {/* ––––– Toasts ––––– */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 26, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="glass-deep pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold text-forest-900 shadow-2xl"
            >
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-forest-600" />
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

