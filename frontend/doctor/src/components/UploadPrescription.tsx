import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Pill,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useWorkspace, type ActionIntent } from "../lib/store";
import { fmtIssued, type Prescription } from "../lib/mock";
import PatientSelect from "./PatientSelect";
import { IconTile } from "./ui";
import { cn } from "../utils/cn";

const FREQUENCIES = ["1× daily", "2× daily", "3× daily", "As needed"];

interface MedRow {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

const uid = () => Math.random().toString(36).slice(2, 8);

export default function UploadPrescription({
  intent,
}: {
  intent: ActionIntent | null;
}) {
  const { patients, patientById, issuePrescription, doctor } = useWorkspace();

  const [patientId, setPatientId] = useState<string | null>(
    intent?.mode === "prescription" ? intent.patientId : null
  );
  const [meds, setMeds] = useState<MedRow[]>([
    { id: uid(), name: "", dosage: "", frequency: "1× daily", duration: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [attached, setAttached] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState<"form" | "issuing" | "done">("form");
  const [issued, setIssued] = useState<Prescription | null>(null);

  useEffect(() => {
    if (intent?.mode === "prescription") setPatientId(intent.patientId);
  }, [intent]);

  const patient = patientId ? patientById(patientId) : undefined;
  const canSubmit =
    !!patientId && (meds.some((m) => m.name.trim()) || !!attached);

  const updateMed = (id: string, patch: Partial<MedRow>) =>
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const removeMed = (id: string) =>
    setMeds((prev) => (prev.length > 1 ? prev.filter((m) => m.id !== id) : prev));

  const submit = () => {
    if (!canSubmit || !patient) return;
    setPhase("issuing");
    window.setTimeout(() => {
      const fileName = attached ?? `RX-${patient.name.toUpperCase().replace(/[^A-Z]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
      const rx = issuePrescription(patient.id, {
        fileName,
        medications: meds
          .filter((m) => m.name.trim())
          .map((m) => ({
            name: m.name.trim(),
            dosage: m.dosage.trim() || "—",
            frequency: m.frequency,
            duration: m.duration.trim() || "30 days",
          })),
        notes: notes.trim() || undefined,
      });
      setIssued(rx);
      setPhase("done");
    }, 1100);
  };

  const reset = () => {
    setPhase("form");
    setIssued(null);
    setAttached(null);
    setNotes("");
    setMeds([
      { id: uid(), name: "", dosage: "", frequency: "1× daily", duration: "" },
    ]);
  };

  return (
    <div className="glass flex h-full flex-col rounded-3xl p-6 sm:p-7">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4">
        <IconTile tone="gold" className="h-12 w-12">
          <FileText size={19} />
        </IconTile>
        <div className="min-w-0">
          <h2 className="font-display text-2xl text-alabaster">
            Upload Prescription
          </h2>
          <p className="mt-0.5 text-xs text-sage">
            Generate & issue an Rx document for any patient in your ledger.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="field-label">Patient</label>
          <PatientSelect value={patientId} onChange={setPatientId} />
        </div>

        <AnimatePresence mode="wait">
          {phase === "done" && issued ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="space-y-5"
            >
              {/* success stamp */}
              <div className="flex items-center gap-3">
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.1 }}
                  className="grid h-9 w-9 place-items-center rounded-full border border-mint/30 bg-mint/10 text-mint"
                >
                  <CheckCircle2 size={18} />
                </motion.span>
                <div>
                  <div className="text-sm font-semibold text-alabaster">
                    Prescription issued to {patients.find((p) => p.id === issued.patientId)?.name}
                  </div>
                  <div className="text-[11px] tracking-[0.16em] text-sage-dim uppercase">
                    The compliance file has been updated
                  </div>
                </div>
              </div>

              {/* document preview */}
              <div className="relative overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[9.5px] font-semibold tracking-[0.3em] text-sage-dim uppercase">
                      Aegis Concierge Medicine
                    </div>
                    <div className="mt-1 font-display text-xl text-alabaster">
                      Prescription · {issued.ref}
                    </div>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/10 font-display text-xs text-gold-soft italic">
                    Æ
                  </span>
                </div>

                <div className="mt-4 grid gap-2 border-y border-white/[0.07] py-4">
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-sage-dim">Patient</span>
                    <span className="font-semibold text-alabaster">
                      {patients.find((p) => p.id === issued.patientId)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-sage-dim">Issued</span>
                    <span className="text-alabaster">{fmtIssued(issued.issuedAt)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="text-sage-dim">Document</span>
                    <span className="text-alabaster">{issued.fileName}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {issued.medications.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-forest-900/40 px-3.5 py-2.5"
                    >
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-alabaster">
                        <Pill size={13} className="text-gold-soft" />
                        {m.name} {m.dosage}
                      </span>
                      <span className="text-[11px] text-sage">
                        {m.frequency} · {m.duration}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-end justify-between">
                  <p className="max-w-[60%] text-[10px] leading-relaxed text-sage-dim italic">
                    {issued.notes ?? "Standard medical disclaimer applies."}
                  </p>
                  <div className="text-right">
                    <div className="font-display text-lg text-gold-soft italic">
                      {doctor.name}
                    </div>
                    <div className="mt-0.5 border-t border-gold/30 pt-1 text-[8.5px] tracking-[0.26em] text-sage-dim uppercase">
                      Physician · {doctor.specialty}
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={reset} className="btn-ghost w-full">
                <Plus size={14} />
                Issue another prescription
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
              {/* medications */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="field-label mb-0">Medications</label>
                  <span className="text-[10px] tracking-[0.16em] text-sage-dim uppercase">
                    {meds.filter((m) => m.name.trim()).length} prescribed
                  </span>
                </div>
                <div className="space-y-2.5">
                  <AnimatePresence initial={false}>
                    {meds.map((m, idx) => (
                      <motion.div
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ type: "spring", stiffness: 340, damping: 30 }}
                        className="glass-inset flex flex-wrap items-center gap-2 rounded-xl p-2"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-[10px] font-semibold text-sage-dim">
                          {idx + 1}
                        </span>
                        <input
                          value={m.name}
                          onChange={(e) => updateMed(m.id, { name: e.target.value })}
                          placeholder="Medication name"
                          className="field-input min-w-[140px] flex-1 rounded-lg py-2"
                        />
                        <input
                          value={m.dosage}
                          onChange={(e) => updateMed(m.id, { dosage: e.target.value })}
                          placeholder="Dose · e.g. 10 mg"
                          className="field-input w-32 rounded-lg py-2"
                        />
                        <select
                          value={m.frequency}
                          onChange={(e) => updateMed(m.id, { frequency: e.target.value })}
                          className="field-input w-30 cursor-pointer rounded-lg py-2 [&>option]:bg-forest-900"
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f}>{f}</option>
                          ))}
                        </select>
                        <input
                          value={m.duration}
                          onChange={(e) => updateMed(m.id, { duration: e.target.value })}
                          placeholder="Duration"
                          className="field-input w-28 rounded-lg py-2"
                        />
                        <button
                          onClick={() => removeMed(m.id)}
                          disabled={meds.length === 1}
                          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-white/10 text-sage-dim transition hover:border-crimson/40 hover:text-crimson disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Remove medication"
                        >
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() =>
                    setMeds((prev) => [
                      ...prev,
                      { id: uid(), name: "", dosage: "", frequency: "1× daily", duration: "" },
                    ])
                  }
                  className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-medium text-sage transition hover:border-gold/40 hover:text-gold-soft"
                >
                  <Plus size={14} />
                  Add medication
                </button>
              </div>

              {/* notes */}
              <div>
                <label className="field-label">Clinical notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Dosage guidance, follow-up instructions…"
                  className="field-input resize-none"
                />
              </div>

              {/* dropzone */}
              <div
                onClick={() =>
                  setAttached(
                    attached
                      ? null
                      : patient
                        ? `RX-${patient.name.toUpperCase().replace(/[^A-Z]+/g, "-").replace(/^-|-$/g, "")}.pdf`
                        : null
                  )
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setAttached(f.name);
                }}
                className={cn(
                  "cursor-pointer rounded-2xl border border-dashed p-4 text-center transition-all duration-300",
                  drag
                    ? "border-gold/60 bg-gold/[0.08]"
                    : attached
                      ? "border-mint/40 bg-mint/[0.05]"
                      : "border-white/15 bg-white/[0.02] hover:border-white/30"
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {attached ? (
                    <motion.div
                      key="file"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-center justify-center gap-2.5 text-[13px] font-medium text-mint"
                    >
                      <FileText size={15} />
                      {attached}
                      <span className="text-[10px] text-sage-dim">
                        · attached — click to remove
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="drop"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="text-sage"
                    >
                      <UploadCloud size={18} className="mx-auto mb-1.5 text-sage-dim" />
                      <span className="text-xs">
                        Or drop a scanned prescription ·{" "}
                        <span className="text-gold-soft">browse</span>
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* submit */}
              <motion.button
                whileTap={canSubmit ? { scale: 0.97 } : undefined}
                onClick={submit}
                disabled={!canSubmit || phase === "issuing"}
                className="btn-gold w-full py-3.5"
              >
                {phase === "issuing" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Signing & issuing…
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Sign & issue prescription
                  </>
                )}
              </motion.button>
              {!canSubmit && (
                <p className="text-center text-[10.5px] text-sage-dim">
                  Select a patient and add at least one medication or file to
                  issue an Rx.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}




