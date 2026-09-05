import pino from "pino";

/**
 * Redaction paths applied unconditionally to every logger created by this
 * module. This is a defense-in-depth backstop: packages/security redacts
 * secrets from captured data before it is ever stored, but logging call
 * sites should never be able to leak a secret even by mistake — so pino's
 * built-in redaction is layered on top.
 */
const REDACTED_PATHS = [
  "*.authorization",
  "*.Authorization",
  "*.cookie",
  "*.Cookie",
  "*.setCookie",
  "*.set-cookie",
  "*.apiKey",
  "*.api_key",
  "*.password",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "*.privateKey",
  "*.FIREBASE_PRIVATE_KEY",
  "*.OPENROUTER_API_KEY",
  "*.OPENAI_API_KEY",
  "*.ANTHROPIC_API_KEY",
  "*.GEMINI_API_KEY",
];

export interface CreateLoggerOptions {
  name: string;
  level?: pino.LevelWithSilent;
}

export function createLogger(options: CreateLoggerOptions) {
  return pino({
    name: options.name,
    level: options.level ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
    redact: {
      paths: REDACTED_PATHS,
      censor: "[REDACTED]",
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
