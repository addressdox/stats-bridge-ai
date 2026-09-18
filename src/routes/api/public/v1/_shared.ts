/** Shared helpers for the documented public v1 API. */

export const API_VERSION = "v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
}

export function badRequest(message: string) {
  return jsonResponse({ apiVersion: API_VERSION, error: { code: "invalid_request", message } }, 400);
}

export function notFound(message: string) {
  return jsonResponse({ apiVersion: API_VERSION, error: { code: "not_found", message } }, 404);
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export function apiVersioned<T extends object>(body: T) {
  return { apiVersion: API_VERSION, ...body };
}

export function callerKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "api-anonymous"
  );
}
