"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import Combobox from "@/components/Combobox";
import FileUpload from "@/components/FileUpload";
import { useToast } from "@/components/ToastProvider";
import { added } from "@/lib/added-strings";
import { messageFor } from "@/lib/form-errors";
import {
  SubmissionValidationError,
  newIdempotencyKey,
  submitRequest,
} from "@/lib/api";
import type { Dict, Lang } from "@/lib/content";
import { districtOptions } from "@/lib/districts";
import {
  N3,
  NEED_TYPES,
  NEED_URGENCY,
  NEED_WORK_MODES,
  validateNeedV3,
  type FieldError,
} from "@/lib/intake-schema";
import { translator } from "@/lib/i18n";
import { confirmationPath } from "@/lib/routes";
import { uploadDocuments, type UploadOutcome } from "@/lib/uploads";

/**
 * Posting a need, in three steps.
 *
 * The form this replaces asked nine sections — exact coordinates, equipment on
 * site, accommodation, objectives, required experience level — of someone who
 * is by definition in the middle of something bad. Most of it is a
 * coordinator's job to establish during verification, and asking for it up
 * front is how a request gets abandoned halfway through.
 *
 * So: what and where, how to reach you, then check it. Everything else is
 * worked out on the follow-up, and the form says so rather than leaving people
 * to guess whether they have under-answered.
 */

type Step = 0 | 1 | 2;
type Values = Record<string, string>;

const DRAFT_KEY = "hrn:need-draft:v3";

/** Which fields belong to which step, so an error can send you to the right one. */
const STEP_FIELDS: string[][] = [
  [N3.type, N3.title, N3.detail, N3.district, N3.municipality, N3.workMode, N3.urgency],
  [N3.organization, N3.person, N3.email, N3.phone, "consent"],
  [],
];

