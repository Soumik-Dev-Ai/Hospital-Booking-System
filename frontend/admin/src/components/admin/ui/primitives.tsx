"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

/* ––––– Avatar ––––– */

export function Avatar({
  name,
  hue,
  size = 40,
  className,
}: {
  name: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide text-white",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.34)),
        background: `linear-gradient(140deg, hsl(${hue} 42% 58%), hsl(${(hue + 42) % 360} 46% 34%))`,
        boxShadow:
          "inset 0 1.5px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(21,42,33,0.4)",
      }}
    >
      {initials(name)}
    </div>
  );
}

/* ––––– Kicker (small uppercase eyebrow) ––––– */

export function Kicker({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.24em] text-forest-500",
        className
      )}
    >
      {children}
    </p>
  );
}

/* ––––– Status badge ––––– */

export type BadgeTone = "green" | "amber" | "neutral" | "dark";

const BADGE_TONES: Record<BadgeTone, string> = {
  green: "bg-forest-600/10 text-forest-700 border-forest-600/20",
  amber: "bg-warn-500/15 text-warn-700 border-warn-500/30",
  neutral: "bg-ink-900/[0.05] text-ink-600 border-ink-900/10",
  dark: "bg-forest-800 text-alabaster-50 border-forest-800",
};

const BADGE_DOTS: Record<BadgeTone, string> = {
  green: "bg-forest-500",
  amber: "bg-warn-500",
  neutral: "bg-ink-400",
  dark: "bg-alabaster-300",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        BADGE_TONES[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", BADGE_DOTS[tone])} />
      {children}
    </span>
  );
}

/* ––––– Count pill ––––– */

export function Pill({
  tone = "green",
  children,
  className,
}: {
  tone?: "green" | "amber" | "muted";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold",
        tone === "green" &&
          "bg-forest-800 text-alabaster-50 shadow-md shadow-forest-900/20",
        tone === "amber" && "border border-warn-500/30 bg-warn-500/15 text-warn-700",
        tone === "muted" && "border border-ink-900/10 bg-ink-900/[0.04] text-ink-500",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ––––– Glass button ––––– */

type GlassButtonProps = {
  tone?: "primary" | "ghost" | "amber" | "quiet";
  size?: "sm" | "md";
  className?: string;
  children?: ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  onClick?: () => void;
};

export function GlassButton({
  tone = "primary",
  size = "md",
  className,
  children,
  ...rest
}: GlassButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.035, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600",
        size === "sm" ? "px-3.5 py-2 text-xs" : "px-5 py-2.5 text-sm",
        tone === "primary" &&
          "bg-forest-800 text-alabaster-50 shadow-lg shadow-forest-900/25 hover:bg-forest-700",
        tone === "ghost" &&
          "border border-white/80 bg-white/60 text-forest-800 backdrop-blur-xl hover:bg-white/80",
        tone === "amber" &&
          "border border-warn-500/30 bg-warn-500/15 text-warn-700 hover:bg-warn-500/25",
        tone === "quiet" && "text-forest-700 hover:bg-forest-600/10",
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/* ––––– Icon chip ––––– */

export function IconChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ––––– Spring-animated number ––––– */

export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 110, damping: 24, mass: 0.7 });
  const text = useTransform(spring, (v) => Math.round(v).toLocaleString("en-US"));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span className={className}>{text}</motion.span>;
}
