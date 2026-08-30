import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // An unrelated lockfile in the home directory makes Next guess the wrong
  // workspace root. Pin it to this project.
  outputFileTracingRoot: path.join(__dirname),

  // Every page lives under a language segment. Send the bare root to English.
  async redirects() {
    return [{ source: "/", destination: "/en", permanent: false }];
  },
};

export default nextConfig;
