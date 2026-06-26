import type { NextConfig } from "next";

const allowedDevOrigins = [
  "localhost",
  "127.0.0.1",
  "192.168.103.103",
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
