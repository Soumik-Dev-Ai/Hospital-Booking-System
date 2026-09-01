export type Role = "patient" | "doctor" | "admin";

export interface AuthUser {
  id: string;
  fullName: string;
  accountName: string;
  email: string;
  role: Role;
}

export interface Session {
  token: string;
  user: AuthUser;
}

export interface ServiceItem {
  id: string;
  index: string;
  name: string;
  category: string;
  description: string;
  duration: string;
  mode: "In-clinic" | "At-home" | "Telehealth" | "Hybrid";
  fee: number;
  feeNote: string;
}

export interface CarePillar {
  id: string;
  numeral: string;
  title: string;
  tagline: string;
  description: string;
  fee: number;
  included: string[];
}

export interface Physician {
  id: string;
  name: string;
  specialty: string;
  monogram: string;
  bio: string;
  credentials: string[];
  languages: string[];
  experience: number;
  rating: number;
  fee: number;
  slots: { time: string; available: boolean }[];
}

export interface ToastInput {
  kind?: "success" | "error" | "info";
  title: string;
  message?: string;
}