export default function NeedIntakeForm({ lang, t }: { lang: Lang; t: Dict }) {
  const router = useRouter();
  const tr = translator(lang);
  const a = added(lang);
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>(0);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [draftOffer, setDraftOffer] = useState(false);
  const [attachments, setAttachments] = useState<UploadOutcome[] | null>(null);

  const files = useRef<File[]>([]);
  const idempotencyKey = useRef(newIdempotencyKey());
  const formRef = useRef<HTMLFormElement>(null);

  const set = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const errorFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const problem of errors) map.set(problem.field, messageFor(problem, a));
    return map;
  }, [errors, a]);

  /**
   * A draft is kept on the device only, never sent. Someone filling this in on
   * a phone with a bad connection should not lose it to a dropped tab, but a
   * half-written request is not something to store on our side without being
   * asked — nobody has consented to anything at that point.
   */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(DRAFT_KEY)) setDraftOffer(true);
    } catch {
      // Private browsing or storage disabled. Drafts are a convenience.
    }
  }, []);

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
      showToast(a.n3DraftSaved);
    } catch {
      showToast(a.submitError);
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Nothing to clean up.
    }
  }

  /**
   * Uncontrolled children — the district combobox writes to a hidden input,
   * the file picker to its own — so the live form is read rather than mirrored
   * into state. Only non-empty entries override, so moving between steps never
   * blanks an answer whose control is no longer rendered.
   */
  function captureDom(): Values {
    const dom: Values = {};
    const el = formRef.current;
    if (!el) return dom;
    for (const [key, value] of new FormData(el).entries()) {
      if (typeof value === "string" && value.trim() !== "") dom[key] = value;
    }
    return dom;
  }

  function payload(extra: Values = {}): Values {
    return { ...values, ...captureDom(), ...extra, __form_version: "3" };
  }

  function goToFirstError(list: FieldError[]) {
    const target = list.find((problem) => problem.field);
    if (!target) return;
    const owning = STEP_FIELDS.findIndex((keys) => keys.includes(target.field));
    if (owning >= 0 && owning !== step) setStep(owning as Step);
    requestAnimationFrame(() => {
      const control = formRef.current?.querySelector<HTMLElement>(
        `[name="${CSS.escape(target.field)}"]`
      );
      control?.focus();
      control?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  /** Validate only the fields this step owns, so step one cannot block on step two. */
  function advance() {
    // Persist what the uncontrolled controls hold before their step unmounts.
    const merged = payload();
    setValues(merged);
    const result = validateNeedV3(merged);
    const mine = result.ok
      ? []
      : result.errors.filter((problem) => STEP_FIELDS[step].includes(problem.field));

    if (mine.length > 0) {
      setErrors(mine);
      goToFirstError(mine);
      return;
    }
    setErrors([]);
    setStep((s) => Math.min(2, s + 1) as Step);
  }

  async function send(extra: Values = {}) {
    if (submitting) return;

    const body = payload(extra);
    const result = validateNeedV3(body);
    if (!result.ok) {
      setErrors(result.errors);
      goToFirstError(result.errors);
      return;
    }

    setErrors([]);
    setSubmitting(true);

    try {
      const form = new FormData();
      for (const [key, value] of Object.entries(body)) form.append(key, value);

      const saved = await submitRequest("need", lang, form, idempotencyKey.current);
      clearDraft();

      if (saved.id && files.current.length > 0) {
        const summary = await uploadDocuments(saved.id, files.current, saved.uploadTicket);
        if (summary.failed > 0) {
          // The request is saved either way; only the photos need another go.
          setAttachments(summary.results);
          setSubmitting(false);
          return;
        }
      }

      router.push(confirmationPath(lang, "need", saved.id));
    } catch (err) {
      if (err instanceof SubmissionValidationError) {
        setErrors(err.errors);
        goToFirstError(err.errors);
        setSubmitting(false);
        return;
      }
      console.error("Need submission failed", err);
      showToast(a.submitError);
      setSubmitting(false);
    }
  }

  const Err = ({ field }: { field: string }) =>
    errorFor.has(field) ? (
      <span className="field__error" id={`${field}-error`}>
        {errorFor.get(field)}
      </span>
    ) : null;

  const invalid = (field: string) => (errorFor.has(field) ? true : undefined);
  const describe = (field: string, note?: string) =>
    [note ? `${field}-note` : null, errorFor.has(field) ? `${field}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="page page--form">
      <p className="eyebrow" style={{ marginBottom: 12 }}>
        {tr("I need support")}
      </p>
      <h1 className="h1 h1--form">{t.postCta}</h1>
      <p className="lede" style={{ maxWidth: "62ch", fontSize: 16 }}>
        {a.n3Intro}
      </p>

      {draftOffer ? (
        <div className="notice" role="status" style={{ marginBottom: 18 }}>
          <strong>{a.n3DraftFound}</strong>
          <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn--dark btn--sm"
              onClick={() => {
                try {
                  const saved = window.localStorage.getItem(DRAFT_KEY);
                  if (saved) setValues(JSON.parse(saved) as Values);
                } catch {
                  showToast(a.submitError);
                }
                setDraftOffer(false);
              }}
            >
              {a.n3DraftRestore}
            </button>
            <button
              type="button"
              className="reset-button linkish"
              onClick={() => {
                clearDraft();
                setDraftOffer(false);
              }}
            >
              {a.n3DraftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      {attachments ? (
        <div className="notice notice--warn" role="status" style={{ marginBottom: 18 }}>
          <strong>{a.attachTitle}</strong>
          <p style={{ margin: "6px 0 10px" }}>{a.attachIntro}</p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
            {attachments.map((outcome) => (
              <li key={`${outcome.file.name}-${outcome.file.size}`}>
                {outcome.file.name} —{" "}
                {outcome.status === "uploaded" ? a.attachUploaded : a.attachFailed}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="reset-button linkish"
            onClick={() => router.push(confirmationPath(lang, "need"))}
          >
            {a.attachContinue}
          </button>
        </div>
      ) : null}

      {/* The assisted path. Offered before the form rather than buried at the
          end, because the person who needs it is the one least likely to reach
          the end. */}
      {assisted ? (
        <form
          ref={formRef}
          className="panel panel--organize"
          onSubmit={(event) => {
            event.preventDefault();
            void send({ [N3.assist]: "on" });
          }}
        >
          <h2 className="panel__title">{a.n3AssistTitle}</h2>
          <p className="panel__body">{a.n3AssistBody}</p>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="field__label" htmlFor={N3.organization}>
              {a.n3Organization}
            </label>
            <input
              className="input"
              id={N3.organization}
              name={N3.organization}
              value={values[N3.organization] ?? ""}
              onChange={(e) => set(N3.organization, e.target.value)}
              aria-invalid={invalid(N3.organization)}
              aria-describedby={describe(N3.organization)}
              maxLength={200}
            />
            <Err field={N3.organization} />
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label className="field__label" htmlFor={N3.phone}>
              {a.n3Phone}
            </label>
            <input
              className="input"
              id={N3.phone}
              name={N3.phone}
              type="tel"
              value={values[N3.phone] ?? ""}
              onChange={(e) => set(N3.phone, e.target.value)}
              aria-invalid={invalid(N3.phone)}
              aria-describedby={describe(N3.phone)}
              maxLength={32}
            />
            <Err field={N3.phone} />
          </div>

          <label className="consent" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              name="consent"
              checked={values.consent === "on"}
              onChange={(e) => set("consent", e.target.checked ? "on" : "")}
              aria-invalid={invalid("consent")}
            />
            <span>{a.n3AssistConsent}</span>
          </label>
          <Err field="consent" />

          <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn--dark" disabled={submitting}>
              {a.n3AssistSubmit}
            </button>
            <button
              type="button"
              className="reset-button linkish"
              onClick={() => {
                setAssisted(false);
                setErrors([]);
              }}
            >
              {a.n3AssistBack}
            </button>
          </div>
        </form>
      ) : (
        <>
          <ol className="n3-steps" aria-label={a.n3ReviewTitle}>
            {[a.n3StepNeed, a.n3StepContact, a.n3StepReview].map((label, i) => (
              <li key={label} aria-current={step === i ? "step" : undefined}>
                <span className="n3-steps__n">{i + 1}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>

          {errors.length > 0 ? (
            <div className="notice notice--warn" role="alert">
              <strong>{a.errorSummaryTitle}</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                {errors.map((problem) => (
                  <li key={`${problem.field}-${problem.code}`}>{messageFor(problem, a)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault();
              if (step < 2) advance();
              else void send();
            }}
          >
            {step === 0 ? (
              <div className="form-sections">
                <section className="fsection">
                  <div className="fsection__body" style={{ borderTop: 0, paddingTop: 20 }}>
                    <fieldset className="field" style={{ gridColumn: "1 / -1", border: 0, padding: 0 }}>
                      <legend className="field__label">{a.n3Type}</legend>
                      <span className="field__note" id={`${N3.type}-note`}>
                        {a.n3TypeHint}
                      </span>
                      <div className="checkgrid">
                        {NEED_TYPES.map((option) => (
                          <label className="checkchip" key={option}>
                            <input
                              type="radio"
                              name={N3.type}
                              value={option}
                              checked={values[N3.type] === option}
                              onChange={() => set(N3.type, option)}
                            />
                            <span>{tr(option)}</span>
                          </label>
                        ))}
                      </div>
                      <Err field={N3.type} />
                    </fieldset>

                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <label className="field__label" htmlFor={N3.title}>
                        {a.n3Title}
                      </label>
                      <input
                        className="input"
                        id={N3.title}
                        name={N3.title}
                        value={values[N3.title] ?? ""}
                        onChange={(e) => set(N3.title, e.target.value)}
                        aria-invalid={invalid(N3.title)}
                        aria-describedby={describe(N3.title, a.n3TitleHint)}
                        maxLength={200}
                      />
                      <span className="field__note" id={`${N3.title}-note`}>
                        {a.n3TitleHint}
                      </span>
                      <Err field={N3.title} />
                    </div>

                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <label className="field__label" htmlFor={N3.detail}>
                        {a.n3Detail}
                      </label>
                      <textarea
                        className="textarea"
                        id={N3.detail}
                        name={N3.detail}
                        rows={5}
                        value={values[N3.detail] ?? ""}
                        onChange={(e) => set(N3.detail, e.target.value)}
                        aria-invalid={invalid(N3.detail)}
                        aria-describedby={describe(N3.detail, a.n3DetailHint)}
                        maxLength={4000}
                      />
                      <span className="field__note" id={`${N3.detail}-note`}>
                        {a.n3DetailHint}
                      </span>
                      <Err field={N3.detail} />
                    </div>

                    <div className="field">
                      {/* A <label> rather than a <span>: this is one control,
                          so the association has to be real. */}
                      <label className="field__label" htmlFor={N3.district}>
                        {a.n3District}
                      </label>
                      <Combobox
                        name={N3.district}
                        options={districtOptions(lang)}
                        placeholder={a.districtPlaceholder}
                        emptyLabel={a.districtEmpty}
                      />
                      <Err field={N3.district} />
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor={N3.municipality}>
                        {a.n3Municipality}
                      </label>
                      <input
                        className="input"
                        id={N3.municipality}
                        name={N3.municipality}
                        value={values[N3.municipality] ?? ""}
                        onChange={(e) => set(N3.municipality, e.target.value)}
                        aria-describedby={`${N3.municipality}-note`}
                        maxLength={200}
                      />
                      <span className="field__note" id={`${N3.municipality}-note`}>
                        {a.n3MunicipalityHint}
                      </span>
                    </div>

                    <fieldset className="field" style={{ border: 0, padding: 0 }}>
                      <legend className="field__label">{a.n3WorkMode}</legend>
                      <div className="checkgrid">
                        {NEED_WORK_MODES.map((option) => (
                          <label className="checkchip" key={option}>
                            <input
                              type="radio"
                              name={N3.workMode}
                              value={option}
                              checked={values[N3.workMode] === option}
                              onChange={() => set(N3.workMode, option)}
                            />
                            <span>{tr(option)}</span>
                          </label>
                        ))}
                      </div>
                      <Err field={N3.workMode} />
                    </fieldset>

                    <fieldset className="field" style={{ border: 0, padding: 0 }}>
                      <legend className="field__label">{a.n3Urgency}</legend>
                      <div className="checkgrid">
                        {NEED_URGENCY.map((option) => (
                          <label className="checkchip" key={option}>
                            <input
                              type="radio"
                              name={N3.urgency}
                              value={option}
                              checked={values[N3.urgency] === option}
                              onChange={() => set(N3.urgency, option)}
                            />
                            <span>{tr(option)}</span>
                          </label>
                        ))}
                      </div>
                      <Err field={N3.urgency} />
                    </fieldset>
                  </div>
                </section>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="form-sections">
                <section className="fsection">
                  <div className="fsection__body" style={{ borderTop: 0, paddingTop: 20 }}>
                    <div className="field">
                      <label className="field__label" htmlFor={N3.organization}>
                        {a.n3Organization}
                      </label>
                      <input
                        className="input"
                        id={N3.organization}
                        name={N3.organization}
                        value={values[N3.organization] ?? ""}
                        onChange={(e) => set(N3.organization, e.target.value)}
                        aria-invalid={invalid(N3.organization)}
                        aria-describedby={describe(N3.organization, a.n3OrganizationHint)}
                        maxLength={200}
                      />
                      <span className="field__note" id={`${N3.organization}-note`}>
                        {a.n3OrganizationHint}
                      </span>
                      <Err field={N3.organization} />
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor={N3.person}>
                        {a.n3Person}
                      </label>
                      <input
                        className="input"
                        id={N3.person}
                        name={N3.person}
                        value={values[N3.person] ?? ""}
                        onChange={(e) => set(N3.person, e.target.value)}
                        maxLength={200}
                      />
                    </div>

                    {/* Two boxes, not one. The old form ran email and phone
                        together, so no need ever had a usable contact_email —
                        and the matching engine will not introduce a requester
                        without one. */}
                    <div className="field">
                      <label className="field__label" htmlFor={N3.email}>
                        {a.n3Email}
                      </label>
                      <input
                        className="input"
                        id={N3.email}
                        name={N3.email}
                        type="email"
                        autoComplete="email"
                        value={values[N3.email] ?? ""}
                        onChange={(e) => set(N3.email, e.target.value)}
                        aria-invalid={invalid(N3.email)}
                        aria-describedby={describe(N3.email, a.n3ContactHint)}
                        maxLength={254}
                      />
                      <span className="field__note" id={`${N3.email}-note`}>
                        {a.n3ContactHint}
                      </span>
                      <Err field={N3.email} />
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor={N3.phone}>
                        {a.n3Phone}
                      </label>
                      <input
                        className="input"
                        id={N3.phone}
                        name={N3.phone}
                        type="tel"
                        autoComplete="tel"
                        value={values[N3.phone] ?? ""}
                        onChange={(e) => set(N3.phone, e.target.value)}
                        aria-invalid={invalid(N3.phone)}
                        aria-describedby={describe(N3.phone)}
                        maxLength={32}
                      />
                      <Err field={N3.phone} />
                    </div>

                    <div className="field" style={{ gridColumn: "1 / -1" }} role="group">
                      <span className="field__label">{a.n3Photos}</span>
                      <FileUpload
                        name={N3.photos}
                        labels={{
                          prompt: a.uploadPrompt,
                          browse: a.uploadBrowse,
                          limits: a.uploadLimits,
                          remove: a.uploadRemove,
                          rejectedType: a.uploadRejectedType,
                          rejectedSize: a.uploadRejectedSize,
                          rejectedCount: a.uploadRejectedCount,
                        }}
                        onFilesChange={(picked) => {
                          files.current = picked;
                        }}
                      />
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="form-sections">
                <section className="fsection">
                  <div className="fsection__body" style={{ borderTop: 0, paddingTop: 20 }}>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <h2 style={{ fontSize: 20 }}>{a.n3ReviewTitle}</h2>
                      <p className="field__note">{a.n3ReviewIntro}</p>

                      <div className="rowlist" style={{ marginTop: 14 }}>
                        {(
                          [
                            [a.n3Type, values[N3.type]],
                            [a.n3Title, values[N3.title]],
                            [a.n3Detail, values[N3.detail]],
                            [a.n3District, values[N3.district]],
                            [a.n3Municipality, values[N3.municipality]],
                            [a.n3WorkMode, values[N3.workMode]],
                            [a.n3Urgency, values[N3.urgency]],
                            [a.n3Organization, values[N3.organization]],
                            [a.n3Person, values[N3.person]],
                            [a.n3Email, values[N3.email]],
                            [a.n3Phone, values[N3.phone]],
                          ] as const
                        ).map(([label, value]) => (
                          <div className="row" key={label}>
                            <span className="fact__k">{label}</span>
                            <span
                              className="fact__v"
                              style={value ? undefined : { color: "var(--faint)" }}
                            >
                              {value ? tr(value) : a.n3NotAnswered}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="field__note" style={{ marginTop: 14 }}>
                        {a.n3RoleNote}
                      </p>

                      <label className="consent" style={{ marginTop: 16 }}>
                        <input
                          type="checkbox"
                          name="consent"
                          checked={values.consent === "on"}
                          onChange={(e) => set("consent", e.target.checked ? "on" : "")}
                          aria-invalid={invalid("consent")}
                        />
                        <span>{a.n3Consent}</span>
                      </label>
                      <Err field="consent" />
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            <div className="form-footer" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {step > 0 ? (
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
                >
                  {a.n3Back}
                </button>
              ) : null}

              <button type="submit" className="btn btn--dark" disabled={submitting}>
                {step < 2 ? a.n3Next : a.n3Submit} <span aria-hidden="true">→</span>
              </button>

              <button type="button" className="reset-button linkish" onClick={saveDraft}>
                {a.n3SaveDraft}
              </button>

              {step === 0 ? (
                <button
                  type="button"
                  className="reset-button linkish"
                  onClick={() => {
                    setAssisted(true);
                    setErrors([]);
                  }}
                >
                  {a.n3AssistCta}
                </button>
              ) : null}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

