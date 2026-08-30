"use client";

import { useRef, useState } from "react";

const MAX_FILES = 8;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/*,application/pdf";

type Rejected = { name: string; reason: "type" | "size" | "count" };

/**
 * Damage photographs, assessments and permits.
 *
 * The design asked people to paste a link, which assumes they already have
 * their photos hosted somewhere — an unreasonable ask from a ward office
 * during a disaster. This takes the files directly.
 *
 * There is no object storage behind the form yet, so what is submitted is the
 * file manifest (name, size, type), not the bytes. The picked File objects stay
 * on this component, ready to be handed to an upload call once storage exists.
 */
export default function FileUpload({
  name,
  labels,
}: {
  name: string;
  labels: {
    prompt: string;
    browse: string;
    limits: string;
    remove: string;
    rejectedType: string;
    rejectedSize: string;
    rejectedCount: string;
    notStored: string;
  };
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (incoming: FileList | null) => {
    if (!incoming) return;
    const next: File[] = [];
    const bad: Rejected[] = [];

    for (const file of Array.from(incoming)) {
      const okType = file.type.startsWith("image/") || file.type === "application/pdf";
      if (!okType) {
        bad.push({ name: file.name, reason: "type" });
      } else if (file.size > MAX_BYTES) {
        bad.push({ name: file.name, reason: "size" });
      } else if (files.length + next.length >= MAX_FILES) {
        bad.push({ name: file.name, reason: "count" });
      } else if (!files.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }

    if (next.length) setFiles((prev) => [...prev, ...next]);
    setRejected(bad);
  };

  const remove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setRejected([]);
  };

  const reasonLabel = (reason: Rejected["reason"]) =>
    reason === "type"
      ? labels.rejectedType
      : reason === "size"
        ? labels.rejectedSize
        : labels.rejectedCount;

  return (
    <div className="upload">
      <div
        className="upload__drop"
        data-dragging={dragging}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
      >
        <p className="upload__prompt">{labels.prompt}</p>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={() => inputRef.current?.click()}
        >
          {labels.browse}
        </button>
        <p className="upload__limits">{labels.limits}</p>
        <input
          ref={inputRef}
          type="file"
          className="visually-hidden"
          accept={ACCEPT}
          multiple
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length ? (
        <ul className="upload__list">
          {files.map((file, i) => (
            <li className="upload__item" key={`${file.name}-${file.size}`}>
              <span className="upload__name">{file.name}</span>
              <span className="upload__size mono">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="reset-button upload__remove"
                onClick={() => remove(i)}
                aria-label={`${labels.remove}: ${file.name}`}
              >
                ×
              </button>
              {/* Manifest travels with the form until object storage exists. */}
              <input
                type="hidden"
                name={`${name}-manifest`}
                value={`${file.name}|${file.size}|${file.type}`}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {rejected.length ? (
        <ul className="upload__rejected" role="status" aria-live="polite">
          {rejected.map((r) => (
            <li key={r.name}>
              {r.name}: {reasonLabel(r.reason)}
            </li>
          ))}
        </ul>
      ) : null}

      {files.length ? <p className="upload__note">{labels.notStored}</p> : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
