import Combobox from "@/components/Combobox";
import FileUpload from "@/components/FileUpload";
import LocationField from "@/components/LocationField";
import { added } from "@/lib/added-strings";
import type { Lang } from "@/lib/content";
import { districtOptions } from "@/lib/districts";
import type { EnhancedField } from "@/lib/form-schema";

/** Stable, unique control name/id from the section number and label. */
export function fieldKey(sectionN: string, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `s${sectionN}-${slug}`;
}

export default function FormFieldView({
  field,
  sectionN,
  lang,
  tr,
}: {
  field: EnhancedField;
  sectionN: string;
  lang: Lang;
  tr: (value: string) => string;
}) {
  const key = fieldKey(sectionN, field.label);
  const label = tr(field.label);
  const placeholder = field.ph ? tr(field.ph) : undefined;
  const describedBy = field.note ? `${key}-note` : undefined;
  const extra = added(lang);

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
            notStored: extra.uploadNotStored,
          }}
        />
      ) : null}

      {field.isText && !field.widget ? (
        <input
          className="input"
          id={key}
          name={key}
          type="text"
          placeholder={placeholder}
          aria-describedby={describedBy}
        />
      ) : null}

      {field.isSelect && !field.widget ? (
        <select className="select" id={key} name={key} defaultValue="" aria-describedby={describedBy}>
          {(field.options ?? []).map((option, i) => (
            <option key={option} value={i === 0 ? "" : option}>
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
        <span className="field__note" id={describedBy}>
          {tr(field.note)}
        </span>
      ) : null}
    </>
  );

  if (isGroup) {
    return (
      <div className="field" role="group" aria-labelledby={`${key}-legend`} style={{ gridColumn: field.span }}>
        <span className="field__label" id={`${key}-legend`}>
          {label}
        </span>
        {control}
      </div>
    );
  }

  return (
    <div className="field" style={{ gridColumn: field.span }}>
      <label className="field__label" htmlFor={key}>
        {label}
      </label>
      {control}
    </div>
  );
}
