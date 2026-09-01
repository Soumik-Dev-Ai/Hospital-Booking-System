import type { Metadata } from "next";
import { ServicesClient } from "@/components/services/ServicesClient";

export const metadata: Metadata = {
  title: "Services · Aurelis Private Medical Concierge",
  description:
    "Executive health assessments, concierge specialist consults, at-home diagnostics and longevity programs, with transparent consultancy fees.",
};

export default function ServicesPage() {
  return <ServicesClient />;
}
