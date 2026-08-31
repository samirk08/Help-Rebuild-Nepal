/**
 * Kept out of `lib/bugs.ts` because that file is `"use server"`, and a Server
 * Actions module may only export async functions — exporting an array from it
 * fails the build. Same reason `storage-constants.ts` exists.
 */

export const BUG_STATUSES = ["open", "fixed", "wontfix"] as const;
export const BUG_SEVERITIES = ["blocking", "normal", "minor"] as const;

/** Display text for both vocabularies, in one place. */
export const BUG_LABEL: Record<string, string> = {
  open: "Open",
  fixed: "Fixed",
  wontfix: "Won't fix",
  blocking: "Blocking",
  normal: "Normal",
  minor: "Minor",
};
