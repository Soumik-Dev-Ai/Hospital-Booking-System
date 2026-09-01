import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import Background from "./components/Background";
import Header, { type NavView } from "./components/Header";
import { SetPasswordBanner } from "./components/SetPasswordBanner";
import { PatientFeatureDock } from "./components/PatientFeatureDock";
import AppointmentsHub, { type HubStats } from "./components/AppointmentsHub";
import BookingFlow from "./components/BookingFlow";
import RecordsView from "./components/RecordsView";
import { Icon } from "./components/Icons";
import { TransitionDissolve } from "./components/TransitionDissolve";
import { fetchPatientBundle } from "./lib/backend";
import {
  patient,
  seedAppointments,
  seedChecklists,
  seedPrescriptions,
  seedServiceRecords,
  type Appointment,
  type Checklist,
} from "./data/mock";

type View = NavView | "booking";

/** Deep-link target: a document inside the records vault */
type RecordsFocus = { tab: "prescriptions" | "records"; id: string } | null;

const pageMotion = {
  initial: { opacity: 0, y: 26, filter: "blur(7px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -16,
    filter: "blur(7px)",
    transition: { duration: 0.3, ease: "easeIn" as const },
  },
};

export default function App() {
  useEffect(() => {
    let active = true;
    fetchPatientBundle().then((bundle) => {
      if (!active) return;
      setAppointments(bundle.appointments);
      setChecklists(bundle.checklists);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const [view, setView] = useState<View>("hub");
  const [appointments, setAppointments] = useState<Appointment[]>(seedAppointments);
  const [checklists, setChecklists] = useState<Checklist[]>(seedChecklists);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [recordsFocus, setRecordsFocus] = useState<RecordsFocus>(null);

  const openPrescription = useCallback((rxId: string) => {
    setRecordsFocus({ tab: "prescriptions", id: rxId });
    setView("records");
  }, []);

  const openRecord = useCallback((recId: string) => {
    setRecordsFocus({ tab: "records", id: recId });
    setView("records");
  }, []);

  const clearRecordsFocus = useCallback(() => setRecordsFocus(null), []);

  const upcoming = appointments
    .filter((a) => a.status === "confirmed")
    .sort((a, b) => a.dayOffset - b.dayOffset);

  const stats: HubStats = {
    next: upcoming[0],
    openChecklists: checklists.filter((c) => c.items.some((i) => !i.done)).length,
    prescriptions: seedPrescriptions.length,
  };

  function handleBooked(apt: Appointment) {
    setAppointments((prev) => [apt, ...prev]);
    setHighlightId(apt.id);
    setView("hub");
  }

  function toggleChecklistItem(checklistId: string, itemIdx: number) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((it, i) =>
                i === itemIdx
                  ? { ...it, done: !it.done, value: it.done ? undefined : it.value }
                  : it
              ),
            }
          : c
      )
    );
  }

  function submitChecklistItem(checklistId: string, itemIdx: number, value: string) {
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((it, i) =>
                i === itemIdx ? { ...it, done: true, value } : it
              ),
            }
          : c
      )
    );
  }

  function submitChecklist(checklistId: string) {
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, submitted: true } : c))
    );
  }

  return (
    <div className="min-h-screen font-sans text-forest-950">
      <TransitionDissolve />
      <Background />
      <Header view={view} onNav={setView} onBook={() => setView("booking")} />
      <SetPasswordBanner />
      <PatientFeatureDock />

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-14 pt-28 md:px-6 md:pt-32">
        <AnimatePresence mode="wait">
          {view === "hub" && (
            <motion.div key="hub" {...pageMotion}>
              <AppointmentsHub
                appointments={appointments}
                stats={stats}
                highlightId={highlightId}
                onBook={() => setView("booking")}
                onRecords={() => setView("records")}
                onViewPrescription={openPrescription}
                onViewRecord={openRecord}
              />
            </motion.div>
          )}

          {view === "booking" && (
            <motion.div key="booking" {...pageMotion}>
              <BookingFlow onBooked={handleBooked} />
            </motion.div>
          )}

          {view === "records" && (
            <motion.div key="records" {...pageMotion}>
              <RecordsView
                checklists={checklists}
                prescriptions={seedPrescriptions}
                records={seedServiceRecords}
                onToggleItem={toggleChecklistItem}
                onSubmitItem={submitChecklistItem}
                onSubmitChecklist={submitChecklist}
                focusTab={recordsFocus?.tab ?? null}
                focusId={recordsFocus?.id ?? null}
                onFocusConsumed={clearRecordsFocus}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Concierge footer */}
      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-10 md:px-6">
        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/60 bg-alabaster-200/45 px-6 py-5 backdrop-blur-xl md:flex-row">
          <div className="flex items-center gap-3.5">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-champagne-300 to-champagne-500 text-forest-950 shadow-md ring-1 ring-champagne-600/20">
              <Icon name="phone" size={15} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-forest-500">
                24/7 Care Concierge
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-forest-900">
                {patient.concierge.name} · {patient.concierge.phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-400">
            <span className="flex items-center gap-1.5">
              <Icon name="shield" size={13} className="text-forest-500" />
              HIPAA-compliant vault
            </span>
            <span className="h-3 w-px bg-forest-900/15" />
            <span>Verdant Health · Est. 2011</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


