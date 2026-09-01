"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { PILLARS, formatFee } from "@/lib/data";
import { SITE_SCENE, setScene } from "@/lib/scene";
import { TiltCard } from "@/components/ui/TiltCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import type { CarePillar } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

const reveal = {
  initial: { opacity: 0, y: 42 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.85, ease: EASE },
} as const;

const PILLAR_ICONS: Record<string, React.ReactNode> = {
  diagnostics: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path d="M3 12h4l2-5 4 10 2-5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  athome: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "second-opinion": (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <circle cx="10" cy="9" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 19.5c.8-3 3.4-4.5 6.5-4.5s5.7 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.5 8.6l.9-2.1 2.1-.9-2.1-.9-.9-2.1-.9 2.1-2.1.9 2.1.9.9 2.1z" fill="currentColor" />
    </svg>
  ),
  longevity: (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path d="M12 3v4M12 7c-3.3 0-6 2.9-6 6.5V19c0 1.1.9 2 2 2h2v-6h4v6h2c1.1 0 2-.9 2-2v-5.5C18 9.9 15.3 7 12 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 5.2c0-1.3 1.8-2.2 4-2.2s4 .9 4 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function PillarPopout({
  pillar,
  onClose,
}: {
  pillar: CarePillar;
  onClose: () => void;
}) {
  const { user, openAuth } = useAuth();
  const { toast } = useToast();

  const book = () => {
    onClose();
    if (user) {
      toast({
        kind: "success",
        title: "Service request placed",
        message: `${pillar.title}: our concierge desk will confirm within the hour.`,
      });
    } else {
      openAuth({ mode: "login", intent: "book" });
    }
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
      <div className="relative w-full max-w-2xl" style={{ perspective: 1500 }}>
        <motion.div
          initial={{ opacity: 0, y: 110, rotateX: 34, scale: 0.78, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 70, rotateX: 24, scale: 0.85, filter: "blur(8px)", transition: { duration: 0.3 } }}
          transition={{ type: "spring", stiffness: 170, damping: 22, mass: 1 }}
          className="glass-deep relative overflow-hidden rounded-[30px] p-8 sm:p-10"
          style={{ transformOrigin: "50% 10%" }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
          {/* ghost numeral */}
          <span className="pointer-events-none absolute -right-4 -top-7 font-display text-[9rem] font-semibold leading-none text-alabaster/5">
            {pillar.numeral}
          </span>

          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/30 bg-gradient-to-b from-forest-600/50 to-forest-900/70 text-gold-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                {PILLAR_ICONS[pillar.id]}
              </span>
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.3em] text-gold">
                  Pillar {pillar.numeral}
                </p>
                <h3 className="font-display text-[1.7rem] leading-tight text-gradient-alabaster sm:text-[2rem]">
                  {pillar.title}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-alabaster/15 bg-alabaster/5 text-alabaster/70 transition hover:rotate-90 hover:border-gold/40 hover:text-alabaster"
              style={{ transitionDuration: "0.4s" }}
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <p className="mt-6 text-[0.95rem] leading-relaxed text-alabaster/70">{pillar.description}</p>

          <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
            {pillar.included.map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.06, duration: 0.45, ease: EASE }}
                className="flex items-start gap-2.5 rounded-xl border border-alabaster/8 bg-alabaster/[0.04] px-3.5 py-2.5"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span className="text-[0.8rem] leading-snug text-alabaster/75">{item}</span>
              </motion.div>
            ))}
          </div>

          {/* Mock consultancy fee */}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/25 bg-gold/[0.07] px-5 py-4">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.28em] text-gold/80">
                Consultancy fee
              </p>
              <p className="mt-1 font-display text-[1.9rem] leading-none text-gold-soft">
                {formatFee(pillar.fee)}
                <span className="ml-2 align-middle text-[0.66rem] font-sans font-bold uppercase tracking-[0.2em] text-alabaster/40">
                  mock · per consult
                </span>
              </p>
            </div>
            <button type="button" onClick={book} className="btn btn-gold px-6 py-3 text-[0.76rem] uppercase tracking-[0.14em]">
              Book this service
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function HomeClient() {
  const router = useRouter();
  const { openAuth } = useAuth();
  const [active, setActive] = useState<CarePillar | null>(null);

  useEffect(() => {
    setScene(SITE_SCENE);
  }, []);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col items-center justify-center px-5 pt-36 pb-20 text-center sm:px-8">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="eyebrow"
        >
          Aurelis · Private Medical Concierge
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE, delay: 0.08 }}
          className="display-hero mt-6 max-w-5xl text-[clamp(2.9rem,7.2vw,6.2rem)]"
        >
          <span className="text-gradient-alabaster">Care Build</span>{" "}
          <em className="text-gradient-gold not-italic" style={{ fontStyle: "italic" }}>
            Your Life
          </em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
          className="mt-7 max-w-2xl text-[1rem] leading-relaxed text-alabaster/60 sm:text-[1.05rem]"
        >
          One concierge desk. Forty-plus physician disciplines. Your health, quietly orchestrated:
          from a same-night house call to a full executive assessment.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.32 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={() => openAuth({ mode: "login", intent: "book" })}
            className="btn btn-gold shimmer-sweep px-8 py-4 text-[0.78rem] uppercase tracking-[0.16em]"
          >
            Book Appointment
          </button>
          <button
            type="button"
            onClick={() => router.push("/services")}
            className="btn btn-ghost px-8 py-4 text-[0.78rem] uppercase tracking-[0.16em]"
          >
            Explore Services
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <path d="M2.5 8h11M9 3.5L13.5 8 9 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </motion.div>

        {/* stat strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4"
        >
          {[
            ["40+", "Physician disciplines"],
            ["24/7", "Concierge response"],
            ["98%", "Member satisfaction"],
          ].map(([n, l]) => (
            <div key={l} className="flex items-baseline gap-2.5">
              <span className="font-display text-2xl text-gold-soft">{n}</span>
              <span className="text-[0.64rem] font-bold uppercase tracking-[0.24em] text-alabaster/45">
                {l}
              </span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ---------- Interactive pillars ---------- */}
      <section className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <motion.div {...reveal} className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Four pillars · One practice</p>
          <h2 className="display-hero mt-4 text-[clamp(2rem,4.6vw,3.4rem)]">
            <span className="text-gradient-alabaster">What we build for you</span>
          </h2>
          <p className="mt-4 text-[0.92rem] leading-relaxed text-alabaster/55">
            Select a pillar to lift it from the glass; each reveals its full scope and its
            consultancy fee.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 48 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, ease: EASE, delay: i * 0.1 }}
            >
              <TiltCard
                onClick={() => setActive(p)}
                className="glass group h-full cursor-pointer rounded-[24px] p-6 transition-shadow duration-500 hover:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8),0_0_40px_-10px_rgba(31,92,64,0.5)]"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl border border-gold/25 bg-gradient-to-b from-forest-600/40 to-forest-900/60 text-gold-soft transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                    {PILLAR_ICONS[p.id]}
                  </span>
                  <span className="font-display text-2xl text-alabaster/15 transition-colors duration-500 group-hover:text-gold/50">
                    {p.numeral}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-[1.35rem] leading-tight text-alabaster">
                  {p.title}
                </h3>
                <p className="mt-2 text-[0.82rem] leading-relaxed text-alabaster/55">{p.tagline}</p>
                <div className="mt-6 flex items-center justify-between border-t border-alabaster/8 pt-4">
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-alabaster/40">
                    From {formatFee(p.fee)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold transition-all duration-500 group-hover:gap-3">
                    View details
                    <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3">
                      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------- Ritual strip ---------- */}
      <section className="relative mx-auto max-w-7xl px-5 pb-8 sm:px-8">
        <motion.div {...reveal} className="glass rounded-[28px] px-8 py-12 sm:px-14">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              ["01", "Tell us where it hurts", "A 15-minute confidential intake with your dedicated care coordinator, same day, no queues."],
              ["02", "We assemble the plan", "Your lead physician builds a care map across diagnostics, specialists and home care."],
              ["03", "Care arrives quietly", "Appointments, records and follow-ups handled for you. You live your life; we carry the details."],
            ].map(([n, t, d]) => (
              <div key={n} className="relative">
                <span className="font-display text-4xl text-gold/35">{n}</span>
                <h3 className="mt-3 font-display text-lg text-alabaster">{t}</h3>
                <p className="mt-2 max-w-xs text-[0.82rem] leading-relaxed text-alabaster/55">{d}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section className="relative mx-auto max-w-7xl px-5 pt-20 sm:px-8">
        <motion.div {...reveal} className="relative overflow-hidden rounded-[32px] border border-gold/20 px-8 py-16 text-center sm:px-14">
          <div className="absolute inset-0 bg-gradient-to-b from-forest-800/60 to-forest-950/80" />
          <div className="absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
          <div className="relative">
            <p className="eyebrow">Begin privately</p>
            <h2 className="display-hero mt-4 text-[clamp(1.9rem,4.4vw,3.2rem)]">
              <span className="text-gradient-alabaster">Your first consultation awaits</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[0.92rem] leading-relaxed text-alabaster/60">
              Sign in to book directly with any physician, or open an account and let a care
              coordinator reach out within the hour.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => openAuth({ mode: "login", intent: "book" })}
                className="btn btn-gold px-8 py-4 text-[0.78rem] uppercase tracking-[0.16em]"
              >
                Book Appointment
              </button>
              <button
                type="button"
                onClick={() => openAuth({ mode: "signup" })}
                className="btn btn-ghost px-8 py-4 text-[0.78rem] uppercase tracking-[0.16em]"
              >
                Open an Account
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3D pop-out */}
      <AnimatePresence>
        {active && <PillarPopout key={active.id} pillar={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </>
  );
}
