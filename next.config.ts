import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["preview-chat-957f1c55-9e09-43e9-9028-b910be75fc23.space-z.ai"],
};

export default nextConfig;
