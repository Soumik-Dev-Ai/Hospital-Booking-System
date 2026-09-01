"use client";

import { AnimatePresence, motion } from "motion/react";

/**
 * TransitionLoader – Phase 3 outbound bridge (Base Website side).
 *
 * Renders the same 3D-glass gyroscope loader used on the inbound dashboards,
 * but here it's a React component (since the Base Website is already in React)
 * and is shown only while the user is being cross-app redirected to the
 * static dashboards. Once mounted, it sits at z-index 9999 over the entire
 * page so the upcoming hard reload to /patient/ | /doctor/ | /admin/ is
 * visually seamless.
 *
 * Note: this loader is NOT static-rendered into the Base Website HTML; it is
 * only mounted briefly by the AuthModal flow. The hardcoded HTML/CSS in the
 * dashboards' index.html (patient, doctor) and layout.tsx (admin) is what
 * covers the visual transition from the destination side; this component
 * simply makes sure the *origin* side looks equally smooth.
 */
export function TransitionLoader() {
  return (
    <AnimatePresence>
      <motion.div
        key="atl-outbound"
        id="app-loader"
        className="atl"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: "blur(10px)", transition: { duration: 0.4 } }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="atl__scene">
          <div className="atl__cube">
            <div className="atl__face atl__face--x" />
            <div className="atl__face atl__face--y" />
            <div className="atl__face atl__face--z" />
         </div>
       </div>
        <p className="atl__label">Care Build Your Life</p>
     </motion.div>
   </AnimatePresence>
  );
}
