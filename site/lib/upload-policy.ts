/**
 * What may be attached to a submission, and how it is checked.
 *
 * The old rule was `mimeType.startsWith("image/")`, taken from
 * `File.type` — a value the browser derives from the file extension and that
 * any caller can simply assert. Renaming `payload.html` to `photo.png` was
 * enough to store an HTML document in a bucket that admin screens link to.
 *
 * So the declared type is now only a first filter, and the bytes decide. This
 * module is pure: it takes a header and a size and returns a verdict, which is
 * what lets every rule below be tested without Supabase Storage.
 */

/** Types a person can actually attach, by what the bytes must prove. */
export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export type AllowedType = (typeof ALLOWED_TYPES)[number];

/** Matches the eight-file promise in FileUpload.tsx. */
export const MAX_FILES = 8;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** A whole request's worth, so eight maximum-size files cannot be repeated. */
export const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
/** Enough bytes for every signature below, and small enough to range-request. */
export const SIGNATURE_BYTES = 32;

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  return prefix.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * The real type of a file, from its leading bytes.
 *
 * Returns null when the header matches nothing on the allowlist, which is the
 * answer for "this is not one of the five things we accept" — including the
 * case where it is a perfectly valid file of some other kind.
 */
export function sniffFileType(bytes: Uint8Array): AllowedType | null {
  // JPEG: SOI marker.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  // PNG: signature is deliberately long, so all eight bytes are checked.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // PDF: "%PDF-".
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";

  // WebP and HEIC are both ISO base-media style: a size field, then a brand.
  // "RIFF" .... "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  // .... "ftyp" then one of the HEIF brands.
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
  }

  return null;
}

export type FileClaim = { filename: string; mimeType: string; size: number };

export type PolicyVerdict =
  | { ok: true; type: AllowedType; storedName: string }
  | {
      ok: false;
      reason: "type_not_allowed" | "too_large" | "empty" | "bad_name" | "quota_exceeded";
      message: string;
    };

/**
 * Filenames are used to build a storage path, so they are rebuilt rather than
 * escaped: everything outside a small alphabet becomes `_`, and any run of dots
 * collapses, which removes `../` traversal and hidden double extensions in one
 * step. An empty result still yields a usable name.
 */
export function safeStorageName(filename: string): string {
  const cleaned = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+/, "")
    .slice(0, 100);
  return cleaned === "" ? "file" : cleaned;
}

/**
 * Whether one more file may be signed, given what this submission already has.
 *
 * `existing` is the count and byte total already recorded against the
 * submission, so the quota holds across separate requests rather than only
 * within one form post — otherwise eight files could be uploaded eight times.
 */
export function checkFileClaim(
  claim: FileClaim,
  existing: { count: number; bytes: number }
): PolicyVerdict {
  if (typeof claim.filename !== "string" || claim.filename.length === 0 || claim.filename.length > 200) {
    return { ok: false, reason: "bad_name", message: "That filename cannot be stored." };
  }
  if (!Number.isFinite(claim.size) || claim.size <= 0) {
    return { ok: false, reason: "empty", message: "That file is empty." };
  }
  if (claim.size > MAX_FILE_BYTES) {
    return { ok: false, reason: "too_large", message: "Each file must be 10MB or smaller." };
  }
  if (!ALLOWED_TYPES.includes(claim.mimeType as AllowedType)) {
    return {
      ok: false,
      reason: "type_not_allowed",
      message: "Only JPEG, PNG, WebP, HEIC images and PDFs are accepted.",
    };
  }
  if (existing.count >= MAX_FILES) {
    return { ok: false, reason: "quota_exceeded", message: `Up to ${MAX_FILES} files per request.` };
  }
  if (existing.bytes + claim.size > MAX_TOTAL_BYTES) {
    return { ok: false, reason: "quota_exceeded", message: "That exceeds the 40MB total for one request." };
  }

  return {
    ok: true,
    type: claim.mimeType as AllowedType,
    storedName: safeStorageName(claim.filename),
  };
}

/**
 * Whether a stored object matches what was promised when it was signed.
 *
 * Run after the bytes land, because until then there is nothing to inspect: the
 * browser uploads straight to Storage and could have sent anything at all.
 * A mismatch here means the row is never written, so `documents` cannot end up
 * pointing at an object that does not exist or is not what it claims.
 */
export function checkStoredObject(
  declared: { mimeType: string; size: number },
  actual: { exists: boolean; size: number | null; header: Uint8Array | null }
): PolicyVerdict | { ok: true; type: AllowedType; storedName: string } {
  if (!actual.exists) {
    return { ok: false, reason: "empty", message: "That upload did not finish." };
  }
  if (actual.size !== null && actual.size > MAX_FILE_BYTES) {
    return { ok: false, reason: "too_large", message: "Each file must be 10MB or smaller." };
  }
  // A size that disagrees with the claim means the object is not the file that
  // was authorized, so it is refused rather than recorded under a wrong size.
  if (actual.size !== null && actual.size !== declared.size) {
    return { ok: false, reason: "empty", message: "That upload did not finish." };
  }
  const sniffed = actual.header ? sniffFileType(actual.header) : null;
  if (!sniffed) {
    return {
      ok: false,
      reason: "type_not_allowed",
      message: "Only JPEG, PNG, WebP, HEIC images and PDFs are accepted.",
    };
  }
  if (sniffed !== declared.mimeType) {
    return {
      ok: false,
      reason: "type_not_allowed",
      message: "That file's contents do not match its type.",
    };
  }
  return { ok: true, type: sniffed, storedName: "" };
}
