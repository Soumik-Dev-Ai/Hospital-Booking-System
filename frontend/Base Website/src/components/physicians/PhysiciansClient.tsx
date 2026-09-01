"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PHYSICIANS, formatFee } from "@/lib/data";
import { SITE_SCENE, setScene } from "@/lib/scene";
import { TiltCard } from "@/components/ui/TiltCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import type { Physician } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5" fill={i < Math.round(rating) ? "#c9a26b" : "rgba(244,242,232,0.14)"}>
            <path d="M10 1.6l2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8L10 1.6z" />
          </svg>
        ))}
      </span>
      <span className="text-[0.72rem] font-bold text-gold-soft">{rating.toFixed(2)}</span>
    </span>
  );
}

function Monogram({ physician, size = 56 }: { physician: Physician; size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full font-display"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        color: "#f4f2e8",
        background: "linear-gradient(150deg, #276f4d 0%, #123c2a 70%)",
        border: "1.5px solid rgba(230,205,161,0.45)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 12px 28px -12px rgba(0,0,0,0.8)",
      }}
    >
      {physician.monogram}
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: "conic-gradient(from 210deg, transparent 0 72%, rgba(230,205,161,0.5) 86%, transparent 100%)" }}
      />
    </span>
  );
}

/**
 * 3D physician profile – intentionally NOT a route. The card flies open
 * into a glass panel above the page.
 */
