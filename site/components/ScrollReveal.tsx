"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { prefersReducedMotion } from "@/lib/motion";

/**
 * Reveals `[data-reveal]` elements as they scroll into view.
 *
 * The design's `.rise` animation ran on mount for every element, including the
 * trust cards well below the fold — so by the time anyone scrolled there, the
 * animation had finished unseen. One observer for the whole page fixes that
 * without wrapping every card in a component.
 *
 * Two safety properties:
 *   - The hidden starting state is scoped to `html[data-reveal="on"]`, a flag
 *     only this component sets. If the bundle never loads, nothing is ever
 *     hidden — content renders plainly rather than disappearing.
 *   - Under prefers-reduced-motion the flag is never set, so there is no
 *     transition and no starting offset at all.
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const root = document.documentElement;
    root.dataset.reveal = "on";

    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.dataset.revealed = "true";
          observer.unobserve(el);
        }
      },
      // Fire slightly before the element's top edge arrives, so the motion has
      // finished by the time it is comfortably in view.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.01 }
    );

    for (const target of targets) {
      // Anything already on screen at load reveals immediately, no stagger.
      const box = target.getBoundingClientRect();
      if (box.top < window.innerHeight) target.dataset.revealed = "true";
      else observer.observe(target);
    }

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
