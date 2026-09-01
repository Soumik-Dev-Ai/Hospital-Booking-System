import type { ReactNode } from "react";
import type { AppointmentStatus } from "../lib/mock";
import { cn } from "../utils/cn";

/* ------------------------------- avatar ------------------------------ */

const AVATAR_SIZES = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-2xl",
} as const;

export function Avatar({
  name,
  hue = 152,
  size = "md",
  className,
}: {
  name: string;
  hue?: number;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const initials = name
    .replace("Dr. ", "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className={cn("relative shrink-0", AVATAR_SIZES[size], className)}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-display font-semibold text-alabaster"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 36% 47%), hsl(${(hue + 52) % 360} 32% 23%))`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -6px 12px rgba(0,0,0,0.28)",
        }}
      >
        {initials}
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-full border border-white/20" />
    </div>
  );
}

/* -------------------------------- pill ------------------------------- */

type PillTone =
  | "gold"
  | "mint"
  | "amber"
  | "crimson"
  | "sage"
  | "alabaster";

const PILL_TONES: Record<PillTone, string> = {
  gold: "border-gold/25 bg-gold/10 text-gold-soft",
  mint: "border-mint/25 bg-mint/10 text-mint",
  amber: "border-amber/30 bg-amber/10 text-amber",
  crimson: "border-crimson/30 bg-crimson/10 text-crimson",
  sage: "border-white/12 bg-white/[0.05] text-sage",
  alabaster: "border-white/15 bg-alabaster/10 text-alabaster",
};

export function Pill({
  tone = "sage",
  icon,
  children,
  className,
}: {
  tone?: PillTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium tracking-wide whitespace-nowrap",
        PILL_TONES[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* ---------------------------- section label --------------------------- */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold tracking-[0.26em] text-sage-dim uppercase">
        {children}
      </span>
      <span className="hairline flex-1" />
    </div>
  );
}

/* ------------------------------ icon tile ----------------------------- */

export function IconTile({
  children,
  tone = "sage",
  className,
}: {
  children: ReactNode;
  tone?: "gold" | "mint" | "amber" | "crimson" | "sage";
  className?: string;
}) {
  const tones = {
    gold: "border-gold/25 bg-gold/10 text-gold-soft",
    mint: "border-mint/25 bg-mint/10 text-mint",
    amber: "border-amber/30 bg-amber/10 text-amber",
    crimson: "border-crimson/30 bg-crimson/10 text-crimson",
    sage: "border-white/10 bg-white/[0.05] text-sage",
  };
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ status dot ---------------------------- */

export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: "mint" | "gold" | "amber" | "crimson" | "sage";
  pulse?: boolean;
  className?: string;
}) {
  const tones = {
    mint: "bg-mint",
    gold: "bg-gold",
    amber: "bg-amber",
    crimson: "bg-crimson",
    sage: "bg-sage-dim",
  };
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 rounded-full animate-pulse-ring",
            tones[tone]
          )}
        />
      )}
      <span
        className={cn("relative h-2 w-2 rounded-full", tones[tone])}
      />
    </span>
  );
}

/* ---------------------------- status pill ----------------------------- */

export function StatusPill({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  switch (status) {
    case "upcoming":
      return (
        <Pill tone="gold" icon={<StatusDot tone="gold" />} className={className}>
          Upcoming
        </Pill>
      );
    case "in-progress":
      return (
        <Pill tone="mint" icon={<StatusDot tone="mint" pulse />} className={className}>
          In session
        </Pill>
      );
    case "completed":
      return (
        <Pill tone="mint" className={className}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Completed
        </Pill>
      );
    case "cancelled":
      return (
        <Pill tone="sage" className={className}>
          Cancelled
        </Pill>
      );
  }
}

/* -------------------------------- field ------------------------------- */

export function Field({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sage">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[9.5px] font-semibold tracking-[0.2em] text-sage-dim uppercase">
          {label}
        </div>
        <div className="truncate text-[13px] font-medium text-alabaster/90">
          {value}
        </div>
      </div>
    </div>
  );
}
