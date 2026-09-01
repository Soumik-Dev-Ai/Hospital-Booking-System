import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { patient } from "../data/mock";
import { Icon } from "./Icons";

export type NavView = "hub" | "records";

/** Mirrors the Base Website AuthProvider SESSION_KEY (aurelis.session.v1). */
const SESSION_KEY = "aurelis.session.v1";

interface StoredSession {
  token: string;
  user?: { fullName?: string; role?: string };
}

function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface HeaderProps {
  view: NavView | "booking";
  onNav: (view: NavView) => void;
  onBook: () => void;
}

export default function Header({ view, onNav, onBook }: HeaderProps) {
  const booking = view === "booking";

  return (
    <motion.header
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-forest-950/75 px-3 py-2.5 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:gap-4 md:px-5">
          {/* Brand */}
          <button
            onClick={() => onNav("hub")}
            className="group flex shrink-0 items-center gap-3 rounded-xl px-1.5 py-1 transition-colors hover:bg-alabaster-100/60"
            aria-label="Verdant Health, back to appointments"
          >
            <span className="relative grid h-9 w-9 place-items-center">
              <svg viewBox="0 0 36 36" fill="none" className="h-9 w-9">
                <circle cx="18" cy="18" r="15" stroke="rgba(230,205,161,0.5)" strokeWidth="1" />
                <circle cx="18" cy="18" r="10.5" stroke="rgba(244,242,232,0.18)" strokeWidth="0.75" />
                <path d="M18 10.5v15M10.5 18h15" stroke="rgba(244,242,232,0.9)" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="18" cy="18" r="2.6" fill="#c9a26b" />
              </svg>
              <span className="absolute inset-0 -z-10 rounded-full bg-forest-600/30 blur-md" />
            </span>
            <div className="hidden text-left leading-none sm:block">
              <div className="font-display text-[17px] tracking-wide text-alabaster uppercase">AURELIS</div>
              <div className="mt-1.5 text-[8.5px] font-semibold uppercase tracking-[0.26em] text-sage-dim">
                Private Medical Concierge
              </div>
            </div>
          </button>

          {/* Nav */}
          <nav className="mx-auto hidden items-center gap-1 rounded-full border border-white/70 bg-alabaster-200/55 p-1.5 shadow-[0_18px_50px_-20px_rgba(21,42,33,0.35)] backdrop-blur-2xl sm:flex md:gap-1.5">
            <NavButton active={view === "hub"} label="Appointments" onClick={() => onNav("hub")} />
            <NavButton active={view === "records"} label="Medical Records" onClick={() => onNav("records")} />
          </nav>

          {/* Patient identity */}
          <div className="ml-auto flex items-center gap-2.5">
            <ProfilePill />

            {/* Notification bell */}
            <button
              className="relative hidden h-10 w-10 place-items-center rounded-full border border-white/70 bg-alabaster-200/55 text-forest-700 shadow-sm backdrop-blur-md transition-colors hover:bg-alabaster-100/80 sm:grid"
              aria-label="Notifications"
            >
              <Icon name="bell" size={16} />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-champagne-500 ring-2 ring-alabaster-50" />
            </button>

            {/* Book Appointment CTA – morphs via layoutId */}
            <AnimatePresence mode="popLayout" initial={false}>
              {!booking ? (
                <motion.button
                  key="book"
                  layoutId="book-cta"
                  onClick={onBook}
                  className="group relative overflow-hidden rounded-full bg-forest-800 px-4 py-2.5 text-[13px] font-semibold text-alabaster-100 shadow-lg shadow-forest-900/30 ring-1 ring-white/10 transition-shadow hover:shadow-forest-900/40 md:px-5"
                >
                  <span className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-sheen" />
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon name="plus" size={14} strokeWidth={2.2} />
                    <span className="hidden sm:inline">Book&nbsp;</span>Appointment
                  </span>
                </motion.button>
              ) : (
                <motion.button
                  key="cancel"
                  layoutId="book-cta"
                  onClick={() => onNav("hub")}
                  className="rounded-full border border-forest-900/15 bg-alabaster-100/70 px-4 py-2.5 text-[13px] font-semibold text-forest-900 backdrop-blur-md transition-colors hover:bg-alabaster-100 md:px-5"
                >
                  Cancel
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

/**
 * Interactive profile pill with a dropdown menu.
 *
 * "Return to Home Page" navigates to the Base Website (`/`) with the
 * localStorage session intact; "Log Out" clears the session key first so the
 * Base Website forces fresh credentials on the next visit.
 */
function ProfilePill() {
  const [open, setOpen] = useState(false);
  const [session] = useState(readSession);
  const wrapRef = useRef<HTMLDivElement>(null);

  const displayName = session?.user?.fullName || patient.name;
  const roleLabel = session?.user?.role || "Patient";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const returnHome = () => {
    setOpen(false);
    // Same-origin navigation preserves the localStorage session.
    window.location.href = "/";
  };

  const logOut = () => {
    setOpen(false);
    window.localStorage.removeItem(SESSION_KEY);
    window.location.href = "/";
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2.5 rounded-full border border-white/[0.07] bg-alabaster-100/5 py-1.5 pl-1.5 pr-3 shadow-sm backdrop-blur-md transition-colors hover:bg-alabaster-100/10 md:pr-4"
      >
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-forest-500 to-forest-900 font-display text-[12.5px] text-alabaster-100 shadow ring-1 ring-white/10">
          {initials}
        </div>
        <div className="hidden text-left leading-tight md:block">
          <div className="text-[13px] font-semibold text-alabaster">{displayName}</div>
          <div className="text-[10px] tracking-wide text-sage-dim">{roleLabel}</div>
        </div>
        <Icon
          name="chevron-down"
          size={12}
          className={cn("text-alabaster/60 transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-forest-900/95 p-1.5 text-alabaster-100 shadow-[0_30px_70px_-24px_rgba(10,30,23,0.8)] backdrop-blur-2xl"
          >
            <div className="border-b border-white/10 px-3.5 py-3">
              <div className="text-[13px] font-semibold">{displayName}</div>
              <div className="mt-0.5 text-[10.5px] font-medium text-forest-100/60">
                {patient.plan} · {patient.id}
              </div>
            </div>
            <MenuItem
              icon="arrow-left"
              label="Return to Home Page"
              hint="Back to the Aurelis website"
              onClick={returnHome}
            />
            <MenuItem
              icon="x"
              label="Log Out"
              hint="Ends this session everywhere"
              onClick={logOut}
              danger
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: "arrow-left" | "x";
  label: string;
  hint: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors",
        danger ? "text-alabaster-100/85 hover:bg-red-400/10 hover:text-red-200" : "hover:bg-white/10"
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full border",
          danger
            ? "border-red-300/20 bg-red-400/10 text-red-200/90"
            : "border-white/10 bg-white/5 text-champagne-300"
        )}
      >
        <Icon name={icon} size={14} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{label}</span>
        <span className="block text-[10.5px] font-medium text-forest-100/50">{hint}</span>
      </span>
    </button>
  );
}

function NavButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors duration-300 md:px-4",
        active ? "text-alabaster-50" : "text-forest-700 hover:text-forest-900"
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="absolute inset-0 rounded-full bg-forest-800 shadow-lg shadow-forest-900/30"
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}
