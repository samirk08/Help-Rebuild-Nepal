import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  checkFileClaim,
  checkStoredObject,
  safeStorageName,
  sniffFileType,
} from "../lib/upload-policy";
import { TICKET_TTL_MS, issueUploadTicket, verifyUploadTicket } from "../lib/upload-tickets";
import { FILE_HEADERS, OTHER_SUBMISSION_ID, SUBMISSION_ID } from "./helpers";

const KEY = "test-signing-key-not-a-real-secret";
const NOW = 1_800_000_000_000;
const EMPTY = { count: 0, bytes: 0 };

test("a ticket authorizes its own submission and nothing else", () => {
  const ticket = issueUploadTicket(SUBMISSION_ID, NOW, KEY);

  assert.deepEqual(verifyUploadTicket(ticket, SUBMISSION_ID, NOW, KEY), {
    ok: true,
    submissionId: SUBMISSION_ID,
  });

  // The whole point: holding a valid ticket for your own submission must not
  // let you attach files to someone else's.
  assert.deepEqual(verifyUploadTicket(ticket, OTHER_SUBMISSION_ID, NOW, KEY), {
    ok: false,
    reason: "wrong_submission",
  });
});

test("a ticket expires, and a forged or altered one never verifies", () => {
  const ticket = issueUploadTicket(SUBMISSION_ID, NOW, KEY);

  assert.equal(verifyUploadTicket(ticket, SUBMISSION_ID, NOW + TICKET_TTL_MS - 1, KEY).ok, true);
  assert.deepEqual(verifyUploadTicket(ticket, SUBMISSION_ID, NOW + TICKET_TTL_MS, KEY), {
    ok: false,
    reason: "expired",
  });

  // Pushing the expiry out by hand invalidates the signature it is part of.
  const [id, , signature] = ticket.split(".");
  const extended = `${id}.${NOW + TICKET_TTL_MS * 100}.${signature}`;
  assert.deepEqual(verifyUploadTicket(extended, SUBMISSION_ID, NOW, KEY), {
    ok: false,
    reason: "bad_signature",
  });

  // A different signing key cannot mint one that this deployment accepts.
  const foreign = issueUploadTicket(SUBMISSION_ID, NOW, "someone-elses-key");
  assert.deepEqual(verifyUploadTicket(foreign, SUBMISSION_ID, NOW, KEY), {
    ok: false,
    reason: "bad_signature",
  });

  for (const junk of ["", "not-a-ticket", "a.b", "a.b.c.d", 42, null, undefined]) {
    assert.equal(verifyUploadTicket(junk, SUBMISSION_ID, NOW, KEY).ok, false);
  }
});

test("only the five accepted types may be signed", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]) {
    const verdict = checkFileClaim({ filename: "photo.bin", mimeType, size: 1000 }, EMPTY);
    assert.equal(verdict.ok, true, mimeType);
  }

  for (const mimeType of ["text/html", "image/svg+xml", "application/zip", "image/gif"]) {
    const verdict = checkFileClaim({ filename: "x", mimeType, size: 1000 }, EMPTY);
    assert.ok(!verdict.ok && verdict.reason === "type_not_allowed", mimeType);
  }
});

test("size and count quotas hold across requests, not just within one", () => {
  const oversize = checkFileClaim(
    { filename: "big.pdf", mimeType: "application/pdf", size: MAX_FILE_BYTES + 1 },
    EMPTY
  );
  assert.ok(!oversize.ok && oversize.reason === "too_large");

  const empty = checkFileClaim(
    { filename: "nothing.pdf", mimeType: "application/pdf", size: 0 },
    EMPTY
  );
  assert.ok(!empty.ok && empty.reason === "empty");

  // A submission already at the file limit cannot start a fresh batch.
  const atLimit = checkFileClaim(
    { filename: "ninth.pdf", mimeType: "application/pdf", size: 1000 },
    { count: MAX_FILES, bytes: 1000 }
  );
  assert.ok(!atLimit.ok && atLimit.reason === "quota_exceeded");

  const overTotal = checkFileClaim(
    { filename: "last.pdf", mimeType: "application/pdf", size: MAX_FILE_BYTES },
    { count: 2, bytes: MAX_TOTAL_BYTES - 1 }
  );
  assert.ok(!overTotal.ok && overTotal.reason === "quota_exceeded");
});

test("a filename cannot escape its submission's folder", () => {
  assert.equal(safeStorageName("../../etc/passwd"), "etc_passwd");
  assert.equal(safeStorageName("photo.png"), "photo.png");
  assert.equal(safeStorageName("report..pdf"), "report.pdf");
  assert.equal(safeStorageName("héllo wörld.jpg"), "h_llo_w_rld.jpg");
  assert.equal(safeStorageName("..."), "file");
  assert.equal(safeStorageName(""), "file");

  for (const name of [safeStorageName("../../x"), safeStorageName("a/b/c")]) {
    assert.equal(name.includes("/"), false);
  }
});

test("the bytes decide the type, not the declared one", () => {
  assert.equal(sniffFileType(FILE_HEADERS.jpeg), "image/jpeg");
  assert.equal(sniffFileType(FILE_HEADERS.png), "image/png");
  assert.equal(sniffFileType(FILE_HEADERS.pdf), "application/pdf");
  assert.equal(sniffFileType(FILE_HEADERS.webp), "image/webp");
  assert.equal(sniffFileType(FILE_HEADERS.heic), "image/heic");

  // The case the old rule allowed straight through: an HTML document called
  // photo.png, declared as image/png by the browser's own extension guess.
  assert.equal(sniffFileType(FILE_HEADERS.html), null);
  assert.equal(sniffFileType(new Uint8Array([])), null);
});

test("a forged type, a missing object and a wrong size are all refused", () => {
  const forged = checkStoredObject(
    { mimeType: "image/png", size: 10 },
    { exists: true, size: 10, header: FILE_HEADERS.html }
  );
  assert.ok(!forged.ok && forged.reason === "type_not_allowed");

  // A real PNG declared as a PDF is still a mismatch: the stored mime_type is
  // what admin screens use to decide how to render it.
  const mismatched = checkStoredObject(
    { mimeType: "application/pdf", size: 10 },
    { exists: true, size: 10, header: FILE_HEADERS.png }
  );
  assert.ok(!mismatched.ok && mismatched.reason === "type_not_allowed");

  const missing = checkStoredObject(
    { mimeType: "image/png", size: 10 },
    { exists: false, size: null, header: null }
  );
  assert.ok(!missing.ok && missing.reason === "empty");

  // The upload was authorized for one size and is another: not the file that
  // was allowed through the quota.
  const resized = checkStoredObject(
    { mimeType: "image/png", size: 10 },
    { exists: true, size: 9_000_000, header: FILE_HEADERS.png }
  );
  assert.ok(!resized.ok);

  const good = checkStoredObject(
    { mimeType: "image/png", size: 10 },
    { exists: true, size: 10, header: FILE_HEADERS.png }
  );
  assert.ok(good.ok && good.type === "image/png");
});
