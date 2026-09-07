import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import MatchingActionForm from "@/components/MatchingActionForm";
import { added } from "@/lib/added-strings";
import { statusLabel } from "@/lib/admin-render";
import { isLang, localePath, translator } from "@/lib/i18n";
import {
  closeRequest,
  recordOutcome,
  reopenRequest,
  respondToProposal,
  updateRequest,
} from "@/lib/requester-actions";
import { getRequesterView } from "@/lib/requester";

// Personal, and read live. Nothing to prerender.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const a = added(lang);
  return { title: a.rqTitle, description: a.rqIntro, robots: { index: false } };
}

export default async function RequestPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  const a = added(lang);
  const tr = translator(lang);
  const view = await getRequesterView();

  if (view.state === "signed-out") {
    return (
      <Shell title={a.rqTitle}>
        <p className="intro">{a.rqSignedOut}</p>
        <div className="btn-row">
          <Link href={localePath(lang, "/account/login")} className="btn btn--green btn--md">
            {a.rqSignIn}
          </Link>
        </div>
      </Shell>
    );
  }

  // A failed read must never read as "you have no request" — that is how a
  // second request gets filed for the same problem.
  if (view.state === "unavailable") {
    return (
      <Shell title={a.rqTitle}>
        <p className="notice notice--warn" role="alert">
          {a.rqUnavailable}
        </p>
      </Shell>
    );
  }

  if (view.state === "no-request") {
    return (
      <Shell title={a.rqNoRequest}>
        <p className="intro">{a.rqNoRequestBody}</p>
      </Shell>
    );
  }

  const r = view.request;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "np" ? "ne-NP" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const closed = r.status === "completed" || r.status === "rejected";

  return (
    <Shell title={r.title ?? a.rqTitle}>
      <div className="rowlist" style={{ marginBottom: 22 }}>
        <Row k={a.rqReference} v={r.reference} />
        <Row k={a.rqStatus} v={tr(statusLabel(r.status))} />
        <Row k={a.rqCoordinator} v={r.coordinator ?? a.rqNoCoordinator} />
        <Row k={a.rqFiledOn} v={fmt(r.createdAt)} />
      </div>

      {r.assisted ? (
        <p className="notice" role="status" style={{ marginBottom: 18 }}>
          {a.rqAssisted}
        </p>
      ) : null}

      {/* Correcting the request. The warning is shown before saving, not
          after — a volunteer's invitation being cancelled is not something to
          discover afterwards. */}
      <section className="panel panel--organize" style={{ marginBottom: 16 }}>
        <h2 className="panel__title">{a.rqEditTitle}</h2>
        <p className="panel__body">{a.rqEditWarning}</p>
        <MatchingActionForm action={updateRequest} label={a.rqEditSave} lang={lang}>
          <input type="hidden" name="version" value={r.version} />
          <label>
            {a.rqSummaryLabel}
            <input name="title" defaultValue={r.title ?? ""} maxLength={200} />
          </label>
          <label>
            {a.rqDetailLabel}
            <textarea name="detail" rows={5} defaultValue={r.detail ?? ""} maxLength={4000} />
          </label>
        </MatchingActionForm>
      </section>

      <section className="panel panel--organize" style={{ marginBottom: 16 }}>
        <h2 className="panel__title">{a.rqProposedTitle}</h2>
        {r.proposed.length === 0 ? (
          <p className="panel__body">{a.rqProposedEmpty}</p>
        ) : (
          <>
            {/* Roles, never names. People who declined a stranger's request
                should not be listed back to the requester. */}
            <p className="panel__body">{a.rqProposedNote}</p>
            <ul className="bullets" style={{ margin: "10px 0 14px" }}>
              {r.proposed.map((p, i) => (
                <li key={`${p.summary}-${i}`}>
                  <strong>{p.summary}</strong>
                  <span className="hint" style={{ display: "block", fontSize: 12 }}>
                    {tr(p.status)}
                    {p.respondedAt ? ` · ${fmt(p.respondedAt)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {r.proposed.some((p) => p.status === "accepted") ? (
              <MatchingActionForm action={respondToProposal} label={a.rqConfirm} lang={lang}>
                <input type="hidden" name="decision" value="confirm" />
                <label>
                  {a.rqOutcomeNote}
                  <input name="note" maxLength={500} />
                </label>
              </MatchingActionForm>
            ) : null}
          </>
        )}
      </section>

      <section className="panel panel--organize" style={{ marginBottom: 16 }}>
        <h2 className="panel__title">{a.rqOutcomeTitle}</h2>
        <p className="panel__body">{a.rqOutcomeIntro}</p>
        <MatchingActionForm action={recordOutcome} label={a.rqOutcomeSave} lang={lang}>
          <fieldset className="matching-skills">
            <legend>{a.rqOutcomeTitle}</legend>
            {(
              [
                ["yes", a.rqOutcomeYes],
                ["partly", a.rqOutcomePartly],
                ["no", a.rqOutcomeNo],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="met" value={value} required />
                {label}
              </label>
            ))}
          </fieldset>
          <label>
            {a.rqOutcomeNote}
            <textarea name="note" rows={3} maxLength={4000} />
          </label>
        </MatchingActionForm>
      </section>

      <section className="panel panel--organize" style={{ marginBottom: 16 }}>
        <h2 className="panel__title">{closed ? a.rqReopen : a.rqCloseTitle}</h2>
        <p className="panel__body">{closed ? a.rqReopenBody : a.rqCloseBody}</p>
        {closed ? (
          <MatchingActionForm action={reopenRequest} label={a.rqReopen} lang={lang}>
            <input type="hidden" name="version" value={r.version} />
          </MatchingActionForm>
        ) : (
          <MatchingActionForm action={closeRequest} label={a.rqClose} lang={lang}>
            <input type="hidden" name="version" value={r.version} />
            <label>
              {a.rqCloseReason}
              <input name="reason" maxLength={500} />
            </label>
          </MatchingActionForm>
        )}
      </section>

      {/* Append-only, so a closed-then-reopened request is distinguishable
          from one that was never closed. */}
      <section className="panel panel--organize">
        <h2 className="panel__title">{a.rqHistoryTitle}</h2>
        {r.events.length === 0 ? (
          <p className="panel__body">{a.rqHistoryEmpty}</p>
        ) : (
          <ul className="bullets" style={{ margin: "10px 0 0" }}>
            {r.events.map((e) => (
              <li key={e.id}>
                {tr(e.event.replace(/_/g, " "))}
                <span className="hint" style={{ display: "block", fontSize: 12 }}>
                  {fmt(e.createdAt)}
                  {e.detail ? ` · ${e.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page page--narrow">
      <h1 className="h1 h1--page">{title}</h1>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="row">
      <span className="fact__k">{k}</span>
      <span className="fact__v">{v}</span>
    </div>
  );
}
