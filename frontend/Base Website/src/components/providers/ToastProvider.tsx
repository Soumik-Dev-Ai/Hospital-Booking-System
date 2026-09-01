"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ToastInput } from "@/lib/types";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const KIND_STYLE: Record<ToastKind, { icon: ReactNode; ring: string }> = {
  success: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M4 10.5l4 4L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    ring: "rgba(127,169,139,0.45)",
  },
  error: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    ring: "rgba(220,120,110,0.5)",
  },
  info: {
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 9v5M10 6.2v.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    ring: "rgba(201,162,107,0.5)",
  },
};

function Toaster({ items, dismiss }: { items: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[130] flex flex-col items-center gap-2.5 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            layout
            initial={{ opacity: 0, y: -22, scale: 0.92, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -14, scale: 0.94, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-left backdrop-blur-2xl"
            style={{
              background: "linear-gradient(160deg, rgba(7,26,18,0.9), rgba(4,16,11,0.92))",
              border: `1px solid ${KIND_STYLE[t.kind].ring}`,
              boxShadow: `0 24px 60px -20px rgba(0,0,0,0.8), 0 0 30px -8px ${KIND_STYLE[t.kind].ring}`,
            }}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{
                color: t.kind === "error" ? "#e8a59b" : t.kind === "success" ? "#9fc9ab" : "#e6cda1",
                background: "rgba(244,242,232,0.07)",
                border: `1px solid ${KIND_STYLE[t.kind].ring}`,
              }}
            >
              {KIND_STYLE[t.kind].icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.82rem] font-semibold text-alabaster">{t.title}</span>
              {t.message ? (
                <span className="block truncate text-[0.72rem] text-alabaster/55">{t.message}</span>
              ) : null}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current;
      setItems((prev) => [...prev.slice(-3), { id, kind: input.kind ?? "info", title: input.title, message: input.message }]);
      window.setTimeout(() => dismiss(id), 4600);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}
