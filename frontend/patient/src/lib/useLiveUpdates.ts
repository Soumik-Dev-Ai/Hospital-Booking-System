import { useCallback, useEffect, useRef, useState } from "react";
export type LiveEvent = { type: "appointment.created" | "appointment.completed" | "checklist.submitted" | "prescription.issued"; payload: Record<string, unknown> };
export function useLiveUpdates(onEvent?: (event: LiveEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const timer = useRef<number | null>(null);
  const handle = useCallback((event: LiveEvent) => { setLastEvent(event); onEvent?.(event); }, [onEvent]);
  useEffect(() => { let active = true; const connect = () => { if (!active) return; setConnected(true); timer.current = window.setTimeout(() => { handle({ type: "appointment.created", payload: { source: "mock-live", timestamp: Date.now() } }); timer.current = window.setTimeout(connect, 24000); }, 9000); }; connect(); return () => { active = false; setConnected(false); if (timer.current) window.clearTimeout(timer.current); }; }, [handle]);
  return { connected, lastEvent };
}
