import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Fraunces } from "next/font/google";
import { TransitionDissolve } from "@/components/TransitionDissolve";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  title: "Admin Command Center — Alderfeld Concierge Medicine",
  description:
    "Phase 05 operations console: patient compliance, doctor oversight and services & bookings.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* App Transition Loader CSS — identical across Base Website + patient + doctor + admin.
            Pure CSS 3D gyroscope, renders 0ms before React parses. */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              #app-loader.atl{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;pointer-events:none;background:radial-gradient(circle at 50% 42%,#0f2f22 0%,#163d2c 42%,#0b1f17 100%);will-change:opacity,filter;}
              .atl__scene{width:96px;height:96px;perspective:780px;perspective-origin:50% 50%;}
              .atl__cube{position:relative;width:100%;height:100%;transform-style:preserve-3d;animation:atl-spin 2.6s linear infinite;}
              .atl__face{position:absolute;inset:0;border-radius:50%;border:1.5px solid;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);box-shadow:inset 0 0 28px rgba(233,200,147,0.10);}
              .atl__face--x{border-color:rgba(233,200,147,0.55);transform:rotateX(72deg);}
              .atl__face--y{border-color:rgba(244,242,232,0.32);transform:rotateY(72deg);}
              .atl__face--z{border-color:rgba(233,200,147,0.40);}
              @keyframes atl-spin{from{transform:rotateX(0deg) rotateY(0deg) rotateZ(0deg);}to{transform:rotateX(360deg) rotateY(360deg) rotateZ(0deg);}}
              .atl__label{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.42em;color:#f3ede1;text-transform:uppercase;opacity:0.78;}
            `,
          }}
        />
     </head>
      <body
        className={`${dmSans.variable} ${fraunces.variable} min-h-screen bg-alabaster-100 text-ink-900 antialiased`}
      >
        {/* App Transition Loader HTML — identical across all 4 apps. Visible from first paint (0ms). */}
        <div
          id="app-loader"
          className="atl"
          aria-hidden="true"
          dangerouslySetInnerHTML={{
            __html:
              '<div class="atl__scene"><div class="atl__cube"><div class="atl__face atl__face--x"></div><div class="atl__face atl__face--y"></div><div class="atl__face atl__face--z"></div></div></div><p class="atl__label">Care Build Your Life</p>',
          }}
        />
        <TransitionDissolve />
        {children}
     </body>
   </html>
  );
}
