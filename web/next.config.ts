import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const esProduccion = process.env.NODE_ENV === "production";
const supabaseOrigen = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";

// shortcut: 'unsafe-inline' en script-src y style-src porque /pos es estático y no admite nonce
// (el nonce exige render dinámico por request); pasar a nonce cuando /pos deje de precachearse.
// En desarrollo, HMR de Next necesita eval y websockets: solo fuera de producción.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esProduccion ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigen}`.trim(),
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigen}${esProduccion ? "" : " ws://localhost:* ws://127.0.0.1:*"}`.trim(),
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
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
