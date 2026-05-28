/**
 * Shared CORS helper for all Asclion edge functions.
 *
 * Allows the production app, Lovable preview URLs, and localhost dev servers.
 * Import with:
 *   import { buildCorsHeaders } from "../_shared/cors.ts";
 * Then inside serve(async (req) => { const corsHeaders = buildCorsHeaders(req); ... })
 */
const ALLOWED_ORIGINS = [
  "https://prescr-ia-assist.lovable.app",
  // Lovable preview pattern — covers *.lovable.app subdomains
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  // Local development
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin),
  );
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = isAllowedOrigin(origin)
    ? origin
    : "https://prescr-ia-assist.lovable.app";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-scanner-key, x-device-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
