import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import {
  dayLabel,
  downloadText,
  prescriptionToText,
  recordDate,
  reportToText,
  type Checklist,
  type ChecklistItem,
  type Prescription,
  type ServiceRecord,
} from "../data/mock";
import { Icon } from "./Icons";
import {
  Eyebrow,
  Medallion,
  ProgressRing,
  SectionHeading,
  StatusChip,
  fadeUp,
  staggerContainer,
} from "./ui";

type Tab = "all" | "checklists" | "prescriptions" | "records";

const tabs: { id: Tab; label: string; count: number }[] = [
  { id: "all", label: "All", count: 0 },
  { id: "checklists", label: "Checklists", count: 3 },
  { id: "prescriptions", label: "Prescriptions", count: 3 },
  { id: "records", label: "Service Records", count: 3 },
];

interface Props {
  checklists: Checklist[];
  prescriptions: Prescription[];
  records: ServiceRecord[];
  onToggleItem: (checklistId: string, itemIdx: number) => void;
  onSubmitItem: (checklistId: string, itemIdx: number, value: string) => void;
  onSubmitChecklist: (checklistId: string) => void;
  /** Deep-link: which tab to open when arriving from an appointment */
  focusTab?: "prescriptions" | "records" | null;
  /** Deep-link: which document to scroll to & highlight */
  focusId?: string | null;
  onFocusConsumed?: () => void;
}

