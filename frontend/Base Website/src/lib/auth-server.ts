import { SignJWT, jwtVerify } from "jose";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthUser, Role } from "@/lib/types";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "aurelis-dev-secret-do-not-ship"
);

export interface TokenPayload {
  sub: string;
  role: Role;
  name: string;
  accountName: string;
  email: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: String(payload.sub ?? ""),
      role: payload.role as Role,
      name: String(payload.name ?? ""),
      accountName: String(payload.accountName ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, "hex"), test);
}

export function toPublicUser(row: {
  id: string;
  fullName: string;
  accountName: string;
  email: string;
  role: Role;
}): AuthUser {
  return {
    id: row.id,
    fullName: row.fullName,
    accountName: row.accountName,
    email: row.email,
    role: row.role,
  };
}
