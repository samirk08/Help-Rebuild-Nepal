"use client";

import { useMemo, useState } from "react";

import { formatCoords, mapUrl, parseLocation } from "@/lib/geo";

/**
 * "Exact location" — accepts a landmark description or any pasted map link, and
 * says out loud what it understood. A requester should never have to wonder
 * whether the coordinates they pasted were read correctly.
 */
export default function LocationField({
  name,
  placeholder,
  describedBy,
  labels,
}: {
  name: string;
  placeholder: string;
  describedBy?: string;
  labels: {
    recognised: string;
    outsideNepal: string;
    viewOnMap: string;
    landmark: string;
  };
}) {
  const [value, setValue] = useState("");
  const result = useMemo(() => parseLocation(value), [value]);

  return (
    <>
      <input
        className="input"
        id={name}
        name={name}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={[describedBy, `${name}-parse`].filter(Boolean).join(" ") || undefined}
      />

      {/* Announced politely: helpful confirmation, never an interruption. */}
      <p className="locfield__status" id={`${name}-parse`} role="status" aria-live="polite">
        {result.kind === "coords" ? (
          <>
            <span className={result.inNepal ? "locfield__ok" : "locfield__warn"}>
              {result.inNepal ? labels.recognised : labels.outsideNepal}
            </span>{" "}
            <span className="mono">{formatCoords(result.coords)}</span>{" "}
            <a href={mapUrl(result.coords)} target="_blank" rel="noopener noreferrer">
              {labels.viewOnMap}
            </a>
          </>
        ) : result.kind === "text" ? (
          <span className="locfield__hint">{labels.landmark}</span>
        ) : null}
      </p>

      {result.kind === "coords" ? (
        <>
          <input type="hidden" name={`${name}-lat`} value={result.coords.lat} />
          <input type="hidden" name={`${name}-lon`} value={result.coords.lon} />
        </>
      ) : null}
    </>
  );
}
