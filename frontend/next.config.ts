import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kopis.or.kr",
      },
      {
        protocol: "https",
        hostname: "www.kopis.or.kr",
      },
      {
        protocol: "http",
        hostname: "www.kopis.or.kr",
      },
      {
        protocol: "http",
        hostname: "kopis.or.kr",
      },
    ],
  },

  reactCompiler: true,
  output: "standalone",
};

export default nextConfig;
