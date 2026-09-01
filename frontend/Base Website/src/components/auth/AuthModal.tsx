"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth, dashPath } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { requestMagicLink, verifyMagicLink, MAGIC_OTP } from "@/lib/magic-link";
import type { Role } from "@/lib/types";

const ROLES: { id: Role; label: string }[] = [
  { id: "patient", label: "Patient" },
  { id: "doctor", label: "Doctor" },
  { id: "admin", label: "Admin" },
];

type Mode = "login" | "signup";
type PasswordlessStep = "email" | "otp";

export function AuthModal() {
  const { authOpen, authIntent, authMode, closeAuth, login, signup, triggerTransition } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("patient");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordless, setPasswordless] = useState(false);
  const [passwordlessStep, setPasswordlessStep] = useState<PasswordlessStep>("email");
  const [email, setEmail] = useState("patient@example.com");
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState(MAGIC_OTP);
  const [signupForm, setSignupForm] = useState({ fullName: "", email: "", password: "" });
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!authOpen) return;
    setMode(authMode ?? "login");
    setPasswordless(false);
    setPasswordlessStep("email");
    setError(null);
    setOtp("");
  }, [authOpen, authMode]);

  if (!authOpen) return null;

  const finish = (destRole: Role, firstName?: string) => {
    closeAuth();
    toast({ kind: "success", title: `Welcome${firstName ? `, ${firstName}` : ""}`, message: "Taking you to your Aurelis workspace." });
    triggerTransition(dashPath(destRole));
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await login({ accountName: role === "patient" ? "patient" : role, password: "123", role });
    setLoading(false);
    if (!result.ok || !result.user) {
      setError(result.error ?? "Login failed.");
      return;
    }
    finish(result.user.role, result.user.fullName.split(" ")[0]);
  };

  const submitSignup = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signup({ ...signupForm, accountName: signupForm.email.split("@")[0] || "patient", role });
    setLoading(false);
    if (!result.ok || !result.user) {
      setError(result.error ?? "Sign-up failed.");
      return;
    }
    finish(result.user.role, result.user.fullName.split(" ")[0]);
  };

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await requestMagicLink({ email });
      setDemoCode(result.demoCode);
      setPasswordlessStep("otp");
      toast({ kind: "success", title: "Code sent", message: result.message });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send code.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await verifyMagicLink(email, otp);
      sessionStorage.setItem("aurelis.magic.completed", "true");
      const result = await login({ accountName: "patient", password: "123", role: "patient" });
      if (!result.ok || !result.user) throw new Error(result.error ?? "Unable to create your session.");
      finish("patient", result.user.fullName.split(" ")[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code could not be verified.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = "w-full rounded-2xl border border-alabaster/15 bg-alabaster/7 px-4 py-3 text-sm text-alabaster outline-none transition focus:border-gold-soft/70 focus:ring-2 focus:ring-gold-soft/25";
  const labelClass = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-alabaster/55";

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-forest-950/55 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closeAuth}>
        <motion.section role="dialog" aria-modal="true" aria-labelledby="aurelis-auth-title" className="w-full max-w-md overflow-hidden rounded-[2rem] border border-alabaster/15 bg-forest-950/95 p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.65)]" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -18, filter: "blur(6px)" }} transition={{ type: "spring", stiffness: 260, damping: 24 }} onMouseDown={(event) => event.stopPropagation()}>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-soft">Aurelis access</p>
              <h2 id="aurelis-auth-title" className="font-display text-3xl text-alabaster">{passwordless ? "A passwordless arrival" : mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-alabaster/60">{passwordless ? passwordlessStep === "email" ? "Enter your email and we will send a one-time code." : "Enter the eight-character code sent to your email." : "Private care, thoughtfully coordinated."}</p>
            </div>
            <button type="button" aria-label="Close authentication" onClick={closeAuth} className="grid h-9 w-9 place-items-center rounded-full border border-alabaster/15 text-alabaster/65 transition hover:border-gold-soft/60 hover:text-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft/60">×</button>
          </div>

          {!passwordless && (
            <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-alabaster/6 p-1">
              {ROLES.map((item) => <button key={item.id} type="button" onClick={() => setRole(item.id)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${role === item.id ? "bg-gold-soft text-forest-950" : "text-alabaster/60 hover:text-alabaster"}`}>{item.label}</button>)}
            </div>
          )}

          <AnimatePresence mode="wait">
            {passwordless ? passwordlessStep === "email" ? (
              <motion.form key="magic-email" onSubmit={sendMagicLink} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                <label className={labelClass} htmlFor="magic-email">Email address</label>
                <input id="magic-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
                <button type="submit" disabled={loading} className="w-full rounded-full bg-gold-soft px-5 py-3 text-sm font-bold text-forest-950 transition hover:bg-[#e7c985] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft/70 focus-visible:ring-offset-2 focus-visible:ring-offset-forest-950">{loading ? "Sending code…" : "Send one-time code"}</button>
                <button type="button" onClick={() => setPasswordless(false)} className="w-full text-xs font-semibold text-alabaster/55 transition hover:text-gold-soft">Return to password login</button>
              </motion.form>
            ) : (
              <motion.form key="magic-otp" onSubmit={verifyCode} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                <div className="flex justify-center gap-2">
                  {Array.from({ length: 8 }).map((_, index) => <input key={index} ref={(element) => { otpRefs.current[index] = element; }} aria-label={`Code character ${index + 1}`} inputMode="text" maxLength={1} value={otp[index] ?? ""} onChange={(event) => { const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); const next = otp.split(""); next[index] = value; setOtp(next.join("")); if (value) otpRefs.current[index + 1]?.focus(); }} className="h-12 w-10 rounded-xl border border-forest-900/15 bg-white/60 text-center font-display text-xl text-forest-950 outline-none focus:ring-2 focus:ring-gold-soft/60" />)}
                </div>
                <p className="text-center text-xs text-alabaster/50">Demo code: <button type="button" onClick={() => setOtp(demoCode)} className="font-bold text-gold-soft underline-offset-4 hover:underline">{demoCode}</button></p>
                {error && <p className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p>}
                <button type="submit" disabled={loading || otp.length < 8} className="w-full rounded-full bg-gold-soft px-5 py-3 text-sm font-bold text-forest-950 transition hover:bg-[#e7c985] disabled:opacity-60">{loading ? "Verifying…" : "Verify and continue"}</button>
                <button type="button" onClick={() => setPasswordlessStep("email")} className="w-full text-xs font-semibold text-alabaster/55 transition hover:text-gold-soft">Use a different email</button>
              </motion.form>
            ) : mode === "login" ? (
              <motion.form key="login" onSubmit={submitLogin} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                <div><label className={labelClass} htmlFor="login-email">Email address</label><input id="login-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} /></div>
                <div><div className="flex items-center justify-between"><label className={labelClass} htmlFor="login-password">Password</label><button type="button" onClick={() => setPasswordless(true)} className="mb-1.5 text-[12px] font-medium text-forest-100/80 transition hover:text-gold-soft">Forgot password?</button></div><input id="login-password" type="password" required defaultValue="patient123" className={fieldClass} /></div>
                {error && <p className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-full bg-gold-soft px-5 py-3 text-sm font-bold text-forest-950 transition hover:bg-[#e7c985] disabled:opacity-60">{loading ? "Entering…" : "Enter Aurelis"}</button>
                <button type="button" onClick={() => setMode("signup")} className="w-full text-xs font-semibold text-alabaster/55 transition hover:text-gold-soft">New to Aurelis? Create an account</button>
              </motion.form>
            ) : (
              <motion.form key="signup" onSubmit={submitSignup} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-4">
                <div><label className={labelClass} htmlFor="signup-name">Full name</label><input id="signup-name" required value={signupForm.fullName} onChange={(event) => setSignupForm((form) => ({ ...form, fullName: event.target.value }))} className={fieldClass} /></div>
                <div><label className={labelClass} htmlFor="signup-email">Email address</label><input id="signup-email" type="email" required value={signupForm.email} onChange={(event) => setSignupForm((form) => ({ ...form, email: event.target.value }))} className={fieldClass} /></div>
                <div><label className={labelClass} htmlFor="signup-password">Password</label><input id="signup-password" type="password" minLength={6} required value={signupForm.password} onChange={(event) => setSignupForm((form) => ({ ...form, password: event.target.value }))} className={fieldClass} /></div>
                {error && <p className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-full bg-gold-soft px-5 py-3 text-sm font-bold text-forest-950 transition hover:bg-[#e7c985] disabled:opacity-60">{loading ? "Creating…" : "Create account"}</button>
                <button type="button" onClick={() => setMode("login")} className="w-full text-xs font-semibold text-alabaster/55 transition hover:text-gold-soft">Already have an account? Login</button>
              </motion.form>
            )}
          </AnimatePresence>

          

          
          {!passwordless && (
            <>
              <div className="relative my-6 flex items-center">
                <div className="flex-grow border-t border-[#F4F0EA]/10"></div>
                <span className="flex-shrink-0 mx-4 text-[#F4F0EA]/30 text-xs uppercase tracking-wider">or continue with</span>
                <div className="flex-grow border-t border-[#F4F0EA]/10"></div>
              </div>

              <button
                type="button"
                onClick={() => window.location.href = `http://localhost:8000/api/v1/auth/google/login?role=${role}`}
                className="w-full h-11 bg-transparent border border-[#F4F0EA]/20 rounded-full text-[#F4F0EA] font-medium tracking-wide hover:bg-[#F4F0EA]/5 transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden group mb-4"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-sm">Google</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F4F0EA]/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
              </button>
            </>
          )}

          {authIntent && <p className="mt-5 text-center text-[11px] text-alabaster/40">You are continuing to {authIntent}.</p>}
        </motion.section>
      </motion.div>
    </AnimatePresence>

          

  );
}
