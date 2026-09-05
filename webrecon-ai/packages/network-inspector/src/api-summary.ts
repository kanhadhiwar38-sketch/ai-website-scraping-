import type { CapturedNetworkRequest } from "./capture.js";

export interface ApiSummaryEntry {
  method: string;
  /** Path only (no query string, no host) — e.g. "/api/products". */
  endpoint: string;
  contentType?: string;
  status?: number;
  /** Shape only — see inferSchema. Never raw values, even after redaction. */
  requestSchema?: JsonSchemaShape;
  responseSchema?: JsonSchemaShape;
}

export type JsonSchemaShape =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "unknown"
  | { type: "array"; items: JsonSchemaShape }
  | { type: "object"; properties: Record<string, JsonSchemaShape> };

const MAX_DEPTH = 6;
const MAX_KEYS = 50;

/**
 * Reduces a parsed JSON value to its structural shape — types, not values.
 * This is deliberately more aggressive than the header/param redaction in
 * packages/security: even after secrets are redacted, response bodies can
 * carry ordinary user data (names, emails, order details) that still
 * shouldn't be persisted verbatim into an "API summary" meant for
 * schema-level analysis. Depth and key count are capped so a pathological
 * payload can't blow up processing time or storage.
 */
export function inferSchema(value: unknown, depth = 0): JsonSchemaShape {
  if (depth >= MAX_DEPTH) return "unknown";

  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";

  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length > 0 ? inferSchema(value[0], depth + 1) : "unknown",
    };
  }

  if (typeof value === "object") {
    const properties: Record<string, JsonSchemaShape> = {};
    const keys = Object.keys(value as Record<string, unknown>).slice(0, MAX_KEYS);
    for (const key of keys) {
      properties[key] = inferSchema((value as Record<string, unknown>)[key], depth + 1);
    }
    return { type: "object", properties };
  }

  return "unknown";
}

function safeJsonParse(text: string | null): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const API_LIKE_TYPES = new Set(["fetch", "xhr"]);

/**
 * Filters captured network traffic down to what looks like a public/
 * client-observable API call (fetch/xhr resource type — never a request
 * the browser didn't legitimately make itself) and summarizes each unique
 * method+endpoint pair. Deliberately does NOT attempt to discover endpoints
 * the browser never called (spec Section 16: "do not attempt to discover
 * or exploit private/hidden APIs through unauthorized means").
 */
export function summarizeApiRequests(records: CapturedNetworkRequest[]): ApiSummaryEntry[] {
  const byKey = new Map<string, ApiSummaryEntry>();

  for (const record of records) {
    if (!API_LIKE_TYPES.has(record.resourceType)) continue;

    let pathname: string;
    try {
      pathname = new URL(record.url).pathname;
    } catch {
      continue;
    }

    const key = `${record.method} ${pathname}`;
    if (byKey.has(key)) continue; // one representative sample per method+endpoint

    const contentType = record.responseHeaders["content-type"];

    const parsedRequest = record.requestBody ? safeJsonParse(record.requestBody) : undefined;
    const parsedResponse = record.responseBody ? safeJsonParse(record.responseBody) : undefined;

    byKey.set(key, {
      method: record.method,
      endpoint: pathname,
      contentType,
      status: record.status,
      requestSchema: parsedRequest !== undefined ? inferSchema(parsedRequest) : undefined,
      responseSchema: parsedResponse !== undefined ? inferSchema(parsedResponse) : undefined,
    });
  }

  return Array.from(byKey.values());
}
