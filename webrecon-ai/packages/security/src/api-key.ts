import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "wr_live_";

export interface GeneratedApiKey {
  /** Full raw key — shown to the user exactly once, never stored. */
  raw: string;
  /** Short, safe-to-display prefix (e.g. "wr_live_ab12cd34") stored alongside the hash. */
  prefix: string;
  /** SHA-256 hex digest — what's actually persisted. */
  hash: string;
}

/** Generates a new WebRecon API key (spec Section 28: "wr_live_xxxxxxxxx"). */
export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(24).toString("base64url");
  const raw = `${KEY_PREFIX}${secret}`;
  return {
    raw,
    prefix: raw.slice(0, KEY_PREFIX.length + 8),
    hash: hashApiKey(raw),
  };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(KEY_PREFIX);
}
