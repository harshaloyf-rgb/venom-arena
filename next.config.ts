import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    "preview-ws-71254a19-f2f4-4ab7-8bd2-4fcf6a485170.space-z.ai", // current app preview
    "preview-chat-957f1c55-9e09-43e9-9028-b910be75fc23.space-z.ai", // legacy preview
    "*.space-z.ai", // future preview domain renames (wildcard subdomains)
  ],
};

export default nextConfig;
