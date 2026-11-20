import { NextRequest, NextResponse } from "next/server";

const localFrontendOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const frontendOrigins = new Set([
  "https://ofertia-web-kappa.vercel.app",
  ...(process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigin = origin &&
      (frontendOrigins.has(origin) || localFrontendOrigin.test(origin))
    ? origin
    : null;

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    if (allowedOrigin) addCorsHeaders(response, allowedOrigin);
    return response;
  }

  const response = NextResponse.next();
  if (allowedOrigin) addCorsHeaders(response, allowedOrigin);
  return response;
}

function addCorsHeaders(response: NextResponse, origin: string) {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin");
}

export const config = { matcher: "/api/:path*" };
