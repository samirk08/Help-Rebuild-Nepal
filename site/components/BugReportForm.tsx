"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createBug } from "@/lib/bugs";
import { DOCUMENTS_BUCKET } from "@/lib/storage-constants";
import { supabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * File a bug, with screenshots.
 *
 * Paste is the primary way in: the actual workflow is Cmd+Shift+4 then Cmd+V,
 * and a screenshot taken that way has no file on disk to pick. A file input is
 * kept for anything already saved.
 *
 * The bug row is created first, then images upload straight from the browser
 * to Storage against its id — so an upload that fails cannot cost you the
 * written report, which is the part that took effort.
 */
export default function BugReportForm() {
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportedFrom, setReportedFrom] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Recorded as where the report was FILED, which is usually but not always
  // where the bug happened — the field label says so.
  useEffect(() => {
    setReportedFrom(`${window.innerWidth}×${window.innerHeight} · ${navigator.userAgent}`);
  }, []);

  function addFiles(incoming: FileList | File[] | null) {
    if (!incoming) return;
    const picked = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    if (picked.length > 0) setImages((prev) => [...prev, ...picked].slice(0, 8));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const formEl = event.currentTarget;
    const result = await createBug(new FormData(formEl));

    if (result.error || !result.id) {
      setError(result.error ?? "Could not save the report.");
      setBusy(false);
      return;
    }

    const browser = supabaseBrowserClient();
    for (const file of images) {
      try {
        const signRes = await fetch("/api/admin/bugs/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bugId: result.id,
            filename: file.name || "screenshot.png",
            mimeType: file.type,
            size: file.size,
          }),
        });
        if (!signRes.ok) throw new Error("sign failed");
        const { path, token } = (await signRes.json()) as { path: string; token: string };

        const { error: upErr } = await browser.storage
          .from(DOCUMENTS_BUCKET)
          .uploadToSignedUrl(path, token, file);
        if (upErr) throw upErr;

        await fetch("/api/admin/bugs/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bugId: result.id,
            path,
            filename: file.name || "screenshot.png",
            mimeType: file.type,
            size: file.size,
            confirm: true,
          }),
        });
      } catch (err) {
        // The written report is already saved. A lost screenshot is worth a
        // console line, not throwing away what was typed.
        console.error("bug screenshot upload failed", err);
      }
    }

    formEl.reset();
    setImages([]);
    setBusy(false);
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onPaste={(e) => addFiles(e.clipboardData?.files ?? null)}
      className="admin-detail"
    >
      <div className="admin-login__field">
        <label htmlFor="bug-title">What is broken</label>
        <input
          id="bug-title"
          name="title"
          className="input"
          required
          maxLength={200}
          placeholder="One line — e.g. District filter clears the skill dropdown"
        />
      </div>

      <div className="admin-form-row" style={{ marginBottom: 14 }}>
        <div style={{ flex: "1 1 260px" }}>
          <label className="field__label" htmlFor="bug-page">
            Where (page or URL)
          </label>
          <input
            id="bug-page"
            name="pageUrl"
            className="input"
            maxLength={500}
            placeholder="/en/needs?district=Kaski"
          />
        </div>
        <div>
          <label className="field__label" htmlFor="bug-severity">
            Severity
          </label>
          <select id="bug-severity" name="severity" defaultValue="normal">
            <option value="blocking">Blocking</option>
            <option value="normal">Normal</option>
            <option value="minor">Minor</option>
          </select>
        </div>
      </div>

      <div className="admin-login__field">
        <label htmlFor="bug-detail">What happened, and what you expected</label>
        <textarea
          id="bug-detail"
          name="detail"
          className="admin-textarea"
          maxLength={8000}
          placeholder="Steps to reproduce. If you saw it on a different device than this one, say which."
        />
      </div>

      <input type="hidden" name="reportedFrom" value={reportedFrom} />

      <div className="admin-login__field">
        <label htmlFor="bug-images">Screenshots</label>
        <p className="field__note" style={{ marginBottom: 6 }}>
          Take one with Cmd+Shift+4 and paste anywhere in this form, or choose a file. Up to 8.
        </p>
        <input
          id="bug-images"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addFiles(e.currentTarget.files)}
        />
        {images.length > 0 ? (
          <ul className="admin-doc-list" style={{ marginTop: 10 }}>
            {images.map((file, i) => (
              <li key={`${file.name}-${i}`}>
                {file.name || "pasted screenshot"} · {Math.round(file.size / 1024)} KB{" "}
                <button
                  type="button"
                  className="reset-button"
                  style={{ color: "var(--red-2)", fontWeight: 600 }}
                  onClick={() => setImages((prev) => prev.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="admin-login__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn--dark btn--sm" disabled={busy}>
        {busy ? "Saving…" : "File this bug"}
      </button>
    </form>
  );
}
