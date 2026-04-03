import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.7",
    "10.143.136.252",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
