"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { GATEWAY_SCENE, SITE_SCENE, setScene } from "@/lib/scene";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function GatewayPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setScene(GATEWAY_SCENE);
    router.prefetch("/home");
    const t = window.setTimeout(() => setReady(true), 120);
    return () => window.clearTimeout(t);
  }, [router]);

  /**
   * Seamless handover: the gateway panel performs a 3D fly-out while the
   * persistent liquid-glass canvas morphs down to site intensity; the
   * router push fires mid-flight so the Home hero fades in on top of the
   * same scenery – no blank frame, no quality drop.
   */
  const enter = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setScene(SITE_SCENE);
    window.setTimeout(() => router.push("/home"), 520);
  }, [leaving, router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-16 pt-28">
      {/* ambient glow behind the emblem */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(31,92,64,0.55) 0%, rgba(18,60,42,0.25) 45%, transparent 70%)",
        }}
      />

      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center"
        style={{ perspective: 1400 }}
      >
        <motion.div
          initial={{ opacity: 0, y: 46, rotateX: 26, scale: 0.92, filter: "blur(12px)" }}
          animate={
            ready
              ? { opacity: 1, y: 0, rotateX: 0, scale: 1, filter: "blur(0px)" }
              : {}
          }
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 20, mass: 1 }}
          className="flex flex-col items-center"
        >
          {/* Liquid glass emblem – slow counter-rotating rings */}
          <motion.div
            animate={leaving ? { scale: 1.14, opacity: 0, filter: "blur(10px)" } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="relative grid h-40 w-40 place-items-center sm:h-48 sm:w-48"
          >
            <div className="ring-orb animate-spin-slow absolute inset-0" />
            <div className="ring-orb-2 animate-spin-slower absolute -inset-5" />
            <div className="animate-float-soft relative grid h-24 w-24 place-items-center rounded-full border border-alabaster/15 bg-forest-950/40 backdrop-blur-md sm:h-28 sm:w-28">
              <svg viewBox="0 0 40 40" fill="none" className="h-12 w-12">
                <path
                  d="M20 6v9M20 25v9M6 20h9M25 20h9"
                  stroke="rgba(244,242,232,0.92)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <circle cx="20" cy="20" r="7.5" stroke="rgba(201,162,107,0.8)" strokeWidth="1.1" />
                <circle cx="20" cy="20" r="3" fill="#c9a26b" />
              </svg>
            </div>
          </motion.div>

          {/* Wordmark */}
          <h1
            className="display-hero mt-9 text-[clamp(3.2rem,9vw,6.5rem)]"
            style={{ opacity: ready && !leaving ? 1 : 0, transition: "opacity 1s ease 0.25s" }}
          >
            <span className="text-gradient-alabaster">AURELIS</span>
          </h1>

          <motion.div
            animate={leaving ? { opacity: 0, y: -18 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-4 flex items-center gap-4"
          >
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/60" />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.5em] text-gold sm:text-[0.72rem]">
              Private Medical Concierge
            </p>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/60" />
          </motion.div>

          <motion.p
            animate={leaving ? { opacity: 0, y: -14 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-7 max-w-md text-[0.92rem] leading-relaxed text-alabaster/60"
          >
            Precision diagnostics, at-home care and the world&apos;s finest physicians, one
            concierge desk, entirely at your service.
          </motion.p>

          {/* Enter control */}
          <motion.button
            type="button"
            onClick={enter}
            animate={leaving ? { opacity: 0, y: 20, scale: 0.94 } : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="btn btn-gold shimmer-sweep mt-10 px-9 py-4 text-[0.8rem] uppercase tracking-[0.18em]"
          >
            Enter the Practice
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        </motion.div>
      </motion.section>

      {/* baseline strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: 0.4, delay: leaving ? 0 : 0.9 }}
        className="absolute inset-x-0 bottom-7 flex items-center justify-center gap-4"
      >
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-alabaster/30">
          Phase 1 · The Base Website
        </span>
        <span className="h-3 w-px bg-alabaster/15" />
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-alabaster/30">
          Phase 2 · The Auth Engine
        </span>
      </motion.div>
    </div>
  );
}
