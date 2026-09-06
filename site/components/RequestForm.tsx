"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import FormFieldView from "@/components/FormField";
import { useToast } from "@/components/ToastProvider";
import { added } from "@/lib/added-strings";
import type { Dict, Lang } from "@/lib/content";
import { NEED_SECTIONS, VOLUNTEER_SECTIONS, fieldKey, type EnhancedSection } from "@/lib/form-schema";
import {
  SubmissionValidationError,
  newIdempotencyKey,
  submitRequest,
  type SubmissionKind,
} from "@/lib/api";
import { validateIntake, type FieldError } from "@/lib/intake-schema";
import { translator } from "@/lib/i18n";
import { confirmationPath } from "@/lib/routes";
import { ORGANIZE_OPTIONS, PMDRF_URL } from "@/lib/site-data";
import { uploadDocuments, type UploadOutcome } from "@/lib/uploads";

type Mode = "volunteer" | "post";

/** Sections 1 and 2 start open; the rest are collapsed until asked for. */
const INITIALLY_OPEN = 2;

/**
 * A saved submission whose attachments did not all land.
 *
 * Held separately from the form state because the request itself has already
 * succeeded: nothing here should read as "your submission failed", and the
 * only remaining decision is about the files.
 */
type AttachmentState = {
  submissionId: string;
  ticket?: string;
  results: UploadOutcome[];
  kind: SubmissionKind;
  retrying: boolean;
};

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
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [attachments, setAttachments] = useState<AttachmentState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Files live here, not in component state — a picked File never needs to
  // trigger a re-render of the form around it, only to be here when submit runs.
  const pendingFiles = useRef<Record<string, File[]>>({});
  /**
   * One key for this filled-in form, generated once and reused on every retry.
   *
   * That is what makes a retry safe: if the first request reached the database
   * but the response was lost, resending the same key resolves to the row that
   * already exists instead of registering the person twice.
   */
  const idempotencyKey = useRef(newIdempotencyKey());

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

  const errorByField = useMemo(
    () => new Map(errors.map((problem) => [problem.field, messageFor(problem, extra)])),
    [errors, extra]
  );

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

  /**
   * Puts the person on the first thing that needs fixing.
   *
   * A list of errors above a long collapsed form is not actionable — the field
   * it names may be inside a section that is closed, several screens away. So
   * the section is opened first, then the control is focused, which also means
   * a screen reader announces the field and its message rather than just a
   * count of problems.
   */
  function focusFirstError(list: FieldError[]) {
    const first = list[0];
    if (!first?.field) return;

    const sectionN = /^s(\d+)-/.exec(first.field)?.[1];
    if (sectionN) setOpen((prev) => ({ ...prev, [sectionN]: true }));

    // After the section's panel has been un-`inert`ed by the render above;
    // focusing an inert subtree silently does nothing.
    requestAnimationFrame(() => {
      const control = formRef.current?.querySelector<HTMLElement>(
        `[name="${CSS.escape(first.field)}"]`
      );
      control?.focus();
      control?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    // Captured before any `await`: React's synthetic event can detach
    // `currentTarget` once the handler yields, so `formRef` is what's safe to
    // use afterward, not `event.currentTarget`.
    const formEl = formRef.current;
    if (!formEl) return;

    const kind: SubmissionKind = isVolunteer ? "volunteer" : "need";

    // The same schema the API applies, run here first so the common mistakes
    // are caught without a round trip. The server still re-checks everything;
    // this is a convenience, never the enforcement.
    const payload: Record<string, string | string[]> = {};
    for (const [key, value] of new FormData(formEl).entries()) {
      if (typeof value !== "string") continue;
      const existing = payload[key];
      if (existing === undefined) payload[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else payload[key] = [existing, value];
    }

    const local = validateIntake(kind, payload);
    if (!local.ok) {
      setErrors(local.errors);
      focusFirstError(local.errors);
      return;
    }

    setErrors([]);
    setSubmitting(true);

    try {
      const result = await submitRequest(kind, lang, new FormData(formEl), idempotencyKey.current);

      const files = Object.values(pendingFiles.current).flat();
      if (result.id && files.length > 0) {
        const summary = await uploadDocuments(result.id, files, result.uploadTicket);

        // A partly-failed set of attachments stops the navigation. The request
        // itself is saved either way — that is what the panel says — so the
        // choice is retry the files or carry on, and neither one means filling
        // the form in again.
        if (summary.failed > 0) {
          setAttachments({
            submissionId: result.id,
            ticket: result.uploadTicket,
            results: summary.results,
            kind,
            retrying: false,
          });
          setSubmitting(false);
          return;
        }
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
      if (err instanceof SubmissionValidationError) {
        setErrors(err.errors);
        focusFirstError(err.errors);
        setSubmitting(false);
        return;
      }
      console.error("Submission failed", err);
      showToast(extra.submitError);
      setSubmitting(false);
    }
  }

  /** Re-uploads only the files that failed, against the submission that exists. */
  async function retryAttachments() {
    if (!attachments || attachments.retrying) return;
    setAttachments({ ...attachments, retrying: true });

    const failed = attachments.results.filter((r) => r.status === "failed").map((r) => r.file);
    const summary = await uploadDocuments(attachments.submissionId, failed, attachments.ticket);

    const merged = attachments.results.map((previous) => {
      if (previous.status === "uploaded") return previous;
      return summary.results.find((r) => r.file === previous.file) ?? previous;
    });

    if (merged.every((r) => r.status === "uploaded")) {
      router.push(confirmationPath(lang, attachments.kind, attachments.submissionId));
      return;
    }
    setAttachments({ ...attachments, results: merged, retrying: false });
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

      {errors.length > 0 ? (
        <div className="notice notice--warn" role="alert" tabIndex={-1}>
          <strong>{extra.errorSummaryTitle}</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            {errors.map((problem) => (
              <li key={`${problem.field}-${problem.code}`}>
                {labelFor(problem.field, sections, tr)}: {messageFor(problem, extra)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {attachments ? (
        <div className="notice notice--warn" role="status" style={{ marginBottom: 16 }}>
          <strong>{extra.attachTitle}</strong>
          <p style={{ margin: "6px 0 10px" }}>{extra.attachIntro}</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
            {attachments.results.map((outcome) => (
              <li key={`${outcome.file.name}-${outcome.file.size}`}>
                {outcome.file.name} —{" "}
                {outcome.status === "uploaded"
                  ? extra.attachUploaded
                  : `${extra.attachFailed}${outcome.message ? `: ${outcome.message}` : ""}`}
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn--dark"
              onClick={retryAttachments}
              disabled={attachments.retrying}
            >
              {attachments.retrying ? extra.attachRetrying : extra.attachRetry}
            </button>
            <button
              type="button"
              className="reset-button linkish"
              onClick={() =>
                router.push(confirmationPath(lang, attachments.kind, attachments.submissionId))
              }
            >
              {extra.attachContinue}
            </button>
          </div>
        </div>
      ) : null}

      {/* Validation stays on so the consent checkbox is genuinely required. */}
      <form ref={formRef} onSubmit={handleSubmit} onChange={bump} onClick={bump}>
        <input type="hidden" name="__form_version" value="2" />
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
                        error={errorByField.get(fieldKey(section.n, field.label))}
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
              <input
                type="checkbox"
                name="consent"
                required
                aria-invalid={errorByField.has("consent") || undefined}
                aria-describedby={errorByField.has("consent") ? "consent-error" : undefined}
              />
              <span>{tr(copy.consent)}</span>
            </label>
            {errorByField.has("consent") ? (
              <span className="field__error" id="consent-error">
                {errorByField.get("consent")}
              </span>
            ) : null}
            <button type="submit" className="btn btn--dark" disabled={submitting}>
              {tr(copy.cta)} <span aria-hidden="true">→</span>
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}

/**
 * The translated message for one validation code.
 *
 * The schema's English text is a fallback, not the string shown: these have to
 * be readable in Nepali too, and the code is what carries across languages.
 */
function messageFor(problem: FieldError, extra: ReturnType<typeof added>): string {
  switch (problem.code) {
    case "required":
      return extra.errRequired;
    case "too_long":
      return extra.errTooLong;
    case "too_short":
      return extra.errTooShort;
    case "invalid_email":
      return extra.errInvalidEmail;
    case "invalid_phone":
      return extra.errInvalidPhone;
    case "invalid_date":
      return extra.errInvalidDate;
    case "invalid_option":
      return extra.errInvalidOption;
    case "invalid_number":
      return extra.errInvalidNumber;
    case "consent_required":
      return extra.errConsent;
    default:
      return problem.message;
  }
}

/** The label a person actually saw, so the summary names the field they filled. */
function labelFor(
  field: string,
  sections: EnhancedSection[],
  tr: (value: string) => string
): string {
  for (const section of sections) {
    for (const candidate of section.fields) {
      if (fieldKey(section.n, candidate.label) === field) return tr(candidate.label);
    }
  }
  return field;
}
