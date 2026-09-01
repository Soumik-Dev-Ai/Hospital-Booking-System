"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { SERVICES, formatFee } from "@/lib/data";
import { SITE_SCENE, setScene } from "@/lib/scene";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import type { ServiceItem } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

const MODE_TINT: Record<ServiceItem["mode"], string> = {
  "In-clinic": "rgba(159,184,164,0.16)",
  "At-home": "rgba(201,162,107,0.18)",
  Telehealth: "rgba(127,169,139,0.16)",
  Hybrid: "rgba(230,205,161,0.14)",
};

function ServiceRow({ service, index }: { service: ServiceItem; index: number }) {
  const { user, openAuth } = useAuth();
  const { toast } = useToast();

  const book = () => {
    if (user) {
      toast({
        kind: "success",
        title: "Booking request received",
        message: `${service.name} (${service.feeNote}): the concierge desk will confirm shortly.`,
      });
    } else {
      openAuth({ mode: "login", intent: "book" });
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease: EASE, delay: (index % 3) * 0.08 }}
      className="glass group relative overflow-hidden rounded-[26px] p-6 transition-colors duration-500 hover:border-gold/30 sm:p-8"
    >
      <span className="pointer-events-none absolute -right-2 top-4 font-display text-7xl font-semibold text-alabaster/4 transition-colors duration-500 group-hover:text-gold/10">
        {service.index}
      </span>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
        {/* identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="chip">{service.category}</span>
            <span
              className="chip"
              style={{ borderColor: MODE_TINT[service.mode], background: MODE_TINT[service.mode] }}
            >
              {service.mode}
            </span>
            <span className="chip">{service.duration}</span>
          </div>
          <h3 className="mt-3 font-display text-[1.4rem] leading-tight text-alabaster sm:text-[1.55rem]">
            {service.name}
          </h3>
          <p className="mt-2 max-w-2xl text-[0.85rem] leading-relaxed text-alabaster/55">
            {service.description}
          </p>
        </div>

        {/* fee + action */}
        <div className="flex shrink-0 items-center gap-6 lg:flex-col lg:items-end lg:gap-3 lg:pl-8 lg:text-right">
          <div>
            <p className="text-[0.58rem] font-bold uppercase tracking-[0.28em] text-gold/70">
              Consultancy fee
            </p>
            <p className="mt-1 font-display text-[1.7rem] leading-none text-gold-soft">
              {formatFee(service.fee)}
            </p>
            <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-alabaster/35">
              mock · {service.feeNote}
            </p>
          </div>
          <button
            type="button"
            onClick={book}
            className="btn btn-gold shimmer-sweep px-6 py-3.5 text-[0.72rem] uppercase tracking-[0.14em]"
          >
            Book this service
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export function ServicesClient() {
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
        <p className="eyebrow">The Concierge Catalogue</p>
        <h1 className="display-hero mt-5 text-[clamp(2.6rem,6vw,4.6rem)]">
          <span className="text-gradient-alabaster">Services,</span>{" "}
          <em className="text-gradient-gold" style={{ fontStyle: "italic" }}>
            priced plainly
          </em>
        </h1>
        <p className="mt-5 text-[0.95rem] leading-relaxed text-alabaster/60">
          Every consultancy fee is shown up front; no retainer surprises, no hidden charges.
          Booking requires a single sign-in; your concierge handles the rest.
        </p>
        <div className="divider-ornament mx-auto mt-8 max-w-xs">
          <span className="h-1.5 w-1.5 rotate-45 border border-gold/60 bg-gold/20" />
        </div>
      </motion.div>

      {/* List */}
      <div className="mt-14 space-y-5 pb-6">
        {SERVICES.map((s, i) => (
          <ServiceRow key={s.id} service={s} index={i} />
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="pb-4 pt-6 text-center text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-alabaster/30"
      >
        All fees are mock values for the Phase 1 & 2 concept build
      </motion.p>
    </div>
  );
}
