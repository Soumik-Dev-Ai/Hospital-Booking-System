"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn, clamp01 } from "@/lib/utils";

/**
 * 3D Liquid Glass – physics-driven tilt with a cursor-tracking
 * specular glare. Wraps modal surfaces to give them depth.
 */
export function TiltGlass({
  children,
  className,
  maxTilt = 6,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  const springX = useSpring(pointerX, { stiffness: 150, damping: 20, mass: 0.6 });
  const springY = useSpring(pointerY, { stiffness: 150, damping: 20, mass: 0.6 });

  const rotateX = useTransform(springY, [0, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(springX, [0, 1], [-maxTilt, maxTilt]);

  const glareX = useTransform(springX, (v) => `${v * 100}%`);
  const glareY = useTransform(springY, (v) => `${v * 100}%`);
  const glareBackground = useMotionTemplate`radial-gradient(560px circle at ${glareX} ${glareY}, rgba(255,255,255,0.5), rgba(255,255,255,0) 60%)`;

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pointerX.set(clamp01((e.clientX - rect.left) / rect.width));
    pointerY.set(clamp01((e.clientY - rect.top) / rect.height));
  }

  function handleMouseLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <div className="h-full w-full" style={{ perspective: 1600 }}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn("relative h-full w-full will-change-transform", className)}
      >
        {glare && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] mix-blend-soft-light"
            style={{ background: glareBackground }}
          />
        )}
        {children}
      </motion.div>
    </div>
  );
}
