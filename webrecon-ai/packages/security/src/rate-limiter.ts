/**
 * Minimal in-process token-bucket limiter for Phase 1. Later phases should
 * back this with Redis so limits are enforced consistently across multiple
 * API instances; the interface is designed so that swap is drop-in.
 */

export interface RateLimiterOptions {
  /** Max tokens in the bucket (i.e. burst size). */
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly options: RateLimiterOptions) {}

  /** Returns true if the request is allowed (and consumes a token). */
  tryConsume(key: string, cost = 1): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.options.capacity,
      lastRefill: now,
    };

    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.options.capacity,
      bucket.tokens + elapsedSeconds * this.options.refillPerSecond,
    );
    bucket.lastRefill = now;

    if (bucket.tokens < cost) {
      this.buckets.set(key, bucket);
      return false;
    }

    bucket.tokens -= cost;
    this.buckets.set(key, bucket);
    return true;
  }
}
