"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import Combobox from "@/components/Combobox";
import { useToast } from "@/components/ToastProvider";
import { added } from "@/lib/added-strings";
import { messageFor } from "@/lib/form-errors";
import type { Lang } from "@/lib/content";
import { districtOptions } from "@/lib/districts";
import { SubmissionValidationError, newIdempotencyKey, submitRequest } from "@/lib/api";
import type { FieldError } from "@/lib/intake-schema";
import { confirmationPath } from "@/lib/routes";
import {
  EXAMPLE_ITEM_NEED,
  RELIEF_CATEGORIES,
  categoryById,
  categoryLabel,
  formatQuantity,
  unitLabel,
  type ItemNeed,
} from "@/lib/relief";

const UNMATCHED = "__unmatched__";

/**
 * Offer relief items.
 *
 * The request selector comes first and is required, because that ordering is
 * the whole safeguard: an offer tied to a published request is supply that was
 * asked for. Choosing "no one has requested this yet" is allowed — refusing it
 * would only push the offer off-platform where nobody can see it — but it warns
 * plainly and the resulting listing carries an unrequested label.
 */
export default function ReliefOfferForm({
  lang,
  itemNeeds,
  preselect,
}: {
  lang: Lang;
  /** Verified item needs, fetched server-side by the page that renders this. */
  itemNeeds: ItemNeed[];
  /** `?need=<id>` from the "pledge items for this request" link. */
  preselect?: string;
}) {
  const router = useRouter();
  const extra = added(lang);
  const { showToast } = useToast();
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Errors were shown as a toast carrying the server's English. A toast is the
  // wrong shape for "this field is wrong" — it disappears, it is not tied to
  // the control, and a screen reader never associates the two — and the English
  // was simply the wrong language for most of the people this form is for.
  const [errors, setErrors] = useState<FieldError[]>([]);
  const messages = new Map(errors.map((problem) => [problem.field, messageFor(problem, extra)]));

  // The example is offerable so the flow can be walked before anything is live.
  const openNeeds = [...itemNeeds, EXAMPLE_ITEM_NEED];
  const [target, setTarget] = useState(
    preselect && openNeeds.some((n) => n.id === preselect) ? preselect : ""
  );
  // One key per filled-in offer, so a retried send resolves to the pledge that
  // already exists rather than double-counting the supply.
  const idempotencyKey = useRef(newIdempotencyKey());
  const unmatched = target === UNMATCHED;
  const selectedNeed = openNeeds.find((n) => n.id === target);
  const selectedCategory = categoryById(unmatched ? category : (selectedNeed?.category ?? ""));

  /**
   * Moves the cursor to the control that was refused.
   *
   * Without this a keyboard or screen-reader user is told something is wrong
   * and left wherever they were — usually the submit button, at the bottom,
   * with the failing field somewhere above and unannounced.
   */
  function focusFirstError(list: FieldError[]) {
    const first = list.find((problem) => problem.field);
    if (!first) return;
    const control = document.getElementById(first.field);
    if (control instanceof HTMLElement) {
      control.focus();
      control.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  /** The refusal for one control, in the reader's language, or nothing. */
  function fieldError(id: string) {
    const message = messages.get(id);
    if (!message) return null;
    return (
      <span className="field__error" id={`${id}-error`}>
        {message}
      </span>
    );
  }

  /** aria wiring, matching what FormField already does for the other forms. */
  function errorProps(id: string) {
    return messages.has(id)
      ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` }
      : {};
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrors([]);
    try {
      const result = await submitRequest(
        "relief-offer",
        lang,
        new FormData(event.currentTarget),
        idempotencyKey.current
      );
      // Same reasoning as RequestForm: leave for the confirmation page and keep
      // the button disabled while the navigation is in flight.
      router.push(confirmationPath(lang, "relief-offer", result.id));
    } catch (err) {
      // The server refuses an offer against a need that is already met or no
      // longer listed. That is a real answer about the request, not an outage,
      // so it is shown rather than reported as "something went wrong".
      if (err instanceof SubmissionValidationError) {
        setErrors(err.errors);
        focusFirstError(err.errors);
        setSubmitting(false);
        return;
      }
      console.error("Relief offer submission failed", err);
      showToast(extra.submitError);
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--form">
      <p className="eyebrow" style={{ marginBottom: 12 }}>
        {extra.reliefTitle}
      </p>
      <h1 className="h1 h1--form">{extra.reliefOfferTitle}</h1>
      <p className="lede" style={{ maxWidth: "64ch", fontSize: 16 }}>
        {extra.reliefOfferIntro}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-sections">
          <section className="fsection">
            <div className="fsection__body" style={{ borderTop: 0, paddingTop: 22 }}>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="field__label" htmlFor="relief-target">
                  {extra.reliefPickNeed}
                </label>
                <select
                  className="select"
                  id="relief-target"
                  {...errorProps("relief-target")}
                  name="relief-target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {openNeeds.map((need) => {
                    const c = categoryById(need.category);
                    return (
                      <option key={need.id} value={need.id}>
                        {c ? categoryLabel(c, lang) : need.category} · {formatQuantity(need, lang)} ·{" "}
                        {need.municipality}
                      </option>
                    );
                  })}
                  <option value={UNMATCHED}>{extra.reliefPickNeedNone}</option>
                </select>
                  {fieldError("relief-target")}
                </div>

              {unmatched ? (
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <p className="notice notice--warn" role="note" style={{ margin: 0 }}>
                    {extra.reliefUnmatchedWarning}
                  </p>
                </div>
              ) : null}

              {unmatched ? (
                <div className="field">
                  <label className="field__label" htmlFor="relief-category">
                    {extra.reliefItem}
                  </label>
                  <select
                    className="select"
                    id="relief-category"
                    {...errorProps("relief-category")}
                    name="relief-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="">—</option>
                    {RELIEF_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {categoryLabel(c, lang)}
                      </option>
                    ))}
                  </select>
                  {fieldError("relief-category")}
                </div>
              ) : null}

              <div className="field">
                <label className="field__label" htmlFor="relief-quantity">
                  {extra.reliefYourItems}
                  {selectedCategory ? ` (${unitLabel(selectedCategory, lang)})` : ""}
                </label>
                <input
                  className="input"
                  id="relief-quantity"
                  {...errorProps("relief-quantity")}
                  name="relief-quantity"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="0"
                  required
                />
                {selectedCategory?.newOnly ? (
                  <span className="field__note">{extra.reliefNewOnly}</span>
                ) : null}
                  {fieldError("relief-quantity")}
                </div>

              <div className="field">
                <label className="field__label" htmlFor="relief-where">
                  {extra.reliefWhereGoods}
                </label>
                <Combobox
                  id="relief-where"
                  name="relief-where"
                  options={districtOptions(lang)}
                  placeholder={extra.districtPlaceholder}
                  emptyLabel={extra.districtEmpty}
                />
              </div>

              <div className="field">
                <label className="field__label" htmlFor="relief-available">
                  {extra.reliefAvailableFrom}
                </label>
                <input
                  className="input"
                  id="relief-available"
                  {...errorProps("relief-available")}
                  name="relief-available"
                  type="text"
                  placeholder="DD / MM / YYYY"
                />
                  {fieldError("relief-available")}
                </div>

              <div className="field">
                <label className="field__label" htmlFor="relief-delivery">
                  {extra.reliefCanDeliver}
                </label>
                <select className="select" id="relief-delivery" name="relief-delivery" defaultValue="">
                  <option value="">—</option>
                  <option>{lang === "np" ? "म पुर्‍याउन सक्छु" : "I can deliver"}</option>
                  <option>
                    {lang === "np" ? "संकलन गर्नुपर्छ" : "Needs collection"}
                  </option>
                  <option>
                    {lang === "np" ? "ढुवानी खर्च दिन सक्छु" : "I can fund transport"}
                  </option>
                </select>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="field__label" htmlFor="relief-contact">
                  {extra.reliefContact}
                </label>
                <input
                  className="input"
                  id="relief-contact"
                  {...errorProps("relief-contact")}
                  name="relief-contact"
                  type="text"
                  placeholder="+977"
                  required
                />
                  {fieldError("relief-contact")}
                </div>
            </div>
          </section>

          <section className="panel panel--donate">
            <h2 className="panel__title">{extra.reliefNoCustodyTitle}</h2>
            <p className="panel__body" style={{ marginBottom: 0 }}>
              {extra.reliefNoCustodyBody}
            </p>
          </section>

          <section className="submitbar">
            <label className="consent">
              <input type="checkbox" name="consent" required />
              <span>{extra.reliefConsent}</span>
            </label>
            <button type="submit" className="btn btn--dark" disabled={submitting}>
              {extra.reliefSubmitOffer} <span aria-hidden="true">→</span>
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}
