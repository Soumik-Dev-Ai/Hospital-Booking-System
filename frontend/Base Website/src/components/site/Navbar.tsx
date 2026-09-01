"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useAuth, dashPath } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";

const LINKS = [
  { href: "/home", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/physicians", label: "Our Physicians" },
];

function BrandMark() {
  return (
    <span className="relative grid h-9 w-9 place-items-center">
      <svg viewBox="0 0 36 36" fill="none" className="h-9 w-9">
        <circle cx="18" cy="18" r="15" stroke="rgba(230,205,161,0.5)" strokeWidth="1" />
        <circle cx="18" cy="18" r="10.5" stroke="rgba(244,242,232,0.18)" strokeWidth="0.75" />
        <path d="M18 10.5v15M10.5 18h15" stroke="rgba(244,242,232,0.9)" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="18" cy="18" r="2.6" fill="#c9a26b" />
      </svg>
      <span className="absolute inset-0 -z-10 rounded-full bg-forest-600/30 blur-md" />
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status, openAuth, logout, triggerTransition } = useAuth();
  const { toast } = useToast();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onLogout = () => {
    logout();
    toast({ kind: "info", title: "Signed out", message: "Your session has been cleared." });
    router.push("/home");
  };

  // The 3D Liquid Glass Gateway stands alone — the header stays
  // mounted but slides away, returning softly when a site page opens.
  const isLanding = pathname === "/" && !(status === "authed" && user);

  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: isLanding ? -26 : 0, opacity: isLanding ? 0 : 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: isLanding ? 0 : 0.25 }}
      style={{ pointerEvents: isLanding ? "none" : "auto" }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 transition-all duration-700 sm:px-8 ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        {/* Brand */}
        <Link href="/home" className="group flex items-center gap-3">
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[1.05rem] font-medium tracking-[0.22em] text-alabaster transition group-hover:text-gold-soft">
              AURELIS
            </span>
            <span className="mt-1 text-[0.52rem] font-bold uppercase tracking-[0.32em] text-alabaster/45">
              Private Medical Concierge
            </span>
          </span>
        </Link>

        {/* Center links */}
        <nav className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              data-active={pathname === l.href}
              className="nav-link"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Auth corner */}
        <div className="flex items-center gap-2.5">
          {status === "authed" && user ? (
            <div className="flex items-center gap-2.5">
              {/* Mirrored profile pill — transports the user back into their
                  dashboard via the shared 3D-glass transition loader. */}
              <button
                type="button"
                onClick={() => triggerTransition(dashPath(user.role))}
                className="glass flex items-center gap-2.5 rounded-2xl px-2.5 py-1.5 transition hover:border-gold/40"
                aria-label={`Open ${user.role} dashboard`}
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-full text-[0.68rem] font-extrabold tracking-wide"
                  style={{
                    background: "linear-gradient(150deg, #276f4d, #123c2a)",
                    border: "1px solid rgba(230,205,161,0.4)",
                    color: "#f4f2e8",
                  }}
                >
                  {user.fullName
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className="hidden pr-1 sm:block">
                  <span className="block max-w-28 truncate text-[0.76rem] font-bold leading-tight text-alabaster">
                    {user.fullName}
                  </span>
                  <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-gold/80">
                    {user.role}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign out"
                className="grid h-9 w-9 place-items-center rounded-xl border border-alabaster/15 bg-alabaster/5 text-alabaster/60 transition hover:border-red-300/40 hover:text-red-200"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path
                    d="M8 3H4.5A1.5 1.5 0 003 4.5v11A1.5 1.5 0 004.5 17H8M13 6l4 4-4 4M17 10H8"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <>
              {/* Sign-In — bolder, heavier, commanding box */}
              <button
                type="button"
                onClick={() => openAuth({ mode: "signup" })}
                className="btn btn-command px-4 py-2.5 sm:px-5"
              >
                Sign-In
              </button>
              {/* Login — slightly suppressed, 3D pop-up style */}
              <button
                type="button"
                onClick={() => openAuth({ mode: "login" })}
                className="btn btn-float px-4 py-2.5 sm:px-5"
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
