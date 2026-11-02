import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // No exponer la cabecera x-powered-by (pulido de seguridad)
  poweredByHeader: false,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
