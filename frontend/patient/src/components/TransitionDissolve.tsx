import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

/**
 * TransitionDissolve – Phase 3 inbound bridge.
 *
 * Sits at the root of every dashboard so that, on hard-reload entry from the
 * Base Website, the hardcoded `#app-loader` element in index.html (which has
 * been visible since first paint, 0ms, before React parsed) is dissolved
 * gracefully by Framer Motion once the React tree has mounted and the DOM has
 * had at least `MIN_VISIBLE_MS` to settle.
 *
 * The dissolve uses opacity + blur to mask the moment the dashboard UI takes
 * over – no white flash, no layout shift, perfectly matching the outbound
 * 3D-glass gyroscope loader on the Base Website.
 *
 * One-shot: the loader is removed from the DOM once the animation completes,
 * so subsequent in-app navigations are not affected.
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
        if (!el) return; // user already navigated, or no loader (e.g. direct hit cached)
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

    // Two RAFs guarantee at least one paint frame has occurred with React mounted
    // before we begin dissolving, so the dashboard UI is rendered underneath.
    requestAnimationFrame(() => requestAnimationFrame(flush));

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
