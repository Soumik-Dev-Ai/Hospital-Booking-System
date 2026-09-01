import type { Metadata } from "next";
import { HomeClient } from "@/components/home/HomeClient";

export const metadata: Metadata = {
  title: "Home · Aurelis Private Medical Concierge",
  description:
    "Care, built around your life. Precision diagnostics, at-home concierge care, specialist second opinions and longevity programs.",
};

export default function HomePage() {
  return <HomeClient />;
}
