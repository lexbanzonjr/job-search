import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf", "mammoth", "@libsql/client", "@react-pdf/renderer"],
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
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
