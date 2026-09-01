"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

/**
 * Premium 3D tilt micro-interaction for cards. Rotates the surface
 * toward the cursor with a springy return – GPU-only, cheap and subtle.
 */
export function TiltCard({
  children,
  className = "",
  max = 7,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 22 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 22 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };

  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
}
