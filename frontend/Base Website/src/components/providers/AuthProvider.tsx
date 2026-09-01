"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { decodeJwt } from "jose";
import { apiLogin, apiLogout, apiMe, apiSignup, type LoginInput, type SignupInput } from "@/lib/client-api";
import type { AuthUser, Role, Session } from "@/lib/types";
import { AuthModal } from "@/components/auth/AuthModal";
import { TransitionLoader } from "@/components/transition/TransitionLoader";

export const SESSION_KEY = "aurelis.session.v1";

type AuthStatus = "loading" | "authed" | "guest";

export interface OpenAuthOptions {
  mode?: "login" | "signup";
  intent?: "book";
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  authOpen: boolean;
  authIntent: "book" | null;
  authMode: "login" | "signup";
  openAuth: (opts?: OpenAuthOptions) => void;
  closeAuth: () => void;
  login: (input: LoginInput) => Promise<{ ok: boolean; error?: string; user?: AuthUser }>;
  signup: (input: SignupInput) => Promise<{ ok: boolean; error?: string; user?: AuthUser }>;
  logout: () => void;
  // Phase 3 addendum: outbound cross-app redirect.
  // `triggerTransition` mounts the 3D-glass gyroscope, lets it enter, then
  // executes a hard reload to `destPath`. The auth token is already in
  // localStorage (written by `login`/`signup` before `triggerTransition` runs),
  // so the destination dashboard picks it up seamlessly.
  transitioning: boolean;
  triggerTransition: (destPath: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function dashPath(role: Role): string {
  // Phase 3 addendum: cross-app redirect now goes to the static-exported
  // dashboard subfolder (/patient/, /doctor/, /admin/) instead of an internal
  // Next.js route. Same-origin window.location.href preserves localStorage so
  // the AuthProvider session survives the hard reload.
  return `/${role}/`;
}

function readStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.user) return null;
    const claims = decodeJwt(parsed.token);
    if (claims.exp && typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authIntent, setAuthIntent] = useState<"book" | null>(null);

  // Restore a cached session so returning members never re-authenticate.
  useEffect(() => {
    const stored = readStoredSession();
    if (!stored) {
      setStatus("guest");
      return;
    }
    setUser(stored.user);
    setToken(stored.token);
    setStatus("authed");
    apiMe(stored.token)
      .then((fresh) => {
        setUser(fresh);
        setStatus("authed");
      })
      .catch(() => {
        window.localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setToken(null);
        setStatus("guest");
      });
  }, []);

  const persist = useCallback((session: Session) => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session.user);
    setToken(session.token);
    setStatus("authed");
  }, []);

  const openAuth = useCallback((opts?: OpenAuthOptions) => {
    setAuthMode(opts?.mode ?? "login");
    setAuthIntent(opts?.intent ?? null);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setAuthIntent(null);
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      try {
        const session = await apiLogin(input);
        persist(session);
        return { ok: true, user: session.user };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Login failed. Please try again." };
      }
    },
    [persist]
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      try {
        const session = await apiSignup(input);
        persist(session);
        return { ok: true, user: session.user };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Sign-up failed. Please try again." };
      }
    },
    [persist]
  );

  const logout = useCallback(() => {
    if (token) void apiLogout(token).catch(() => undefined);
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setToken(null);
    setStatus("guest");
  }, []);

  // ---- Phase 3 addendum: outbound cross-app redirect ----
  const [transitioning, setTransitioning] = useState(false);
  const triggerTransition = useCallback((destPath: string) => {
    setTransitioning(true);
    // 700ms matches the loader's enter duration (500ms opacity) + a small
    // buffer so the gyroscope is fully visible before the browser navigates.
    window.setTimeout(() => {
      window.location.href = destPath;
    }, 700);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      authOpen,
      authIntent,
      authMode,
      openAuth,
      closeAuth,
      login,
      signup,
      logout,
      transitioning,
      triggerTransition,
    }),
    [user, token, status, authOpen, authIntent, authMode, openAuth, closeAuth, login, signup, logout, transitioning, triggerTransition]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal />
      {transitioning && <TransitionLoader />}
  </AuthContext.Provider>
  );
}


