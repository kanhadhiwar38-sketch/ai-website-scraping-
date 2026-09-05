import type { ResourceType } from "@webrecon/types";

const KNOWN_TYPES = new Set<ResourceType>([
  "document",
  "stylesheet",
  "script",
  "image",
  "font",
  "fetch",
  "xhr",
  "websocket",
  "media",
]);

/**
 * Playwright's `request.resourceType()` returns strings like "document",
 * "stylesheet", "script", "image", "font", "xhr", "fetch", "media",
 * "websocket", "manifest", "other", "eventsource", etc. We fold anything
 * outside our known set into "other" per spec Section 14's classification
 * list.
 */
export function classifyResourceType(playwrightResourceType: string): ResourceType {
  return KNOWN_TYPES.has(playwrightResourceType as ResourceType)
    ? (playwrightResourceType as ResourceType)
    : "other";
}
