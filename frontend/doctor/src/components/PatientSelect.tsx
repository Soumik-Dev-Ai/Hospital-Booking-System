import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { useWorkspace } from "../lib/store";
import { Avatar } from "./ui";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/*  PatientSelect – solid, high-z, scrollable combobox                 */
/* ------------------------------------------------------------------ */

const DROPDOWN_HEIGHT = 300; // approx open height, used for flip logic

export default function PatientSelect({
  value,
  onChange,
  placeholder = "Select a patient",
}: {
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const { patients } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = patients.find((p) => p.id === value);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(t));
  }, [patients, q]);

  /* close on outside interactions – but NEVER when scrolling the list itself */
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (listRef.current && target && listRef.current.contains(target)) {
        return; // internal scroll of the dropdown list – keep it open
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const flip = spaceBelow < DROPDOWN_HEIGHT;
      setPos({
        top: flip ? Math.max(8, r.top - DROPDOWN_HEIGHT) : r.bottom + 8,
        left: r.left,
        width: r.width,
      });
      setQ("");
    }
    setOpen((o) => !o);
  };

  const dropdown = (
    <AnimatePresence>
      {open && (
        <>
          {/* click catcher */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[75] cursor-default bg-forest-950/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          {/* solid panel */}
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[80] overflow-hidden rounded-2xl border border-white/15 bg-forest-950/95 p-2 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(245,242,234,0.1)] backdrop-blur-2xl"
          >
            {/* header */}
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-[9px] font-semibold tracking-[0.26em] text-sage-dim uppercase">
                Patient ledger
              </span>
              <span className="text-[9px] font-semibold tracking-[0.16em] text-gold-soft/80 uppercase">
                {filtered.length} of {patients.length}
              </span>
            </div>

            {/* inner search */}
            <div className="relative mb-2 px-1">
              <Search
                size={13}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sage-dim"
              />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search patients…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2 pr-3 pl-9 text-[13px] text-alabaster placeholder:text-sage-dim/60 outline-none transition duration-300 focus:border-gold/40"
              />
            </div>

            {/* strict scrollable list */}
            <div
              ref={listRef}
              className="max-h-[250px] overflow-y-auto overscroll-contain pr-1"
            >
              {filtered.map((p) => {
                const active = p.id === value;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200",
                      active
                        ? "bg-gold/[0.1] ring-1 ring-gold/20"
                        : "hover:bg-white/[0.07]"
                    )}
                  >
                    <Avatar name={p.name} hue={p.hue} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-alabaster">
                        {p.name}
                      </span>
                      <span className="block text-[10px] text-sage-dim">
                        {p.gender} · {p.age} ·{" "}
                        {p.insurance.split("·")[0].trim()}
                      </span>
                    </span>
                    {active && <Check size={14} className="text-gold-soft" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-sage-dim">
                  No patient matches "{q}"
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className={cn(
          "glass flex w-full cursor-pointer items-center gap-3 rounded-2xl p-3 text-left transition-colors duration-300",
          open ? "border-white/25" : "hover:border-white/20"
        )}
      >
        {selected ? (
          <>
            <Avatar name={selected.name} hue={selected.hue} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-alabaster">
                {selected.name}
              </span>
              <span className="block text-[10px] tracking-[0.14em] text-sage-dim uppercase">
                {selected.id} · {selected.age} · {selected.blood}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-white/15 text-sage-dim">
              <Search size={14} />
            </span>
            <span className="flex-1 text-[13.5px] text-sage-dim">
              {placeholder}
            </span>
          </>
        )}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-sage"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      {createPortal(dropdown, document.body)}
    </div>
  );
}
