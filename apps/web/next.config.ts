import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@atlas/config", "@atlas/ui", "@atlas/types", "@atlas/domain", "@atlas/auth"]
};

export default nextConfig;
