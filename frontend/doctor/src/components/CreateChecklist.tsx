import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,

  Star,
  Trash2,
} from "lucide-react";
import { useWorkspace, type ActionIntent } from "../lib/store";
import PatientSelect from "./PatientSelect";
import { IconTile } from "./ui";
import { cn } from "../utils/cn";

const uid = () => Math.random().toString(36).slice(2, 8);

interface ItemRow {
  id: string;
  label: string;
  required: boolean;
}

const TEMPLATES: {
  id: string;
  label: string;
  title: string;
  items: string[];
}[] = [
  {
    id: "intake",
    label: "Neurology Intake",
    title: "Pre-Consultation Intake",
    items: [
      "Sleep quality over 7 nights",
      "Headache frequency log",
      "Trigger foods & stimulants",
      "Current medication list",
      "Recent imaging (if any)",
    ],
  },
  {
    id: "screening",
    label: "Pre-Visit Screening",
    title: "Pre-Visit Health Screening",
    items: [
      "Blood pressure readings (3×)",
      "Fasting glucose",
      "Daily step count",
      "Mood & energy journal",
    ],
  },
  {
    id: "medication",
    label: "Medication Review",
    title: "Medication Adherence Check",
    items: [
      "Morning medication log",
      "Evening medication log",
      "Missed-dose record",
      "Side-effect notes",
    ],
  },
];

export default function CreateChecklist({
  intent,
}: {
  intent: ActionIntent | null;
}) {
  const { patients, assignChecklist } = useWorkspace();

  const [patientId, setPatientId] = useState<string | null>(
    intent?.mode === "checklist" ? intent.patientId : null
  );
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { id: uid(), label: "", required: true },
  ]);
  const [phase, setPhase] = useState<"form" | "sending" | "done">("form");
  const [summary, setSummary] = useState<{
    title: string;
    count: number;
    patientName: string;
  } | null>(null);

  useEffect(() => {
    if (intent?.mode === "checklist") setPatientId(intent.patientId);
  }, [intent]);

  const patient = patientId ? patients.find((p) => p.id === patientId) : undefined;
  const validItems = items.filter((i) => i.label.trim());
  const canSubmit = !!patientId && title.trim().length > 1 && validItems.length > 0;

  const updateItem = (id: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  const applyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    setTitle(tpl.title);
    setItems(
      tpl.items.map((label, idx) => ({
        id: uid() + idx,
        label,
        required: idx < tpl.items.length - 1,
      }))
    );
  };

  const submit = () => {
    if (!canSubmit || !patient) return;
    setPhase("sending");
    window.setTimeout(() => {
      assignChecklist(patient.id, {
        title: title.trim(),
        items: validItems.map((i) => ({
          label: i.label.trim(),
          required: i.required,
        })),
      });
      setSummary({
        title: title.trim(),
        count: validItems.length,
        patientName: patient.name,
      });
      setPhase("done");
    }, 950);
  };

  const reset = () => {
    setPhase("form");
    setSummary(null);
    setTitle("");
    setItems([{ id: uid(), label: "", required: true }]);
  };

  return (
    <div className="glass flex h-full flex-col rounded-3xl p-6 sm:p-7">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4">
        <IconTile tone="mint" className="h-12 w-12">
          <ClipboardList size={19} />
        </IconTile>
        <div className="min-w-0">
          <h2 className="font-display text-2xl text-alabaster">
            Create Checklist
          </h2>
          <p className="mt-0.5 text-xs text-sage">
            Build & assign a medical checklist to a patient.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="field-label">Patient</label>
          <PatientSelect value={patientId} onChange={setPatientId} />
        </div>

        <AnimatePresence mode="wait">
          {phase === "done" && summary ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="space-y-4"
            >
              <div className="glass-inset rounded-2xl p-6 text-center">
                <motion.span
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                  className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-mint/30 bg-mint/10 text-mint"
                >
                  <CheckCircle2 size={24} />
                </motion.span>
                <h3 className="mt-4 font-display text-xl text-alabaster">
                  Checklist assigned
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-sage">
                  â€Å"{summary.title}â€Â · {summary.count} item
                  {summary.count === 1 ? "" : "s"} · sent to{" "}
                  <span className="font-semibold text-alabaster">
                    {summary.patientName}
                  </span>
                </p>
                <p className="mt-2 text-[11px] text-sage-dim">
                  The patient will see it in their dashboard. Status:{" "}
                  <span className="text-amber">pending patient input</span>.
                </p>
              </div>
              <button onClick={reset} className="btn-ghost w-full">
                <Plus size={14} />
                Create another checklist
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -14 }}
              className="space-y-5"
            >
              {/* title */}
              <div>
                <label className="field-label">Checklist title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Pre-Consultation Sleep Log"
                  className="field-input"
                />
              </div>

              {/* templates */}
              <div>
                <label className="field-label">Quick templates</label>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => (
                    <motion.button
                      key={t.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => applyTemplate(t)}
                      className="cursor-pointer rounded-full border border-gold/25 bg-gold/[0.07] px-3 py-1.5 text-[11px] font-medium text-gold-soft transition-colors hover:border-gold/45 hover:bg-gold/[0.12]"
                    >
                      {t.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* items */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="field-label mb-0">Checklist items</label>
                  <span className="text-[10px] tracking-[0.16em] text-sage-dim uppercase">
                    {validItems.length} item{validItems.length === 1 ? "" : "s"} ·{" "}
                    {items.filter((i) => i.label.trim() && i.required).length}{" "}
                    required
                  </span>
                </div>
                <div className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {items.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ type: "spring", stiffness: 340, damping: 30 }}
                        className="glass-inset flex items-center gap-2 rounded-xl p-2"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-[10px] font-semibold text-sage-dim">
                          {idx + 1}
                        </span>
                        <input
                          value={item.label}
                          onChange={(e) =>
                            updateItem(item.id, { label: e.target.value })
                          }
                          placeholder={`Item ${idx + 1} — e.g. Nightly sleep hours`}
                          className="field-input flex-1 rounded-lg py-2"
                        />
                        <button
                          onClick={() =>
                            updateItem(item.id, { required: !item.required })
                          }
                          title={
                            item.required
                              ? "Required — click to make optional"
                              : "Optional — click to make required"
                          }
                          className={cn(
                            "grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border transition-all duration-300",
                            item.required
                              ? "border-gold/40 bg-gold/10 text-gold-soft"
                              : "border-white/10 text-sage-dim hover:border-white/25"
                          )}
                        >
                          <Star size={13} fill={item.required ? "currentColor" : "none"} />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/10 text-sage-dim transition hover:border-crimson/40 hover:text-crimson disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Remove item"
                        >
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      { id: uid(), label: "", required: false },
                    ])
                  }
                  className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-medium text-sage transition hover:border-mint/40 hover:text-mint"
                >
                  <Plus size={14} />
                  Add item
                </button>
              </div>

              {/* submit */}
              <motion.button
                whileTap={canSubmit ? { scale: 0.97 } : undefined}
                onClick={submit}
                disabled={!canSubmit || phase === "sending"}
                className="btn-emerald w-full py-3.5"
              >
                {phase === "sending" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Assigning checklist…
                  </>
                ) : (
                  <>
                    <ClipboardList size={16} />
                    Assign checklist to patient
                  </>
                )}
              </motion.button>
              {!canSubmit && (
                <p className="text-center text-[10.5px] text-sage-dim">
                  Select a patient, name the checklist and add at least one
                  item.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
