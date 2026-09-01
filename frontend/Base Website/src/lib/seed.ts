import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth-server";

const SEED_USERS = [
  {
    accountName: "patient",
    email: "patient@aurelis.health",
    fullName: "Alex Mercer",
    role: "patient" as const,
    password: "patient123",
  },
  {
    accountName: "dr.lena",
    email: "dr.lena@aurelis.health",
    fullName: "Dr. Lena Kovač",
    role: "doctor" as const,
    password: "doctor123",
  },
  {
    accountName: "admin",
    email: "admin@aurelis.health",
    fullName: "Elias Ward",
    role: "admin" as const,
    password: "admin123",
  },
];

export async function ensureSeedUsers(): Promise<void> {
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    if (existing.length > 0) return;
    await db
      .insert(users)
      .values(
        SEED_USERS.map((u) => ({
          accountName: u.accountName,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          passwordHash: hashPassword(u.password),
        }))
      )
      .onConflictDoNothing();
  } catch (err) {
    console.error("[seed] demo users could not be seeded:", err);
  }
}
