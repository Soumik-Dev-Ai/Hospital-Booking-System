import type { Metadata } from "next";
import { AdminDashboardClient } from "@/components/dashboard/AdminDashboardClient";

export const metadata: Metadata = {
  title: "Admin Dashboard · Aurelis",
};

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
