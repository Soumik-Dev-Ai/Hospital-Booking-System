import type { Role } from "@/lib/types";

export type MagicLinkRequest = { email: string };
export type MagicLinkSession = { token: string; user: { id: string; role: Role; fullName: string; accountName: string; email: string }; needsPassword: boolean };

const MAGIC_OTP = "AURELIS";
const SESSION_KEY = "aurelis.session.v1";

export async function requestMagicLink({ email }: MagicLinkRequest) {
  await new Promise((resolve) => setTimeout(resolve, 450));
  if (!email.includes("@")) throw new Error("Enter a valid email address.");
  sessionStorage.setItem("aurelis.magic.email", email);
  sessionStorage.setItem("aurelis.magic.otp", MAGIC_OTP);
  return { message: `A one-time code was sent to ${email}.`, demoCode: MAGIC_OTP };
}

export async function verifyMagicLink(email: string, code: string): Promise<MagicLinkSession> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const expected = sessionStorage.getItem("aurelis.magic.otp") || MAGIC_OTP;
  if (email !== sessionStorage.getItem("aurelis.magic.email") || code.toUpperCase() !== expected) {
    throw new Error("That code is not valid. Try AURELIS in the demo environment.");
  }
  const payload = { sub: "magic-patient", role: "patient", accountName: "patient", email, fullName: "Eleanor Vance", exp: Math.floor(Date.now() / 1000) + 3600, magic: true };
  const token = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${btoa(JSON.stringify(payload)).replace(/=/g, "")}.`;
  const session = { token, user: { id: "magic-patient", role: "patient" as Role, fullName: "Eleanor Vance", accountName: "patient", email }, needsPassword: true };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  sessionStorage.removeItem("aurelis.magic.otp");
  return session;
}

export async function setPassword(password: string) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (password.length < 8) throw new Error("Use at least 8 characters.");
  localStorage.setItem("aurelis.password.set", "true");
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    const session = JSON.parse(raw) as Record<string, unknown>;
    session.needsPassword = false;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return { ok: true };
}

export { MAGIC_OTP };
