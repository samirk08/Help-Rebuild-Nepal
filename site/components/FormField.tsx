import Combobox from "@/components/Combobox";
import FileUpload from "@/components/FileUpload";
import LocationField from "@/components/LocationField";
import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { districtOptions } from "@/lib/districts";
import { fieldKey, isSelectPlaceholder, type EnhancedField } from "@/lib/form-schema";

export default function FormFieldView({
  field,
  sectionN,
  lang,
  tr,
  onFilesChange,
  error,
}: {
  field: EnhancedField;
  sectionN: string;
  lang: Lang;
  tr: (value: string) => string;
  /** Only consulted for the "files" widget — see FileUpload's own doc comment. */
  onFilesChange?: (fieldName: string, files: File[]) => void;
  /** What is wrong with this answer, already translated. */
  error?: string;
}) {
  const key = fieldKey(sectionN, field.label);
  const label = tr(field.label);
  const placeholder = field.ph ? tr(field.ph) : undefined;
  const extra = added(lang);
  const inputType = field.label === "Email" ? "email"
    : field.label === "Phone / WhatsApp" ? "tel"
    : sectionN === "05" && ["Start date", "Deadline"].includes(field.label) ? "date"
    : "text";
  const autoComplete = field.label === "Full name" ? "name"
    : field.label === "Email" ? "email"
    : field.label === "Phone / WhatsApp" ? "tel"
    : undefined;

  // The message is announced with the field rather than only in the summary
  // above, so someone tabbing back to a control hears why it was rejected.
  const errorId = error ? `${key}-error` : undefined;
  const describedBy =
    [field.note ? `${key}-note` : null, errorId].filter(Boolean).join(" ") || undefined;
  const invalid = error ? true : undefined;

  // Chip and radio groups label a set of controls, so they use a labelled group
  // rather than a <label> pointing at a single input.
  const isGroup = Boolean(field.isChips || field.isRadio || field.widget === "files");

  const control = (
    <>
      {field.widget === "district" ? (
        <Combobox
          name={key}
          options={districtOptions(lang)}
          placeholder={extra.districtPlaceholder}
          emptyLabel={extra.districtEmpty}
          describedBy={describedBy}
        />
      ) : field.widget === "location" ? (
        <LocationField
          name={key}
          placeholder={placeholder ?? ""}
          describedBy={describedBy}
          labels={{
            recognised: extra.locRecognised,
            outsideNepal: extra.locOutside,
            viewOnMap: extra.locViewMap,
            landmark: extra.locLandmark,
          }}
        />
      ) : field.widget === "files" ? (
        <FileUpload
          name={key}
          labels={{
            prompt: extra.uploadPrompt,
            browse: extra.uploadBrowse,
            limits: extra.uploadLimits,
            remove: extra.uploadRemove,
            rejectedType: extra.uploadRejectedType,
            rejectedSize: extra.uploadRejectedSize,
            rejectedCount: extra.uploadRejectedCount,
          }}
          onFilesChange={onFilesChange ? (files) => onFilesChange(key, files) : undefined}
        />
      ) : null}

      {field.isText && !field.widget ? (
        <input
          className="input"
          id={key}
          name={key}
          type={inputType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      ) : null}

      {field.isSelect && !field.widget ? (
        // Untouched controls, including collapsed sections, stay unanswered.
        <select
          className="select"
          id={key}
          name={key}
          defaultValue=""
          aria-describedby={describedBy}
          aria-invalid={invalid}
        >
          {!isSelectPlaceholder(field.options?.[0]) ? <option value="">{lang === "np" ? "छान्नुहोस्" : "Select…"}</option> : null}
          {(field.options ?? []).map((option, i) => (
            <option key={option} value={i === 0 && isSelectPlaceholder(option) ? "" : option}>
              {tr(option)}
            </option>
          ))}
        </select>
      ) : null}

      {field.isArea ? (
        <textarea
          className="textarea"
          id={key}
          name={key}
          rows={4}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      ) : null}

      {field.isChips ? (
        <div className="checkgrid">
          {(field.options ?? []).map((option) => (
            <label className="checkchip" key={option}>
              <input type="checkbox" name={key} value={option} />
              <span>{tr(option)}</span>
            </label>
          ))}
        </div>
      ) : null}

      {field.isRadio ? (
        <div className="radiolist">
          {(field.rows ?? []).map((row) => (
            <label className="radiorow" key={row.label}>
              <input type="radio" name={key} value={row.label} />
              <span className="dot" style={{ ["--dot-color" as string]: row.color }} aria-hidden="true" />
              <span className="radiorow__label">{tr(row.label)}</span>
              <span className="radiorow__note">{tr(row.note)}</span>
            </label>
          ))}
        </div>
      ) : null}

      {field.note ? (
        <span className="field__note" id={`${key}-note`}>
          {tr(field.note)}
        </span>
      ) : null}

      {error ? (
        <span className="field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </>
  );

  if (isGroup) {
    return (
      <div
        className="field"
        role="group"
        aria-labelledby={`${key}-legend`}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        data-invalid={invalid}
        style={{ gridColumn: field.span }}
      >
        <span className="field__label" id={`${key}-legend`}>
          {label}
        </span>
        {control}
      </div>
    );
  }

  return (
    <div className="field" data-invalid={invalid} style={{ gridColumn: field.span }}>
      <label className="field__label" htmlFor={key}>
        {label}
      </label>
      {control}
    </div>
  );
}
