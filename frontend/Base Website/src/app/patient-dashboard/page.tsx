import type { Metadata } from "next";
import { PatientDashboardClient } from "@/components/dashboard/PatientDashboardClient";

export const metadata: Metadata = {
  title: "Patient Dashboard · Aurelis",
};

export default function PatientDashboardPage() {
  return <PatientDashboardClient />;
}
