/**
 * The subpath the site is served from — `/Help-Rebuild-Nepal` on GitHub
 * Pages, empty at a domain root. Set in `next.config.ts`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a root-relative URL with the deployment subpath.
 *
 * `next/link` and the router apply the base path themselves, so routes never
 * need this. Files served from `public/` and URLs written into a `metadata`
 * export do not get it applied, so those go through here — without it they
 * resolve against the domain root and 404 on a subpath deployment.
 */
export function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
