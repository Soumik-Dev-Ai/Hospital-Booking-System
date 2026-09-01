"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

/**
 * TransitionDissolve – Phase 3 inbound bridge (admin variant).
 *
 * Identical behavior to the patient/doctor version: finds the hardcoded
 * `#app-loader` element (rendered 0ms by layout.tsx before React parses)
 * and dissolves it via Framer Motion once the React tree has mounted and
 * the DOM has had at least `MIN_VISIBLE_MS` to settle.
 *
 * Rendered as a Server Component's child – `"use client"` is required so
 * `useEffect` runs in the browser.
 */
const LOADER_ID = "app-loader";
const MIN_VISIBLE_MS = 50;
const DISSOLVE_MS = 400;

export function TransitionDissolve() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const entered = performance.now();
    let cancelled = false;

    const flush = () => {
      if (cancelled) return;
      const elapsed = performance.now() - entered;
      const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

      window.setTimeout(() => {
        if (cancelled) return;
        const el = document.getElementById(LOADER_ID);
        if (!el) return;
        animate(
          el,
          { opacity: [1, 0], filter: ["blur(0px)", "blur(10px)"] },
          { duration: DISSOLVE_MS / 1000, ease: [0.16, 1, 0.3, 1] }
        ).then(() => {
          if (!cancelled && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      }, wait);
    };

    requestAnimationFrame(() => requestAnimationFrame(flush));

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
