import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative mt-28 border-t border-alabaster/8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-xl tracking-[0.22em] text-alabaster">AURELIS</p>
          <p className="mt-1 text-[0.56rem] font-bold uppercase tracking-[0.32em] text-gold/70">
            Private Medical Concierge
          </p>
          <p className="mt-5 max-w-sm text-[0.84rem] leading-relaxed text-alabaster/55">
            A private practice for people who expect more from their health: precision
            diagnostics, at-home care and specialist counsel, delivered with absolute discretion.
          </p>
          <div className="mt-6 flex gap-2.5">
            {["@aurelis.health", "+1 (212) 555-0147"].map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-5">Navigate</p>
          <ul className="space-y-3">
            {[
              { href: "/home", label: "Home" },
              { href: "/services", label: "Services" },
              { href: "/physicians", label: "Our Physicians" },
              { href: "/patient-dashboard", label: "Patient Dashboard" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-[0.82rem] text-alabaster/60 transition hover:pl-1 hover:text-gold-soft"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      <div>
          <p className="eyebrow mb-5">Legal</p>
          <ul className="space-y-3">
            {[
              { href: "/privacy-policy", label: "Privacy Policy" },
              { href: "/terms-of-service", label: "Terms of Service" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="text-[0.82rem] text-alabaster/60 transition hover:pl-1 hover:text-gold-soft"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-alabaster/6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-[0.68rem] tracking-wide text-alabaster/35 sm:flex-row sm:px-8">
          <p>© 2026 Aurelis Medical Concierge. All rights reserved.</p>
          <p className="uppercase tracking-[0.24em]">Care, built around your life.</p>
        </div>
      </div>
    </footer>
  );
}
