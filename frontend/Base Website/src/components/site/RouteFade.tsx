"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

const ENTER_EASE = [0.16, 1, 0.3, 1] as const;
const EXIT_EASE = [0.4, 0, 0.6, 1] as const;

/**
 * RouteFade – a buttery, GPU-only page handover.
 *
 * The Gateway (/) choreographs its own 3D fly-out, so it renders
 * unwrapped. Every other page fades out for a beat and the next page
 * fades + rises in as one continuous sheet of glass over the persistent
 * WebGL scenery.
 *
 * Performance notes:
 *  - only opacity and transform are animated (never `filter`), so the
 *    handover never drops frames
 *  - `min-h-screen` keeps the layout height stable while pages swap,
 *    so the footer can never jump
 *  - scroll is reset to the top the instant the route changes
 */
export function RouteFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className="min-h-screen"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: ENTER_EASE } }}
        exit={{ opacity: 0, y: -12, transition: { duration: 0.22, ease: EXIT_EASE } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
