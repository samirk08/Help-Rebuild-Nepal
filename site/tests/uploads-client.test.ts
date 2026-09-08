import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  COMPRESS_ABOVE_BYTES,
  MAX_EDGE,
  compressImage,
  renameToJpeg,
  shouldCompress,
  targetSize,
  worthReplacing,
} from "../lib/image-compress";

/**
 * Getting a damage photo off a phone in a district with a bad connection.
 *
 * A phone camera produces a 4-8MB image. Eight of those is up to 64MB, sent by
 * someone whose roof has just come off, over a congested mobile network. That
 * is the difference between a request arriving and a request being abandoned
 * halfway through — and nobody assessing damage needs 4000 pixels across.
 *
 * Every rule below is about not making anything worse. A failed compression
 * must never become a failed upload.
 */

const file = (over: Partial<{ type: string; size: number }> = {}) => ({
  type: "image/jpeg",
  size: 4 * 1024 * 1024,
  ...over,
});

test("only images worth shrinking are touched", () => {
  assert.equal(shouldCompress(file()), true);
  assert.equal(shouldCompress(file({ type: "image/png" })), true);
  assert.equal(shouldCompress(file({ type: "image/webp" })), true);

  // A PDF is a document, not a photo. Re-encoding it would destroy it.
  assert.equal(shouldCompress(file({ type: "application/pdf" })), false);

  // HEIC is left alone on purpose: Safari decodes it, most browsers do not,
  // and attempting it on every iPhone upload to fail every time is wasted work
  // on a slow device. The server accepts it as-is.
  assert.equal(shouldCompress(file({ type: "image/heic" })), false);

  // Already small enough that the transfer saving is not worth a re-encode.
  assert.equal(shouldCompress(file({ size: COMPRESS_ABOVE_BYTES })), false);
  assert.equal(shouldCompress(file({ size: 40 * 1024 })), false);
});

test("a photo is scaled down, never up", () => {
  assert.deepEqual(targetSize(4032, 3024), { width: MAX_EDGE, height: 1440 });
  assert.deepEqual(targetSize(3024, 4032), { width: 1440, height: MAX_EDGE });

  // A small image that happens to be a large file is a quality problem, not a
  // dimensions problem; upscaling it would only add bytes.
  assert.deepEqual(targetSize(800, 600), { width: 800, height: 600 });
  assert.deepEqual(targetSize(MAX_EDGE, 1080), { width: MAX_EDGE, height: 1080 });
});

test("scaling never rounds a dimension away to nothing", () => {
  // A panorama: 20000x1 is absurd and someone will upload one.
  const size = targetSize(20000, 1);
  assert.equal(size.width, MAX_EDGE);
  assert.ok(size.height >= 1, "a zero-height canvas cannot be drawn");
});

test("the re-encoded file is only used when it is genuinely smaller", () => {
  assert.equal(worthReplacing(4_000_000, 300_000), true);
  // A marginal saving is not worth the risk that the re-encode lost something
  // the original had.
  assert.equal(worthReplacing(4_000_000, 3_800_000), false);
  assert.equal(worthReplacing(4_000_000, 5_000_000), false);
  assert.equal(worthReplacing(4_000_000, 0), false);
});

test("the extension follows the bytes", () => {
  assert.equal(renameToJpeg("roof damage.png"), "roof damage.jpg");
  assert.equal(renameToJpeg("photo.jpeg"), "photo.jpg");
  assert.equal(renameToJpeg("no-extension"), "no-extension.jpg");
  assert.equal(renameToJpeg(".hidden"), ".hidden.jpg");
});

test("with no browser to compress in, the original file is returned untouched", async () => {
  // Node has no createImageBitmap or document, which is exactly the shape of
  // every failure path: losing a photo is worse than sending a big one.
  const original = new File([new Uint8Array(2 * 1024 * 1024)], "roof.jpg", {
    type: "image/jpeg",
  });
  const result = await compressImage(original);
  assert.equal(result, original);
});

test("a failed photo can be retried against the request that already exists", () => {
  // Both intake forms, because only one of them had this. On the other, the
  // sole way to attach a photo that missed was to fill the whole form in
  // again — which is how a lost photo became a duplicate request.
  for (const form of ["RequestForm", "NeedIntakeForm"]) {
    const source = readFileSync(join("components", `${form}.tsx`), "utf8");
    assert.match(source, /retryAttachments/, `${form} must offer a retry`);
    assert.match(source, /submissionId/, `${form} must retry against the saved submission`);
    assert.match(
      source,
      /status === "uploaded"\s*\n?\s*\?/,
      `${form} must not re-upload the files that already landed`
    );
    // "Larger than the 10MB limit" tells someone what to do; "failed" does not.
    assert.match(source, /outcome\.message/, `${form} must show why a file failed`);
  }
});

test("uploads shrink the photo before sending it", () => {
  const source = readFileSync(join("lib", "uploads.ts"), "utf8");
  assert.match(source, /compressImage/);
  // The person sees the name they picked in the retry list, not the .jpg we
  // made out of it.
  assert.match(source, /\.\.\.outcome, file/);
});
