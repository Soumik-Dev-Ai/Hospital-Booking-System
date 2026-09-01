import type { Metadata } from "next";
import { DoctorDashboardClient } from "@/components/dashboard/DoctorDashboardClient";

export const metadata: Metadata = {
  title: "Doctor Dashboard · Aurelis",
};

export default function DoctorDashboardPage() {
  return <DoctorDashboardClient />;
}
