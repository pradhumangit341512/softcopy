import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.1.7",      // your local network IP (phone/tablet testing)
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;