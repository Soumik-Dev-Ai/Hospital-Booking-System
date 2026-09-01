import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, UploadCloud } from "lucide-react";
import { useWorkspace, type TabId } from "../lib/store";
import { Avatar } from "./ui";
import { cn } from "../utils/cn";

export const TABS: { id: TabId; label: string; short: string; icon: typeof CalendarDays }[] = [
  { id: "schedule", label: "Appointments", short: "Hub", icon: CalendarDays },
  { id: "actions", label: "Action & Uploading", short: "Action", icon: UploadCloud },
];

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

function BrandMark() {
  return (
    <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-forest-500 via-forest-600 to-forest-900 ring-1 ring-white/15">
      <svg viewBox="0 0 36 36" fill="none" className="h-6 w-6">
        <circle cx="18" cy="18" r="15" stroke="rgba(230,205,161,0.5)" strokeWidth="1.5" />
        <circle cx="18" cy="18" r="10.5" stroke="rgba(244,242,232,0.5)" strokeWidth="1" />
        <path d="M18 10.5v15M10.5 18h15" stroke="rgba(244,242,232,0.9)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="18" cy="18" r="3" fill="#c9a26b" />
      </svg>
      <div className="pointer-events-none absolute inset-0 w-1/2 bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.22)_48%,transparent_72%)] animate-shimmer" />
    </div>
  );
}

export default function Header({
  tab,
  onTab,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
}) {
  const { doctor } = useWorkspace();
  const now = useClock();

  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="border-b border-white/[0.07] bg-forest-950/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-[88rem] items-center gap-3 px-4 sm:gap-5 sm:px-6">
          {/* brand */}
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="hidden leading-tight lg:block">
              <div className="font-display text-[15px] tracking-[0.08em] text-alabaster">
                AURELIS
              </div>
              <div className="text-[9px] font-semibold tracking-[0.3em] text-sage-dim uppercase">
                Private Medical Concierge
              </div>
            </div>
          </div>

          <div className="hidden h-8 w-px bg-white/10 xl:block" />

          {/* tabs */}
          <nav className="mx-auto flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/5 p-1 backdrop-blur-md">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => onTab(t.id)}
                  aria-selected={active}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors duration-300 sm:px-5",
                    active
                      ? "text-alabaster-100"
                      : "text-forest-700 hover:text-forest-950"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      transition={{ type: "spring", bounce: 0.18, duration: 0.55 }}
                      className="absolute inset-0 rounded-full bg-forest-800 shadow-md shadow-forest-900/25"
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <Icon size={14} strokeWidth={2.2} />
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.short}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* clock */}
          <div className="hidden text-right leading-tight xl:block">
            <div className="font-display text-[15px] tabular-nums text-alabaster">
              {time}
            </div>
            <div className="text-[9px] font-semibold tracking-[0.24em] text-sage-dim">
              {date}
            </div>
          </div>

          <div className="hidden h-8 w-px bg-white/10 xl:block" />

          {/* doctor */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[13px] font-semibold text-alabaster">
                {doctor.name}
              </div>
              <div className="text-[9px] font-semibold tracking-[0.24em] text-sage-dim uppercase">
                {doctor.specialty} · {doctor.title}
              </div>
            </div>
            <div className="relative">
              <Avatar name={doctor.name} hue={doctor.hue} size="md" />
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-forest-950 bg-mint">
                <span className="absolute inset-0 rounded-full bg-mint animate-pulse-ring" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
