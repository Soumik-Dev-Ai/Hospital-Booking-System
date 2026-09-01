import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  type HTMLMotionProps,
} from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Icon, type IconProps } from "./Icons";

/* ------------------------------------------------------------------ */
/*  3D pop-out tilt card – perspective + spring-smoothed rotation      */
/* ------------------------------------------------------------------ */

export function TiltCard({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & HTMLMotionProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 22 });
  const sry = useSpring(ry, { stiffness: 180, damping: 22 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(30);
  const glare = useMotionTemplate`radial-gradient(480px circle at ${gx}% ${gy}%, rgba(255,255,255,0.24), transparent 55%)`;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 9);
    rx.set(-(py - 0.5) * 7);
    gx.set(px * 100);
    gy.set(py * 100);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <div style={{ perspective: 1300 }} className={cn("h-full", className)}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
        className="relative h-full"
        {...rest}
      >
        {children}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{ background: glare }}
        />
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Medallion – circular icon badge with tonal variants                */
/* ------------------------------------------------------------------ */

const tones = {
  forest: "from-forest-700 to-forest-950 text-alabaster-100 ring-forest-900/20",
  mint: "from-forest-100 to-forest-200 text-forest-800 ring-forest-800/10",
  champagne: "from-champagne-300 to-champagne-500 text-forest-950 ring-champagne-600/20",
  ghost: "from-white/15 to-white/5 text-champagne-300 ring-white/20",
} as const;

export function Medallion({
  icon,
  tone = "forest",
  size = "md",
  className,
}: {
  icon: IconProps["name"];
  tone?: keyof typeof tones;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const iconSize = size === "sm" ? 15 : size === "lg" ? 22 : 17;
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br shadow-lg ring-1",
        tones[tone],
        dims,
        className
      )}
    >
      <Icon name={icon} size={iconSize} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Monogram – serif initials badge                                    */
/* ------------------------------------------------------------------ */

export function Monogram({ initials, className }: { initials: string; className?: string }) {
  return (
    <div
      className={cn(
        "grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-forest-600 via-forest-800 to-forest-950 font-display text-[15px] tracking-wide text-alabaster-100 shadow-lg ring-1 ring-forest-900/25",
        className
      )}
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Eyebrow – small-caps label with a hairline                         */
/* ------------------------------------------------------------------ */

export function Eyebrow({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 text-[10.5px] font-semibold uppercase tracking-[0.26em]",
        tone === "light" ? "text-champagne-300" : "text-forest-500",
        className
      )}
    >
      <span
        className={cn(
          "h-px w-7",
          tone === "light" ? "bg-champagne-300/70" : "bg-forest-500/60"
        )}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section heading                                                    */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  right,
  tone = "dark",
}: {
  eyebrow: string;
  title: ReactNode;
  right?: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <h2
          className={cn(
            "mt-2.5 font-display text-2xl font-medium tracking-tight md:text-[2rem] md:leading-tight",
            tone === "light" ? "text-alabaster-100" : "text-forest-950"
          )}
        >
          {title}
        </h2>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status chip                                                        */
/* ------------------------------------------------------------------ */

export function StatusChip({
  children,
  tone = "green",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: "green" | "champagne" | "muted";
  icon?: IconProps["name"];
  className?: string;
}) {
  const styles = {
    green: "bg-forest-600/10 text-forest-700 ring-forest-600/25",
    champagne: "bg-champagne-400/15 text-champagne-600 ring-champagne-500/30",
    muted: "bg-forest-950/5 text-forest-600 ring-forest-900/10",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold tracking-wide ring-1",
        styles,
        className
      )}
    >
      {icon && <Icon name={icon} size={11} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress ring                                                      */
/* ------------------------------------------------------------------ */

export function ProgressRing({
  pct,
  size = 46,
  stroke = 3.5,
}: {
  pct: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        className="stroke-forest-900/10"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="stroke-forest-600"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated check (SVG path draw)                                     */
/* ------------------------------------------------------------------ */

export function DrawCheck({ className, size = 52 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 52 52" width={size} height={size} className={className} aria-hidden>
      <motion.circle
        cx="26"
        cy="26"
        r="23"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      <motion.path
        d="M15.5 27l7.5 7.5L37 19.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.55, duration: 0.4, ease: "easeOut" }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Stagger helpers                                                    */
/* ------------------------------------------------------------------ */

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};
