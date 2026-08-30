"use client";

import { useEffect, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

const DURATION_MS = 1200;

/**
 * Counts up to `value` on mount with a cubic ease-out.
 * Renders the final figure immediately for reduced-motion visitors, and the
 * server renders it too, so the number is correct with JavaScript disabled.
 */
export default function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (value === 0 || prefersReducedMotion()) {
      setShown(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(value * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };

    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown.toLocaleString()}</>;
}
