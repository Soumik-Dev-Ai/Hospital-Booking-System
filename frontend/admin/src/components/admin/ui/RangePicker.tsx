"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  buildMonthCells,
  cn,
  formatShort,
  MONTHS,
  parseISODate,
} from "@/lib/utils";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "./icons";
import { GlassButton } from "./primitives";

export interface DateRange {
  start: string;
  end: string;
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function RangePicker({
  value,
  onChange,
  anchor,
  className,
}: {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  anchor: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = parseISODate(value?.start ?? anchor);
    return { y: base.getUTCFullYear(), m: base.getUTCMonth() };
  });
  const [pending, setPending] = useState<{
    start: string;
    end: string | null;
  } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  /* Close on outside click / Escape */
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: globalThis.MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  /* Reset transient selection state when the popover closes */
  useEffect(() => {
    if (!open) {
      setPending(null);
      setHover(null);
    }
  }, [open]);

  const effectiveStart = pending?.start ?? value?.start ?? null;
  const effectiveEnd = pending
    ? pending.end ?? (hover && hover >= pending.start ? hover : null)
    : (value?.end ?? null);

  function commit(range: DateRange | null) {
    onChange(range);
    setPending(null);
    setHover(null);
    setOpen(false);
  }

  function handleDayClick(iso: string) {
    if (!pending) {
      setPending({ start: iso, end: null });
      return;
    }
    if (iso === pending.start) {
      commit({ start: iso, end: iso });
      return;
    }
    if (iso < pending.start) {
      setPending({ start: iso, end: null });
      return;
    }
    commit({ start: pending.start, end: iso });
  }

  function shiftView(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  const presets: Array<{ label: string; value: DateRange | null }> = [
    { label: "Today", value: { start: anchor, end: anchor } },
    { label: "Last 7 days", value: { start: addDays(anchor, -6), end: anchor } },
    { label: "Last 30 days", value: { start: addDays(anchor, -29), end: anchor } },
    { label: "All time", value: null },
  ];

  const label = value
    ? value.start === value.end
      ? formatShort(value.start)
      : `${formatShort(value.start)} – ${formatShort(value.end)}`
    : "All time";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2.5 rounded-full border border-white/80 bg-white/60 py-2.5 pl-4 pr-3 text-sm font-semibold text-forest-800 backdrop-blur-xl transition-colors hover:bg-white/80",
          open && "ring-2 ring-forest-600/25"
        )}
      >
        <CalendarIcon className="h-4 w-4 text-forest-600" />
        <span className="whitespace-nowrap">{label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="flex">
          <ChevronDownIcon className="h-4 w-4 text-ink-400" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="glass-deep absolute right-0 top-[calc(100%+12px)] z-50 w-[min(92vw,672px)] rounded-[26px] p-5"
          >
            {/* Presets */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {presets.map((preset) => {
                const isActive =
                  (preset.value === null && value === null) ||
                  (preset.value !== null &&
                    value !== null &&
                    preset.value.start === value.start &&
                    preset.value.end === value.end);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => commit(preset.value)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-forest-800 text-alabaster-50"
                        : "bg-white/55 text-forest-700 hover:bg-white/85"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => shiftView(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/55 text-forest-700 transition-colors hover:bg-white/90"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => shiftView(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/55 text-forest-700 transition-colors hover:bg-white/90"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Calendars */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <MonthCalendar
                year={view.y}
                month={view.m}
                anchor={anchor}
                start={effectiveStart}
                end={effectiveEnd}
                onPick={handleDayClick}
                onHover={setHover}
              />
              <MonthCalendar
                year={view.m === 11 ? view.y + 1 : view.y}
                month={(view.m + 1) % 12}
                anchor={anchor}
                start={effectiveStart}
                end={effectiveEnd}
                onPick={handleDayClick}
                onHover={setHover}
              />
            </div>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between border-t border-white/60 pt-4">
              <p className="text-xs text-ink-500">
                {effectiveStart && effectiveEnd
                  ? `Selected · ${formatShort(effectiveStart)} – ${formatShort(effectiveEnd)}`
                  : effectiveStart
                    ? `Selected · from ${formatShort(effectiveStart)}`
                    : "Showing every booking"}
              </p>
              <GlassButton size="sm" tone="quiet" onClick={() => commit(null)}>
                Clear range
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ––––– Single month grid ––––– */

function MonthCalendar({
  year,
  month,
  anchor,
  start,
  end,
  onPick,
  onHover,
}: {
  year: number;
  month: number;
  anchor: string;
  start: string | null;
  end: string | null;
  onPick: (iso: string) => void;
  onHover: (iso: string) => void;
}) {
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  return (
    <div>
      <p className="mb-2 px-1 font-display text-[15px] font-semibold text-forest-900">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAY_LABELS.map((d, i) => (
          <span
            key={`${year}-${month}-${i}`}
            className="py-1 text-[10px] font-bold uppercase tracking-wider text-ink-400"
          >
            {d}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (iso === null) {
            return <span key={`empty-${i}`} />;
          }
          const isStart = iso === start;
          const isEnd = iso === end;
          const inRange =
            start !== null &&
            end !== null &&
            iso > start &&
            iso < end &&
            start < end;
          const isToday = iso === anchor;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              onMouseEnter={() => onHover(iso)}
              className={cn(
                "mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-medium transition-all duration-150",
                inRange && "bg-forest-700/90 text-white",
                (isStart || isEnd) &&
                  "rounded-full bg-forest-900 font-semibold text-alabaster-50 shadow-lg shadow-forest-900/30",
                !inRange &&
                  !isStart &&
                  !isEnd &&
                  "text-ink-900 hover:scale-105 hover:bg-forest-600/10",
                isToday &&
                  !isStart &&
                  !isEnd &&
                  "ring-1 ring-inset ring-forest-500/60"
              )}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