export default function RecordsView({
  checklists,
  prescriptions,
  records,
  onToggleItem,
  onSubmitItem,
  onSubmitChecklist,
  focusTab,
  focusId,
  onFocusConsumed,
}: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [glowId, setGlowId] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  /* Deep-link focus: switch tab, scroll to the document, pulse-highlight it */
  useEffect(() => {
    if (!focusTab || !focusId) return;
    setTab(focusTab);
    setQuery("");
    const elementId = `${focusTab === "prescriptions" ? "rx-card" : "rec-card"}-${focusId}`;
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setGlowId(focusId);
    }, 480);
    const clearTimer = window.setTimeout(() => {
      setGlowId(null);
      onFocusConsumed?.();
    }, 4300);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusTab, focusId, onFocusConsumed]);

  const q = query.trim().toLowerCase();

  function fireToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  const filteredChecklists = useMemo(
    () =>
      checklists.filter(
        (c) =>
          (c.title + " " + c.for).toLowerCase().includes(q) ||
          c.items.some((i) => i.label.toLowerCase().includes(q))
      ),
    [checklists, q]
  );
  const filteredPrescriptions = useMemo(
    () =>
      prescriptions.filter((p) =>
        (p.medication + " " + p.prescriber + " " + p.rx).toLowerCase().includes(q)
      ),
    [prescriptions, q]
  );
  const filteredRecords = useMemo(
    () =>
      records.filter((r) =>
        (r.title + " " + r.dept + " " + r.refId).toLowerCase().includes(q)
      ),
    [records, q]
  );

  const showChecklists = tab === "all" || tab === "checklists";
  const showPrescriptions = tab === "all" || tab === "prescriptions";
  const showRecords = tab === "all" || tab === "records";

  const nothingFound =
    filteredChecklists.length + filteredPrescriptions.length + filteredRecords.length === 0;

  return (
    <div className="pb-10">
      {/* Heading */}
      <motion.header
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <Eyebrow tone="dark">The vault</Eyebrow>
        <h1 className="mt-2.5 font-display text-4xl font-medium tracking-tight text-forest-950 md:text-5xl">
          Medical records & intake
        </h1>
        <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-forest-600">
          Everything documented in one place: intake checklists, prescriptions and laboratory
          reports, all secured in your personal vault.
        </p>
      </motion.header>

      {/* Controls – search + tabs */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-9 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        {/* Search */}
        <div className="group relative w-full max-w-md">
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-4.5 top-1/2 -translate-y-1/2 text-forest-400 transition-colors group-focus-within:text-forest-700"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records, medications, departments…"
            className="w-full rounded-full border border-white/70 bg-alabaster-200/60 py-3 pl-11 pr-16 text-[13.5px] font-medium text-forest-950 shadow-[0_14px_40px_-20px_rgba(18,43,34,0.3)] backdrop-blur-xl transition-all duration-300 outline-none placeholder:text-forest-400 focus:border-forest-600/40 focus:bg-alabaster-100/90 focus:shadow-[0_18px_50px_-18px_rgba(18,43,34,0.45)]"
          />
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-forest-900/10 bg-alabaster-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-forest-400 sm:block">
            ⌘K
          </kbd>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-1 rounded-full border border-forest-900/8 bg-alabaster-200/50 p-1 backdrop-blur-md">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors duration-300 md:px-4",
                tab === t.id ? "text-alabaster-100" : "text-forest-600 hover:text-forest-950"
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="records-tab"
                  transition={{ type: "spring", bounce: 0.18, duration: 0.55 }}
                  className="absolute inset-0 rounded-full bg-forest-800 shadow-md shadow-forest-900/25"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {t.label}
                {t.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[9.5px] font-bold transition-colors duration-300",
                      tab === t.id
                        ? "bg-alabaster-100/20 text-alabaster-100"
                        : "bg-forest-900/8 text-forest-500"
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ------------------------- Content ------------------------- */}
      {nothingFound ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 rounded-xl border border-dashed border-forest-900/20 bg-alabaster-200/40 px-8 py-14 text-center backdrop-blur-xl"
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest-100 text-forest-600 ring-1 ring-forest-800/10">
            <Icon name="search" size={20} strokeWidth={1.5} />
          </div>
          <h3 className="mt-5 font-display text-xl text-forest-950">No records match</h3>
          <p className="mt-1.5 text-[13px] text-forest-500">
            Try a different keyword or switch category.
          </p>
        </motion.div>
      ) : (
        <div className="mt-12 space-y-14">
          {/* Checklists */}
          {showChecklists && filteredChecklists.length > 0 && (
            <section>
              <SectionHeading
                eyebrow="Intake"
                title="Checklists"
                right={
                  <span className="rounded-full border border-forest-900/10 bg-alabaster-200/60 px-3.5 py-1.5 text-[11.5px] font-semibold text-forest-700 shadow-sm backdrop-blur-md">
                    {filteredChecklists.filter((c) => c.items.every((i) => i.done)).length} of{" "}
                    {filteredChecklists.length} complete
                  </span>
                }
              />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3"
              >
                {filteredChecklists.map((cl) => (
                  <ChecklistCard
                    key={cl.id}
                    checklist={cl}
                    open={expanded === cl.id}
                    onToggleOpen={() => setExpanded(expanded === cl.id ? null : cl.id)}
                    onToggleItem={onToggleItem}
                    onSubmitItem={onSubmitItem}
                    onSubmit={() => {
                      onSubmitChecklist(cl.id);
                      fireToast("Intake submitted. Your care team has been notified.");
                    }}
                  />
                ))}
              </motion.div>
            </section>
          )}

          {/* Prescriptions */}
          {showPrescriptions && filteredPrescriptions.length > 0 && (
            <section>
              <SectionHeading eyebrow="Pharmacy" title="Prescriptions" />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid gap-4 lg:grid-cols-2"
              >
                {filteredPrescriptions.map((p) => (
                  <PrescriptionCard
                    key={p.id}
                    prescription={p}
                    open={expanded === p.id}
                    focused={glowId === p.id}
                    onToggleOpen={() => setExpanded(expanded === p.id ? null : p.id)}
                    onDownload={() => fireToast(`${p.medication} prescription downloaded.`)}
                  />
                ))}
              </motion.div>
            </section>
          )}

          {/* Service records */}
          {showRecords && filteredRecords.length > 0 && (
            <section>
              <SectionHeading eyebrow="Diagnostics" title="Test & service records" />
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid gap-4 lg:grid-cols-2"
              >
                {filteredRecords.map((r) => (
                  <ServiceRecordCard
                    key={r.id}
                    record={r}
                    open={expanded === r.id}
                    focused={glowId === r.id}
                    onToggleOpen={() => setExpanded(expanded === r.id ? null : r.id)}
                    onDownload={() => fireToast(`${r.title} report downloaded.`)}
                  />
                ))}
              </motion.div>
            </section>
          )}
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <div key="toast" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="flex items-center gap-2.5 rounded-full bg-forest-900 py-3 pl-3.5 pr-5 text-[12.5px] font-semibold text-alabaster-100 shadow-[0_24px_60px_-16px_rgba(10,30,23,0.7)] ring-1 ring-white/10"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-champagne-400/15 text-champagne-300">
                <Icon name="check" size={12} strokeWidth={3} />
              </span>
              {toast}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ Cards ------------------------------ */

function ChecklistCard({
  checklist,
  open,
  onToggleOpen,
  onToggleItem,
  onSubmitItem,
  onSubmit,
}: {
  checklist: Checklist;
  open: boolean;
  onToggleOpen: () => void;
  onToggleItem: (checklistId: string, itemIdx: number) => void;
  onSubmitItem: (checklistId: string, itemIdx: number, value: string) => void;
  onSubmit: () => void;
}) {
  const done = checklist.items.filter((i) => i.done).length;
  const total = checklist.items.length;
  const complete = done === total;
  const pct = total ? done / total : 0;

  return (
    <motion.article
      variants={fadeUp}
      className={cn(
        "flex h-full flex-col rounded-xl border bg-alabaster-200/55 p-6 shadow-[0_24px_60px_-32px_rgba(18,43,34,0.35)] backdrop-blur-xl transition-all duration-500",
        complete
          ? "border-forest-600/30"
          : "border-white/60 hover:-translate-y-1 hover:shadow-[0_36px_70px_-32px_rgba(18,43,34,0.45)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Medallion icon="list" tone={complete ? "champagne" : "forest"} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-400">
              For {checklist.for} · due {dayLabel(checklist.dueOffset).toLowerCase()}
            </p>
            <h3 className="mt-1 font-display text-[1.15rem] font-medium leading-snug text-forest-950">
              {checklist.title}
            </h3>
          </div>
        </div>
        <div className="relative">
          <ProgressRing pct={pct} />
          <span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-forest-600">
            {done}/{total}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {checklist.submitted ? (
          <StatusChip tone="green" icon="check">Submitted</StatusChip>
        ) : complete ? (
          <StatusChip tone="champagne" icon="file">Ready to submit</StatusChip>
        ) : (
          <StatusChip tone="muted">{done} of {total} items</StatusChip>
        )}
        <button
          onClick={onToggleOpen}
          className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-forest-600 transition-colors hover:text-forest-950"
        >
          {open ? "Hide" : "Fill in"}
          <Icon name="chevron-down" size={13} className={cn("transition-transform duration-300", open && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="items"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-1.5 border-t border-forest-900/8 pt-4">
              {checklist.items.map((item, idx) => (
                <ChecklistItemRow
                  key={idx}
                  item={item}
                  disabled={!!checklist.submitted}
                  onToggleDone={() => onToggleItem(checklist.id, idx)}
                  onSubmitValue={(value) => onSubmitItem(checklist.id, idx, value)}
                />
              ))}

              <div className="mt-3 flex items-center justify-between gap-3 pl-2.5">
                <span className="text-[11px] font-medium text-forest-400">
                  {complete ? "All items complete. Beautifully done." : `${total - done} to go`}
                </span>
                <button
                  disabled={!complete || checklist.submitted}
                  onClick={onSubmit}
                  className={cn(
                    "rounded-full px-4 py-2 text-[12px] font-bold transition-all duration-300",
                    complete && !checklist.submitted
                      ? "bg-forest-800 text-alabaster-100 shadow-lg shadow-forest-900/25 hover:bg-forest-700"
                      : "cursor-not-allowed bg-forest-900/5 text-forest-400"
                  )}
                >
                  {checklist.submitted ? "Submitted ✓" : "Submit to care team"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/*  Checklist item row – inline answer editor with check + strike      */
/* ------------------------------------------------------------------ */

function ChecklistItemRow({
  item,
  disabled,
  onToggleDone,
  onSubmitValue,
}: {
  item: ChecklistItem;
  disabled: boolean;
  onToggleDone: () => void;
  onSubmitValue: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item.value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 170);
    return () => window.clearTimeout(id);
  }, [open]);

  function openEditor() {
    if (disabled) return;
    setDraft(item.value ?? "");
    setOpen(true);
  }

  function submit() {
    const v = draft.trim();
    if (!v) return;
    onSubmitValue(v);
    setOpen(false);
  }

  return (
    <div>
      {/* Row */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors duration-300",
          !disabled && "hover:bg-forest-900/[0.04]",
          open && "bg-forest-900/[0.04]"
        )}
      >
        {/* Checkbox – draw-in check when done, click to undo */}
        <button
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (item.done) onToggleDone();
            else openEditor();
          }}
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all duration-300",
            item.done
              ? "border-forest-700 bg-forest-700 shadow-sm"
              : "border-forest-900/25 bg-alabaster-100/70 hover:border-forest-600/50 hover:shadow-sm",
            disabled && "cursor-default"
          )}
          aria-label={item.done ? "Mark as incomplete" : "Complete this item"}
        >
          {item.done && (
            <motion.svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-alabaster-100">
              <motion.path
                d="M20 6 9 17l-5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </motion.svg>
          )}
        </button>

        {/* Label – strike sweeps across on completion */}
        <button
          disabled={disabled}
          onClick={openEditor}
          className="min-w-0 flex-1 text-left"
          aria-label={item.label}
        >
          <span
            className={cn(
              "relative inline-block text-[13px] font-medium leading-relaxed transition-colors duration-300",
              item.done ? "text-forest-400" : "text-forest-800"
            )}
          >
            {item.label}
            <AnimatePresence>
              {item.done && (
                <motion.span
                  key="strike"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  exit={{ scaleX: 0, opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ delay: 0.16, duration: 0.42, ease: [0.65, 0, 0.35, 1] }}
                  className="absolute left-0 top-1/2 h-[1.5px] w-full origin-left -translate-y-1/2 rounded-full bg-forest-500/70"
                />
              )}
            </AnimatePresence>
          </span>

          {/* Saved answer */}
          <AnimatePresence>
            {item.done && item.value && (
              <motion.span
                key="value"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ delay: 0.32, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="mt-0.5 block text-[11.5px] italic leading-relaxed text-forest-500"
              >
                "{item.value}"
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Inline answer editor – slides open beneath the item */}
      <AnimatePresence initial={false}>
        {open && !disabled && (
          <motion.div
            key="editor"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-[2.75rem] mb-1.5 mt-1 flex items-center gap-2 pr-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder={item.placeholder ?? "Type your answer…"}
                className="min-w-0 flex-1 rounded-full border border-forest-900/15 bg-alabaster-100/90 px-4 py-2.5 text-[13px] font-medium text-forest-950 shadow-inner outline-none transition-all duration-300 placeholder:font-normal placeholder:text-forest-400 focus:border-forest-600/50 focus:bg-alabaster-50 focus:shadow-[0_12px_30px_-14px_rgba(18,43,34,0.5)]"
              />
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={submit}
                disabled={!draft.trim()}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2.5 text-[12px] font-bold transition-all duration-300",
                  draft.trim()
                    ? "bg-forest-800 text-alabaster-100 shadow-lg shadow-forest-900/25 hover:bg-forest-700"
                    : "cursor-not-allowed bg-forest-900/6 text-forest-400"
                )}
              >
                Submit
              </motion.button>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-forest-400 transition-colors hover:bg-forest-900/5 hover:text-forest-700"
                aria-label="Close"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <p className="ml-[2.75rem] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-400">
              Enter to submit · Esc to cancel
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PrescriptionCard({
  prescription,
  open,
  focused,
  onToggleOpen,
  onDownload,
}: {
  prescription: Prescription;
  open: boolean;
  focused?: boolean;
  onToggleOpen: () => void;
  onDownload: () => void;
}) {
  const p = prescription;
  return (
    <motion.article
      id={`rx-card-${p.id}`}
      variants={fadeUp}
      className={cn(
        "relative overflow-hidden rounded-xl border border-forest-900/10 bg-gradient-to-br from-alabaster-50 via-white/70 to-alabaster-200/80 p-6 shadow-[0_24px_60px_-32px_rgba(18,43,34,0.35)] transition-all duration-500 hover:-translate-y-1",
        focused && "animate-glow-pulse ring-2 ring-champagne-400/70"
      )}
    >
      {/* watermark */}
      <span className="pointer-events-none absolute -right-3 -top-8 select-none font-display text-[7rem] leading-none text-forest-900/[0.05]">
        ℞
      </span>
      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-forest-600/40 to-transparent" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-forest-800 text-alabaster-100 shadow-md ring-1 ring-forest-900/20">
            <Icon name="pill" size={16} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-400">
              Rx · {p.rx} · {recordDate(p.dayOffset)}
            </p>
            <h3 className="mt-1 font-display text-xl font-medium italic text-forest-950">
              {p.medication}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-forest-600/10 px-2.5 py-1 text-[10.5px] font-semibold text-forest-700 ring-1 ring-forest-600/15 sm:inline-flex">
            {p.refills > 0 ? `${p.refills} refill${p.refills > 1 ? "s" : ""} left` : "No refills"}
          </span>
          <button
            onClick={() => {
              downloadText(`${p.rx}-${p.medication.replace(/\s+/g, "-")}.txt`, prescriptionToText(p));
              onDownload();
            }}
            className="flex items-center gap-1.5 rounded-full border border-forest-900/15 bg-alabaster-100/70 px-3.5 py-2 text-[11.5px] font-bold text-forest-800 backdrop-blur-sm transition-all duration-300 hover:bg-forest-800 hover:text-alabaster-100"
          >
            <Icon name="download" size={13} strokeWidth={2} />
            Download
          </button>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-[13px] font-medium text-forest-700">
        <Icon name="clock" size={14} className="text-forest-400" />
        {p.dosage}
      </div>
      <p className="relative mt-1.5 text-[12px] font-medium text-forest-500">
        Prescribed by {p.prescriber} · {p.dept}
      </p>

      <button
        onClick={onToggleOpen}
        className="relative mt-3.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-forest-500 transition-colors hover:text-forest-900"
      >
        {open ? "Hide notes" : "Clinical notes"}
        <Icon name="chevron-down" size={12} className={cn("transition-transform duration-300", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="notes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="relative mt-3 rounded-2xl border border-forest-900/8 bg-alabaster-50/80 px-4 py-3 text-[12px] italic leading-relaxed text-forest-600">
              {p.notes}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function ServiceRecordCard({
  record,
  open,
  focused,
  onToggleOpen,
  onDownload,
}: {
  record: ServiceRecord;
  open: boolean;
  focused?: boolean;
  onToggleOpen: () => void;
  onDownload: () => void;
}) {
  const r = record;
  return (
    <motion.article
      id={`rec-card-${r.id}`}
      variants={fadeUp}
      className={cn(
        "rounded-xl border border-white/60 bg-alabaster-200/55 p-6 shadow-[0_24px_60px_-32px_rgba(18,43,34,0.35)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1",
        focused && "animate-glow-pulse ring-2 ring-champagne-400/70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Medallion
            icon={r.dept === "Imaging" ? "scan" : r.dept === "Cardiology" ? "activity" : "droplet"}
            tone={r.dept === "Imaging" ? "champagne" : "forest"}
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-400">
              {r.refId} · {r.dept} · {recordDate(r.dayOffset)}
            </p>
            <h3 className="mt-1 font-display text-[1.15rem] font-medium leading-snug text-forest-950">
              {r.title}
            </h3>
          </div>
        </div>
        <StatusChip tone="green" icon="check">{r.status}</StatusChip>
      </div>

      {/* Metrics */}
      <div className="mt-4 divide-y divide-forest-900/6 rounded-2xl border border-forest-900/8 bg-alabaster-50/70">
        {r.metrics.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <span className="text-[12px] font-medium text-forest-600">{m.label}</span>
            <span className="flex items-baseline gap-2.5">
              <span className="text-[10px] font-medium text-forest-400">ref {m.ref}</span>
              <span className="min-w-[4.5rem] text-right font-display text-[15px] font-medium text-forest-950">
                {m.value}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-1.5 text-[11.5px] font-semibold text-forest-500 transition-colors hover:text-forest-900"
        >
          {open ? "Hide physician's note" : "Physician's note"}
          <Icon name="chevron-down" size={12} className={cn("transition-transform duration-300", open && "rotate-180")} />
        </button>
        <button
          onClick={() => {
            downloadText(`${r.refId}-${r.title.replace(/\s+/g, "-")}.txt`, reportToText(r));
            onDownload();
          }}
          className="flex items-center gap-1.5 rounded-full border border-forest-900/15 bg-alabaster-100/70 px-3.5 py-2 text-[11.5px] font-bold text-forest-800 backdrop-blur-sm transition-all duration-300 hover:bg-forest-800 hover:text-alabaster-100"
        >
          <Icon name="download" size={13} strokeWidth={2} />
          Download report
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="note"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="mt-3 rounded-2xl border border-forest-900/8 bg-champagne-400/10 px-4 py-3 text-[12px] italic leading-relaxed text-forest-700">
              {r.note}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
