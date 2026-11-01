import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        // El SW vive fuera de /pos; este encabezado permite su alcance.
        source: "/sw-pos/:path*",
        headers: [{ key: "Service-Worker-Allowed", value: "/pos" }],
      },
    ];
  },
};

export default withSerwist(nextConfig);
