"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import type { Dict, Lang } from "@/lib/content";
import { translator } from "@/lib/i18n";
import { screenPath } from "@/lib/routes";
import { DIALOG_FACTS } from "@/lib/site-data";

/** Must match the exit transition on `.veil` / `.dialog` in globals.css. */
const EXIT_MS = 200;

/** Preview of the one worked example request, opened from the needs board. */
export default function ExampleNeedDialog({
  lang,
  t,
  onClose,
}: {
  lang: Lang;
  t: Dict;
  onClose: () => void;
}) {
  const tr = translator(lang);
  const { showToast } = useToast();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Play the exit transition, then let the parent unmount us. */
  const close = useCallback(() => {
    setClosing(true);
    exitTimer.current = setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  useEffect(() => {
    opener.current = document.activeElement;
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(exitTimer.current);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [close]);

  return (
    <div className="veil" data-closing={closing} onClick={close}>
      <div
        className="dialog"
        data-closing={closing}
        role="dialog"
        aria-modal="true"
        aria-labelledby="example-need-title"
        tabIndex={-1}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__head">
          <div className="badges">
            <span className="badge badge--verified">
              <span className="dot dot--xs" style={{ ["--dot-color" as string]: "var(--green)" }} />
              {t.verifiedBadge}
            </span>
            <span className="badge badge--urgent">
              <span
                className="dot dot--xs"
                style={{ ["--dot-color" as string]: "var(--red-dot)" }}
              />
              {t.immediateBadge}
            </span>
            <button
              type="button"
              className="reset-button dialog__close"
              onClick={close}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <h2 className="dialog__title" id="example-need-title">
            {t.detailTitle}
          </h2>
          <p className="dialog__meta">{t.detailMeta}</p>
        </div>

        <div className="dialog__body">
          <div className="notice">{t.exampleNote}</div>
          <p>{t.detailBody}</p>

          <div className="factlist" style={{ gap: 10, marginBottom: 22 }}>
            {DIALOG_FACTS.map((fact) => (
              <div className="fact" key={fact.k}>
                <span className="fact__k">{tr(fact.k)}</span>
                <span className="fact__v">{tr(fact.v)}</span>
              </div>
            ))}
          </div>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--green btn--md"
              onClick={() => {
                showToast(t.toastInterest);
                close();
              }}
            >
              {t.iCanHelp}
            </button>
            <Link href={screenPath(lang, "detail")} className="btn btn--outline btn--md">
              {t.openFullPage}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
