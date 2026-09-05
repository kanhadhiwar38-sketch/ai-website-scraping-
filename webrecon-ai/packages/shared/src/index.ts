/** Framework-free utilities shared across all apps and packages. */

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Not authorized to access this resource") {
    super("FORBIDDEN", message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input") {
    super("VALIDATION_ERROR", message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class SecurityViolationError extends AppError {
  constructor(message = "Request blocked by security policy") {
    super("SECURITY_VIOLATION", message, 403);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded") {
    super("RATE_LIMITED", message, 429);
  }
}

/** Generates a URL-safe random id. Not for cryptographic secrets. */
export function generateId(prefix?: string): string {
  const random = crypto.randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${random}` : random;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
