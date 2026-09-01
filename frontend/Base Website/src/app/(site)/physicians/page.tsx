import type { Metadata } from "next";
import { PhysiciansClient } from "@/components/physicians/PhysiciansClient";

export const metadata: Metadata = {
  title: "Our Physicians · Aurelis Private Medical Concierge",
  description:
    "Meet the Aurelis physician roster: forty-plus disciplines of cardiology, neurology, internal medicine and more, bookable in minutes.",
};

export default function PhysiciansPage() {
  return <PhysiciansClient />;
}
