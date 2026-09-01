import type { ReactNode } from "react";
import { LiquidGlassCanvas } from "@/components/three/LiquidGlassCanvas";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { RouteFade } from "@/components/site/RouteFade";

/**
 * Persistent chrome for the entire base website. The WebGL liquid-glass
 * scenery and the navbar live here – outside the per-route trees – so a
 * route change between the Gateway, Home, Services and Physicians pages
 * can never produce a blank frame.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_0%,#0d2b1e_0%,#071a12_48%,#040d09_100%)]">
        <LiquidGlassCanvas className="h-full w-full" />
      </div>
      <Navbar />
      <main>
        <RouteFade>{children}</RouteFade>
      </main>
      <Footer />
      <div className="noise-layer" aria-hidden="true" />
    </div>
  );
}
