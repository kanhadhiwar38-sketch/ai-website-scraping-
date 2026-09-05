/**
 * Redacts secrets from browser-observed network data (spec Section 15).
 * This must run at capture time, before data reaches Firestore, logs, or
 * the AI Gateway — display-time redaction alone is not sufficient because
 * it would still leak secrets into storage and AI prompts.
 */

const REDACTED = "[REDACTED]";

// Header names (case-insensitive) whose values are always fully redacted.
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
]);

// Query/body param names (case-insensitive substring match) treated as secrets.
const SENSITIVE_PARAM_PATTERNS = [
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /password/i,
  /passwd/i,
  /session[_-]?id/i,
  /auth/i,
  /credential/i,
];

// JWT-shaped strings anywhere in free text (three base64url segments).
const JWT_PATTERN = /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

// Common "Bearer xyz" pattern inside free text (e.g. embedded in a body).
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi;

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

export function redactParams(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const sensitive = SENSITIVE_PARAM_PATTERNS.some((pattern) => pattern.test(key));
    out[key] = sensitive ? REDACTED : value;
  }
  return out;
}

/** Redacts JWT-shaped and "Bearer ..." tokens embedded in free-form text (bodies). */
export function redactBodyText(text: string | null): string | null {
  if (text === null) return null;
  return text.replace(JWT_PATTERN, REDACTED).replace(BEARER_PATTERN, `Bearer ${REDACTED}`);
}

export interface RedactableRequest {
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  queryParams: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
}

export interface RedactedRequest extends RedactableRequest {
  redacted: boolean;
}

/** Applies all redaction rules to a captured network request/response pair. */
export function redactNetworkRequest(input: RedactableRequest): RedactedRequest {
  const requestHeaders = redactHeaders(input.requestHeaders);
  const responseHeaders = redactHeaders(input.responseHeaders);
  const queryParams = redactParams(input.queryParams);
  const requestBody = redactBodyText(input.requestBody);
  const responseBody = redactBodyText(input.responseBody);

  const redacted =
    JSON.stringify(requestHeaders) !== JSON.stringify(input.requestHeaders) ||
    JSON.stringify(responseHeaders) !== JSON.stringify(input.responseHeaders) ||
    JSON.stringify(queryParams) !== JSON.stringify(input.queryParams) ||
    requestBody !== input.requestBody ||
    responseBody !== input.responseBody;

  return { requestHeaders, responseHeaders, queryParams, requestBody, responseBody, redacted };
}
