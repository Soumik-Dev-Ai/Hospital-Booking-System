import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  APPOINTMENTS,
  DOCTOR,
  INITIAL_CHECKLISTS,
  INITIAL_PRESCRIPTIONS,
  PATIENTS,
  type Checklist,
  type ChecklistItem,
  type Medication,
  type Prescription,
} from "./mock";
import { cn } from "../utils/cn";
import { fetchDoctorBundle } from "./backend";

/* ------------------------------- types ------------------------------ */

export type TabId = "schedule" | "actions";

export interface ActionIntent {
  mode: "prescription" | "checklist";
  patientId: string;
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "success" | "warn" | "info";
}

interface WorkspaceValue {
  doctor: typeof DOCTOR;
  patients: typeof PATIENTS;
  appointments: typeof APPOINTMENTS;
  checklists: Checklist[];
  prescriptions: Prescription[];
  toasts: Toast[];
  patientById: (id: string) => (typeof PATIENTS)[number] | undefined;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  assignChecklist: (
    patientId: string,
    data: { title: string; items: Omit<ChecklistItem, "id" | "done">[] }
  ) => void;
  issuePrescription: (
    patientId: string,
    data: {
      fileName: string;
      medications: Omit<Medication, "id">[];
      notes?: string;
    }
  ) => Prescription;
}

/* ------------------------------ context ----------------------------- */

const WorkspaceCtx = createContext<WorkspaceValue | null>(null);

const uid = () => Math.random().toString(36).slice(2, 9);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] = useState<typeof APPOINTMENTS>(APPOINTMENTS);
  const [checklists, setChecklists] = useState<Checklist[]>(INITIAL_CHECKLISTS);
  useEffect(() => { let active = true; fetchDoctorBundle().then(({ appointments: live }) => { if (active) setAppointments(live as typeof APPOINTMENTS); }).catch(() => undefined); return () => { active = false; }; }, []);
  const [prescriptions, setPrescriptions] =
    useState<Prescription[]>(INITIAL_PRESCRIPTIONS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const patientById = useCallback(
    (id: string) => PATIENTS.find((p) => p.id === id),
    []
  );

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      4600
    );
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const assignChecklist = useCallback<WorkspaceValue["assignChecklist"]>(
    (patientId, data) => {
      const patient = patientById(patientId);
      const checklist: Checklist = {
        id: `CL-${uid()}`,
        patientId,
        title: data.title,
        status: "pending",
        assignedAt: new Date().toISOString(),
        updatedAt: null,
        items: data.items.map((i) => ({
          ...i,
          id: `CLI-${uid()}`,
          done: false,
        })),
      };
      setChecklists((prev) => [
        ...prev.filter((c) => c.patientId !== patientId),
        checklist,
      ]);
      pushToast({
        title: "Checklist assigned",
        body: patient
          ? `${data.title} · ${patient.name}`
          : `${data.title} · patient`,
        tone: "success",
      });
    },
    [patientById, pushToast]
  );

  const issuePrescription = useCallback<
    WorkspaceValue["issuePrescription"]
  >(
    (patientId, data) => {
      const patient = patientById(patientId);
      const rx: Prescription = {
        id: `RX-${uid()}`,
        patientId,
        fileName: data.fileName,
        medications: data.medications.map((m) => ({
          ...m,
          id: `RXM-${uid()}`,
        })),
        notes: data.notes,
        issuedAt: new Date().toISOString(),
        ref: `RX-${new Date().getFullYear()}-${1000 + Math.floor(Math.random() * 9000)}`,
      };
      setPrescriptions((prev) => [
        ...prev.filter((p) => p.patientId !== patientId),
        rx,
      ]);
      pushToast({
        title: "Prescription issued",
        body: patient ? `${patient.name} · ${data.fileName}` : data.fileName,
        tone: "success",
      });
      return rx;
    },
    [patientById, pushToast]
  );

  const value: WorkspaceValue = {
    doctor: DOCTOR,
    patients: PATIENTS,
    appointments,
    checklists,
    prescriptions,
    toasts,
    patientById,
    pushToast,
    dismissToast,
    assignChecklist,
    issuePrescription,
  };

  return (
    <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/* ---------------------------- toast stack --------------------------- */

const TOAST_ICONS = {
  success: <CheckCircle2 size={17} className="text-mint" />,
  warn: <AlertTriangle size={17} className="text-amber" />,
  info: <Info size={17} className="text-gold-soft" />,
};

export function ToastStack() {
  const { toasts, dismissToast } = useWorkspace();
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[80] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 26, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={() => dismissToast(t.id)}
            className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl p-4 text-left"
          >
            <span
              className={cn(
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border",
                t.tone === "success" && "border-mint/25 bg-mint/10",
                t.tone === "warn" && "border-amber/25 bg-amber/10",
                t.tone === "info" && "border-gold/25 bg-gold/10"
              )}
            >
              {TOAST_ICONS[t.tone]}
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold text-alabaster">
                {t.title}
              </span>
              {t.body && (
                <span className="mt-0.5 block text-xs text-sage">{t.body}</span>
              )}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}


