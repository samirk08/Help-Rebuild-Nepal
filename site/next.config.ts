import path from "node:path";
import type { NextConfig } from "next";

/**
 * GitHub Pages serves this project as a static site under a repository
 * subpath (`https://<user>.github.io/Help-Rebuild-Nepal/`), so the Pages
 * build differs from a server build in three ways: it prerenders every route
 * to HTML, it prefixes every URL with the repository name, and it has no
 * runtime to serve the API route from.
 *
 * All three are driven by environment variables set in
 * `.github/workflows/deploy.yml`, so `npm run dev` and `npm run build` keep
 * behaving exactly as they did before.
 */
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "true";

/** Repository subpath, e.g. `/Help-Rebuild-Nepal`. Empty for a server build. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // An unrelated lockfile in the home directory makes Next guess the wrong
  // workspace root. Pin it to this project.
  outputFileTracingRoot: path.join(__dirname),

  // Let client code know whether a server is behind it. Derived here so the
  // workflow only has to set `NEXT_STATIC_EXPORT`.
  env: { NEXT_PUBLIC_STATIC_EXPORT: String(isStaticExport) },

  ...(isStaticExport
    ? {
        output: "export" as const,

        // Serve every route from its own directory index, which is what a
        // plain file host resolves most reliably.
        trailingSlash: true,

        // Prefixes routes and `_next` assets alike, so `next/link` and the
        // router need no further help. Anything Next does not rewrite — a
        // `public/` file, a URL in a `metadata` export — goes through
        // `asset()` in `lib/base-path.ts`.
        basePath,

        // There is no image optimizer on a static host.
        images: { unoptimized: true },

        // `app/api/submissions/route.ts` needs a server, and a static export
        // has none. Every page and layout here is `.tsx` and that route is the
        // only `.ts` file under `app/`, so dropping `ts` from the recognised
        // extensions removes the route from this build alone — the file stays
        // in the repository and `npm run dev` and `npm run build` still serve
        // it.
        //
        // `jsx` and `js` are unused by this project but must stay in the list:
        // Next resolves its own app-router entry modules against these
        // extensions, and a bare `["tsx"]` fails every page with
        // "Can't resolve private-next-app-dir/...".
        pageExtensions: ["tsx", "jsx", "js"],
      }
    : {
        // Every page lives under a language segment. Send the bare root to
        // English. Static exports cannot redirect, so `public/index.html`
        // does this job there instead.
        async redirects() {
          return [{ source: "/", destination: "/en", permanent: false }];
        },
      }),
};

export default nextConfig;
