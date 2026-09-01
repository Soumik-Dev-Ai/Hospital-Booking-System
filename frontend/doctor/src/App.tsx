import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Background from "./components/Background";
import Header from "./components/Header";
import AppointmentsHub from "./components/AppointmentsHub";
import ActionsDesk from "./components/ActionsDesk";
import PatientModal from "./components/PatientModal";
import { DoctorFeatureDock } from "./components/DoctorFeatureDock";
import { TransitionDissolve } from "./components/TransitionDissolve";
import {
  ToastStack,
  WorkspaceProvider,
  useWorkspace,
  type ActionIntent,
  type TabId,
} from "./lib/store";

/* ------------------------------------------------------------------ */
/*  AEGIS · Doctor Workspace – Phase 4                                */
/*  Direct entry: mounts straight into the Appointments Hub.          */
/* ------------------------------------------------------------------ */

function Workspace() {
  const { patients, appointments, patientById, pushToast } = useWorkspace();

  const [tab, setTab] = useState<TabId>("schedule");
  const [selected, setSelected] = useState<{
    patientId: string;
    appointmentId: string;
  } | null>(null);
  const [intent, setIntent] = useState<ActionIntent | null>(null);

  const openPatient = (
    p: { id: string },
    a: { id: string }
  ) => setSelected({ patientId: p.id, appointmentId: a.id });

  const runAction = (mode: ActionIntent["mode"], patientId: string) => {
    const p = patientById(patientId);
    pushToast({
      title:
        mode === "prescription"
          ? "Prescription desk opened"
          : "Checklist builder opened",
      body: p ? `${p.name} · ${p.id}` : patientId,
      tone: "info",
    });
    setIntent({ mode, patientId });
    setSelected(null);
    setTab("actions");
  };

  const patient = selected ? patients.find((p) => p.id === selected.patientId) : null;
  const appointment = selected
    ? appointments.find((a) => a.id === selected.appointmentId)
    : null;

  return (
    <div className="min-h-screen">
      <Background />
      <Header tab={tab} onTab={setTab} />
      {tab === "schedule" && <DoctorFeatureDock />}

      <main className="mx-auto w-full max-w-[88rem] px-4 pt-28 pb-28 sm:px-6">
        <AnimatePresence mode="wait">
          {tab === "schedule" ? (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <AppointmentsHub onOpen={openPatient} />
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <ActionsDesk intent={intent} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {patient && appointment && (
          <PatientModal
            patient={patient}
            appointment={appointment}
            onClose={() => setSelected(null)}
            onAction={runAction}
          />
        )}
      </AnimatePresence>

      <ToastStack />
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <TransitionDissolve />
      <Workspace />
   </WorkspaceProvider>
  );
}


