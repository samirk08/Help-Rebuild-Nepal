"use client";

import { useEffect, useState } from "react";

import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { prefersReducedMotion } from "@/lib/motion";

const CYCLE_MS = 2400;
const FADE_MS = 260;

/** The rotating "Open to: engineers / nurses / translators …" line in the hero. */
export default function LoopWord({ lang }: { lang: Lang }) {
  // Not the generated LOOP_WORDS: that list advertised "surveyors", which the
  // skills dropdown has no option for. See lib/added-strings.ts.
  const words = added(lang).loopWords;
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let swap: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      setFading(true);
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setFading(false);
      }, FADE_MS);
    }, CYCLE_MS);

    return () => {
      clearInterval(cycle);
      clearTimeout(swap);
    };
  }, [words.length]);

  return (
    <span className="hero__loop-word" data-fading={fading}>
      {words[index]}
    </span>
  );
}
