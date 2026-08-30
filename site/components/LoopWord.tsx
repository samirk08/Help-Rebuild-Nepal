"use client";

import { useEffect, useState } from "react";

import { LOOP_WORDS, LOOP_WORDS_NP, type Lang } from "@/lib/content";
import { prefersReducedMotion } from "@/lib/motion";

const CYCLE_MS = 2400;
const FADE_MS = 260;

/** The rotating "Open to: engineers / nurses / translators …" line in the hero. */
export default function LoopWord({ lang }: { lang: Lang }) {
  const words = lang === "np" ? LOOP_WORDS_NP : LOOP_WORDS;
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
