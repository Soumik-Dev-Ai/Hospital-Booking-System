import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "../utils/cn";
import { generateSlotsForOffset, today } from "../data/mock";
import { Icon } from "./Icons";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

interface Calendar3DPopupProps {
  open: boolean;
  optionId: string;
  initialOffset: number;
  onSelect: (offset: number) => void;
  onClose: () => void;
}

/**
 * 3D interactive calendar popup.
 *
 * Folds into view with a perspective + rotateX entry, renders the current
 * month as a standard weekday grid with glassmorphism styling, and reports
 * the chosen date back to the parent as a day offset. Availability dots are
 * derived from the deterministic slot generator so every future day reads as
 * genuinely bookable.
 */
export default function Calendar3DPopup({
  open,
  optionId,
  initialOffset,
  onSelect,
  onClose,
}: Calendar3DPopupProps) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayNum = today.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const cells = useMemo(() => {
    const list: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [firstWeekday, daysInMonth]);

  const availability = useMemo(() => {
    const map = new Map<number, boolean>();
    for (let d = todayNum; d <= daysInMonth; d++) {
      const offset = d - todayNum;
      if (offset <= 0) continue;
      map.set(offset, generateSlotsForOffset(optionId, offset).some((s) => s.free > 0));
    }
    return map;
  }, [optionId, todayNum, daysInMonth]);

  const monthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="calendar-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Pick a date in ${monthLabel}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.22 } }}
          className="fixed inset-0 z-[70] grid place-items-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-forest-950/45 backdrop-blur-sm"
          />
          <div style={{ perspective: 1400 }}>
            <motion.div
              initial={{ rotateX: -38, y: 46, opacity: 0, scale: 0.94 }}
              animate={{ rotateX: 0, y: 0, opacity: 1, scale: 1 }}
              exit={{ rotateX: -22, y: 26, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 250, damping: 26 }}
              className="w-full max-w-sm rounded-2xl border border-forest-900/12 bg-alabaster-50/95 p-5 shadow-[0_50px_120px_-34px_rgba(10,30,23,0.6)] backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-forest-500">
                    Choose a date
                  </div>
                  <div className="mt-0.5 font-display text-[1.25rem] font-medium tracking-tight text-forest-950">
                    {monthLabel}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close calendar"
                  className="grid h-9 w-9 place-items-center rounded-full border border-forest-900/10 bg-alabaster-100 text-forest-600 transition-colors hover:bg-forest-800 hover:text-alabaster-100"
                >
                  <Icon name="x" size={14} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="pb-1 text-center text-[9.5px] font-bold uppercase tracking-wider text-forest-400"
                  >
                    {w}
                  </div>
                ))}
                {cells.map((day, i) => {
                  if (day === null) {
                    return <div key={`blank-${i}`} aria-hidden />;
                  }
                  const offset = day - todayNum;
                  const past = offset < 0;
                  const isToday = offset === 0;
                  const selected = offset === initialOffset;
                  const hasSlots = offset > 0 && availability.get(offset) === true;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={past}
                      onClick={() => onSelect(offset)}
                      className={cn(
                        "relative flex h-11 flex-col items-center justify-center rounded-lg text-[13px] font-semibold transition-all duration-200",
                        past && "cursor-not-allowed text-forest-900/25",
                        !past && !selected && isToday &&
                          "border border-forest-500/50 text-forest-800 hover:bg-forest-600/10",
                        !past && !selected && !isToday &&
                          "text-forest-800 hover:bg-forest-600/10",
                        selected &&
                          "bg-forest-800 text-alabaster-100 shadow-lg shadow-forest-900/30"
                      )}
                    >
                      {day}
                      {!past && !selected && hasSlots && (
                        <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-champagne-500" />
                      )}
                      {selected && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute bottom-1.5 h-1 w-1 rounded-full bg-champagne-300"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-forest-900/8 pt-3.5">
                <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-forest-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-champagne-500" />
                  Slots available
                </span>
                <span className="text-[10.5px] font-medium text-forest-400">
                  Times refresh for the chosen date
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}