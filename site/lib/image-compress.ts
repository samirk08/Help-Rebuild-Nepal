/**
 * Shrinking a damage photo before it is uploaded.
 *
 * A phone camera produces a 4–8MB image. Eight of those is up to 64MB, sent
 * from a district with a congested mobile connection, by someone whose roof has
 * just come off. That is the difference between a request arriving and a
 * request being abandoned halfway through — and the platform gained nothing
 * from the extra bytes: nobody assessing damage needs 4000 pixels across.
 *
 * The rules are all about not making anything worse:
 *
 *   - only images the browser can actually decode; a PDF is left alone;
 *   - orientation is read from the file, because a downscale that ignores EXIF
 *     turns every portrait photo on its side;
 *   - the result is only used if it is genuinely smaller, so an already-small
 *     or already-efficient image is never re-encoded into a bigger one;
 *   - anything at all going wrong returns the original file. A failed
 *     compression must never become a failed upload.
 *
 * The decisions are separated from the canvas work so they can be tested
 * without a DOM.
 */

/** Longest edge, in pixels. Enough to read a crack in a wall; far from 4000. */
export const MAX_EDGE = 1920;

/** Below this, the transfer saving is not worth a re-encode. */
export const COMPRESS_ABOVE_BYTES = 600 * 1024;

/** JPEG quality. High enough that structural detail survives. */
export const QUALITY = 0.75;

/**
 * Types worth re-encoding.
 *
 * HEIC is deliberately absent: Safari can decode it, most other browsers
 * cannot, and `createImageBitmap` failing is handled — but attempting it on
 * every iPhone upload to fail every time is wasted work on a slow device. The
 * server accepts HEIC as-is.
 */
const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export function shouldCompress(file: { type: string; size: number }): boolean {
  if (!COMPRESSIBLE.has(file.type)) return false;
  return file.size > COMPRESS_ABOVE_BYTES;
}

/**
 * The size to draw at, preserving aspect ratio.
 *
 * Never enlarges: a small photo that happens to be a large file is a quality
 * problem, not a dimensions problem, and upscaling it would add bytes.
 */
export function targetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Whether the re-encoded result is worth using in place of the original. */
export function worthReplacing(originalBytes: number, compressedBytes: number): boolean {
  // A marginal saving is not worth the risk of a re-encode having lost
  // something the original had. 10% is the floor.
  return compressedBytes > 0 && compressedBytes < originalBytes * 0.9;
}

/**
 * Returns a smaller version of the file, or the original.
 *
 * Never throws and never rejects: every failure path returns the file it was
 * given, because losing a photo is worse than sending a big one.
 */
export async function compressImage(file: File): Promise<File> {
  if (!shouldCompress(file)) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  try {
    // `from-image` applies the EXIF rotation. Without it every portrait photo
    // taken on a phone arrives on its side.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = targetSize(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob || !worthReplacing(file.size, blob.size)) return file;

    // Renamed to .jpg so the extension matches what the bytes now are; the
    // server decides the type from the bytes regardless, but a file called
    // .png that is a JPEG is a confusing thing to find in a bucket later.
    return new File([blob], renameToJpeg(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export function renameToJpeg(name: string): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}.jpg`;
}
