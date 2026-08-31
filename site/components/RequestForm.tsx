"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import FormFieldView from "@/components/FormField";
import { useToast } from "@/components/ToastProvider";
import { added } from "@/lib/added-strings";
import type { Dict, Lang } from "@/lib/content";
import { NEED_SECTIONS, VOLUNTEER_SECTIONS } from "@/lib/form-schema";
import { submitRequest, type SubmissionKind } from "@/lib/api";
import { translator } from "@/lib/i18n";
import { confirmationPath } from "@/lib/routes";
import { ORGANIZE_OPTIONS, PMDRF_URL } from "@/lib/site-data";
import { uploadDocuments } from "@/lib/uploads";

type Mode = "volunteer" | "post";

/** Sections 1 and 2 start open; the rest are collapsed until asked for. */
const INITIALLY_OPEN = 2;

export default function RequestForm({ lang, mode, t }: { lang: Lang; mode: Mode; t: Dict }) {
  const router = useRouter();
  const tr = translator(lang);
  const extra = added(lang);
  const { showToast } = useToast();
  const isVolunteer = mode === "volunteer";
  const sections = isVolunteer ? VOLUNTEER_SECTIONS : NEED_SECTIONS;

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [s.n, i < INITIALLY_OPEN]))
  );
  const [donate, setDonate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filled, setFilled] = useState<Record<string, boolean>>({});
  const [revision, setRevision] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  // Files live here, not in component state — a picked File never needs to
  // trigger a re-render of the form around it, only to be here when submit runs.
  const pendingFiles = useRef<Record<string, File[]>>({});

  const toggle = (n: string) => setOpen((prev) => ({ ...prev, [n]: !prev[n] }));
  const setAll = (value: boolean) =>
    setOpen(Object.fromEntries(sections.map((s) => [s.n, value])));

  /**
   * Which sections have something in them.
   *
   * Read from the live form rather than tracked per field, so it covers native
   * inputs and the React-driven widgets alike. Recomputed after commit, since
   * the combobox writes its value to a hidden input via state and never fires a
   * DOM change event.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const next: Record<string, boolean> = {};
    for (const [key, value] of new FormData(form).entries()) {
      const match = /^s(\d+)-/.exec(key);
      if (!match) continue;
      if (typeof value === "string" && value.trim() !== "") next[match[1]] = true;
    }
    setFilled(next);
  }, [revision]);

  const bump = () => setRevision((r) => r + 1);

  const copy = useMemo(
    () => ({
      kicker: isVolunteer ? "I can help" : "I need support",
      title: isVolunteer ? "Register your skills, time and resources" : "Tell us exactly what you need",
      intro: isVolunteer
        ? "The more you tell us, the easier it is for a municipality to find you. Only your name, skill and district are required."
        : "The clearer the request, the faster it gets filled. A verifier checks it before it appears on the board, and you can update or close it at any time.",
      consent: isVolunteer
        ? "I agree to my details being shared with verified requesters, government agencies and partner organizations so they can coordinate relief and reconstruction."
        : "I confirm this request is genuine and that I am authorised to make it on behalf of the organization named above.",
      cta: isVolunteer ? "Create my profile" : "Submit request for review",
    }),
    [isVolunteer]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    // Captured before any `await`: React's synthetic event can detach
    // `currentTarget` once the handler yields, so `formRef` is what's safe to
    // use afterward, not `event.currentTarget`.
    const formEl = formRef.current;
    if (!formEl) {
      setSubmitting(false);
      return;
    }

    const kind: SubmissionKind = isVolunteer ? "volunteer" : "need";
    try {
      const result = await submitRequest(kind, lang, new FormData(formEl));

      const files = Object.values(pendingFiles.current).flat();
      if (result.id && files.length > 0) {
        await uploadDocuments(result.id, files);
      }

      // Leave for the confirmation page rather than resetting and staying put.
      // Resetting was never safe anyway — Combobox/LocationField/FileUpload
      // each hold their own React state that a native formEl.reset() would
      // desync — and a filled form sitting under a success toast is the single
      // biggest source of duplicate submissions: it reads as "did that work?"
      // and the obvious response is to press the button again.
      //
      // `submitting` is deliberately left true: the navigation is in flight,
      // and re-enabling the button first would reopen exactly that window.
      router.push(confirmationPath(lang, kind, result.id));
    } catch (err) {
      console.error("Submission failed", err);
      showToast(extra.submitError);
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--form">
      <p className="eyebrow" style={{ marginBottom: 12 }}>
        {tr(copy.kicker)}
      </p>
      <h1 className="h1 h1--form">{tr(copy.title)}</h1>
      <p className="lede" style={{ maxWidth: "64ch", fontSize: 16 }}>
        {tr(copy.intro)}
      </p>

      <div className="form-rail">
        <span className="form-rail__label">{t.progressLabel}</span>
        <div className="form-rail__pips">
          {sections.map((section) => (
            <button
              key={section.n}
              type="button"
              className="reset-button pip"
              data-filled={Boolean(filled[section.n])}
              aria-expanded={open[section.n]}
              aria-controls={`section-${section.n}`}
              onClick={() => toggle(section.n)}
            >
              {section.n}
              <span className="visually-hidden">
                {": "}
                {tr(section.title)}
                {filled[section.n] ? `, ${extra.sectionFilled}` : ""}
              </span>
            </button>
          ))}
        </div>
        <div className="form-rail__actions">
          <button type="button" className="reset-button linkish" onClick={() => setAll(true)}>
            {t.expandAll}
          </button>
          <button
            type="button"
            className="reset-button linkish linkish--muted"
            onClick={() => setAll(false)}
          >
            {t.collapseAll}
          </button>
        </div>
      </div>

      {/* Validation stays on so the consent checkbox is genuinely required. */}
      <form ref={formRef} onSubmit={handleSubmit} onChange={bump} onClick={bump}>
        <div className="form-sections">
          {sections.map((section) => (
            <section className="fsection" key={section.n}>
              <h2 style={{ margin: 0 }}>
                <button
                  type="button"
                  className="reset-button fsection__toggle"
                  aria-expanded={open[section.n]}
                  aria-controls={`section-${section.n}`}
                  onClick={() => toggle(section.n)}
                >
                  <span className="fsection__n">{section.n}</span>
                  <span className="fsection__title">{tr(section.title)}</span>
                  {/* Always rendered: its margin-left:auto is what pushes the chevron right. */}
                  <span className="fsection__hint">{section.hint ? tr(section.hint) : ""}</span>
                  <span className="fsection__chevron" aria-hidden="true">
                    ▾
                  </span>
                </button>
              </h2>

              {/* Height animates via grid-template-rows; `inert` keeps the
                  collapsed content out of tab order and the a11y tree. */}
              <div
                className="fsection__panel"
                id={`section-${section.n}`}
                data-open={open[section.n]}
                inert={!open[section.n]}
              >
                <div className="fsection__panel-inner">
                  <div className="fsection__body">
                    {section.fields.map((field) => (
                      <FormFieldView
                        key={field.label}
                        field={field}
                        sectionN={section.n}
                        lang={lang}
                        tr={tr}
                        onFilesChange={(name, files) => {
                          pendingFiles.current[name] = files;
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}

          {isVolunteer ? (
            <>
              <section className="panel panel--donate">
                <label className="donate-toggle">
                  <input
                    type="checkbox"
                    name="financial-contribution"
                    checked={donate}
                    onChange={() => setDonate((v) => !v)}
                  />
                  <span>
                    <span className="donate-toggle__title">{t.donateTitle}</span>
                    <span className="donate-toggle__body">{t.donateBody}</span>
                  </span>
                </label>

                <div className="pmdrf-panel" data-open={donate} inert={!donate}>
                  <div className="pmdrf-panel__inner">
                    <div className="pmdrf">
                      <div className="maxw-56">
                        <div className="panel__title">{t.pmdrfTitle}</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)" }}>
                          {t.pmdrfBody}
                        </div>
                      </div>
                      <a
                        href={PMDRF_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pmdrf__cta"
                      >
                        {t.pmdrfCta} →
                      </a>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel panel--organize">
                <div className="panel__title">{t.organizeTitle}</div>
                <p className="panel__body">{t.organizeBody}</p>
                <div className="checkgrid">
                  {ORGANIZE_OPTIONS.map((option) => (
                    <label className="checkchip checkchip--soft" key={option}>
                      <input type="checkbox" name="organizing-help" value={option} />
                      <span>{tr(option)}</span>
                    </label>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="panel panel--example">
              <span className="eyebrow--label">{t.writeLike}</span>
              <p className="quote">{t.exampleQuote}</p>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>{t.writeLikeNote}</p>
            </section>
          )}

          <section className="submitbar">
            <label className="consent">
              <input type="checkbox" name="consent" required />
              <span>{tr(copy.consent)}</span>
            </label>
            <button type="submit" className="btn btn--dark" disabled={submitting}>
              {tr(copy.cta)} <span aria-hidden="true">→</span>
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}