function PhysicianModal({ physician, onClose }: { physician: Physician; onClose: () => void }) {
  const { user, openAuth } = useAuth();
  const { toast } = useToast();
  const [slot, setSlot] = useState<string | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    setSlot(null);
    setHint(false);
  }, [physician.id]);

  const book = () => {
    if (!slot) {
      setHint(true);
      return;
    }
    if (!user) {
      onClose();
      openAuth({ mode: "login", intent: "book" });
      return;
    }
    onClose();
    toast({
      kind: "success",
      title: "Appointment requested",
      message: `${physician.name} · today at ${slot}: confirmation is on its way (mock).`,
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <div
        className="absolute inset-0 bg-forest-950/65"
        style={{ backdropFilter: "blur(16px) saturate(1.2)", WebkitBackdropFilter: "blur(16px) saturate(1.2)" }}
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl" style={{ perspective: 1600 }}>
        <motion.div
          initial={{ opacity: 0, y: 120, rotateX: 36, rotateY: -6, scale: 0.76, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 80, rotateX: 26, scale: 0.84, filter: "blur(10px)", transition: { duration: 0.3 } }}
          transition={{ type: "spring", stiffness: 165, damping: 23, mass: 1.05 }}
          className="glass-deep relative overflow-hidden rounded-[30px] p-7 sm:p-10"
          style={{ transformOrigin: "50% 12%" }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
          <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-forest-500/20 blur-3xl" />

          {/* close */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-full border border-alabaster/15 bg-alabaster/5 text-alabaster/70 transition hover:rotate-90 hover:border-gold/40 hover:text-alabaster"
            style={{ transitionDuration: "0.4s" }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          <div className="grid gap-9 md:grid-cols-[auto_1fr]">
            {/* Left – identity */}
            <div className="flex flex-row items-center gap-5 md:flex-col md:items-start">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.08 }}
              >
                <Monogram physician={physician} size={104} />
              </motion.div>
              <div className="md:mt-3">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-gold">
                  {physician.specialty}
                </p>
                <h3 className="mt-1.5 font-display text-[1.6rem] leading-tight text-gradient-alabaster">
                  {physician.name}
                </h3>
                <div className="mt-2">
                  <Stars rating={physician.rating} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {physician.languages.map((l) => (
                    <span key={l} className="chip">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right – detail */}
            <div>
              <p className="text-[0.88rem] leading-relaxed text-alabaster/70">{physician.bio}</p>

              <div className="mt-5 space-y-2">
                {physician.credentials.map((c, i) => (
                  <motion.div
                    key={c}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.14 + i * 0.05, duration: 0.4, ease: EASE }}
                    className="flex items-start gap-2.5 text-[0.78rem] text-alabaster/60"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rotate-45 border border-gold/60 bg-gold/20" />
                    {c}
                  </motion.div>
                ))}
              </div>

              {/* Availability + timings */}
              <div className="mt-7 rounded-2xl border border-alabaster/10 bg-alabaster/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.28em] text-gold">
                    Today&apos;s availability
                  </p>
                  <span className="text-[0.66rem] text-alabaster/40">
                    {physician.experience} yrs · from {formatFee(physician.fee)} / consult (mock)
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {physician.slots.map((s) => {
                    const selected = slot === s.time;
                    return (
                      <motion.button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        whileTap={s.available ? { scale: 0.92 } : undefined}
                        onClick={() => {
                          setSlot(s.time);
                          setHint(false);
                        }}
                        className={`rounded-xl border px-2 py-2.5 text-[0.78rem] font-bold tracking-wider transition-all duration-300 ${
                          selected
                            ? "border-gold bg-gradient-to-b from-gold-soft to-gold text-forest-950 shadow-[0_0_24px_rgba(201,162,107,0.4)]"
                            : s.available
                              ? "border-alabaster/14 bg-forest-950/50 text-alabaster/80 hover:border-gold/50 hover:text-gold-soft"
                              : "cursor-not-allowed border-alabaster/6 bg-forest-950/30 text-alabaster/25 line-through"
                        }`}
                      >
                        {s.time}
                      </motion.button>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {hint && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden pt-3 text-[0.72rem] font-semibold tracking-wide text-gold-soft/90"
                    >
                      Please pick an available time above to continue.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Book */}
              <button
                type="button"
                onClick={book}
                className="btn btn-gold shimmer-sweep mt-6 w-full py-4 text-[0.8rem] uppercase tracking-[0.18em]"
              >
                Book{slot ? ` · ${slot}` : ""}
              </button>
              <p className="mt-3 text-center text-[0.66rem] text-alabaster/40">
                Booking requires a secure sign-in; your session is cached, so it&apos;s a one-time step.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function PhysicianCard({ physician, onOpen, index }: { physician: Physician; onOpen: () => void; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.75, ease: EASE, delay: (index % 4) * 0.08 }}
    >
      <TiltCard
        max={5}
        onClick={onOpen}
        className="glass group h-full cursor-pointer rounded-[24px] p-6 transition-shadow duration-500 hover:shadow-[0_36px_70px_-28px_rgba(0,0,0,0.8),0_0_36px_-10px_rgba(31,92,64,0.5)]"
      >
        <div className="flex items-start justify-between">
          <Monogram physician={physician} size={58} />
          <Stars rating={physician.rating} />
        </div>
        <h3 className="mt-4 font-display text-[1.25rem] leading-tight text-alabaster transition-colors duration-300 group-hover:text-gold-soft">
          {physician.name}
        </h3>
        <p className="mt-1 text-[0.64rem] font-bold uppercase tracking-[0.26em] text-gold/80">
          {physician.specialty}
        </p>
        <p className="mt-3 line-clamp-2 text-[0.8rem] leading-relaxed text-alabaster/55">
          {physician.bio}
        </p>
        <div className="mt-5 flex items-center justify-between border-t border-alabaster/8 pt-4">
          <span className="text-[0.66rem] font-bold uppercase tracking-[0.2em] text-alabaster/40">
            From {formatFee(physician.fee)}
          </span>
          <span className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-gold transition-all duration-500 group-hover:gap-3">
            Open profile
            <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </TiltCard>
    </motion.div>
  );
}

export function PhysiciansClient() {
  const [active, setActive] = useState<Physician | null>(null);

  useEffect(() => {
    setScene(SITE_SCENE);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 pt-36 sm:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        className="mx-auto max-w-3xl text-center"
      >
        <p className="eyebrow">The Physician Roster</p>
        <h1 className="display-hero mt-5 text-[clamp(2.6rem,6vw,4.6rem)]">
          <span className="text-gradient-alabaster">Our</span>{" "}
          <em className="text-gradient-gold" style={{ fontStyle: "italic" }}>
            Physicians
          </em>
        </h1>
        <p className="mt-5 text-[0.95rem] leading-relaxed text-alabaster/60">
          Forty-plus disciplines, hand-selected and personally vetted. Open any profile: it
          unfolds right here, then book from the doctor&apos;s live availability.
        </p>
        <div className="divider-ornament mx-auto mt-8 max-w-xs">
          <span className="h-1.5 w-1.5 rotate-45 border border-gold/60 bg-gold/20" />
        </div>
      </motion.div>

      {/* Grid */}
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PHYSICIANS.map((p, i) => (
          <PhysicianCard key={p.id} physician={p} index={i} onOpen={() => setActive(p)} />
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="pb-4 pt-12 text-center text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-alabaster/30"
      >
        Mock roster · timings & fees for the Phase 1 & 2 concept build
      </motion.p>

      {/* 3D profile pop-up – never a redirect */}
      <AnimatePresence>
        {active && <PhysicianModal key={active.id} physician={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </div>
  );
}
