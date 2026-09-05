import { Redis } from "ioredis";

let connection: Redis | undefined;

/**
 * BullMQ requires `maxRetriesPerRequest: null` on the ioredis connection it's
 * given (its own retry/backoff logic assumes ioredis won't give up first).
 * Shared as a singleton so producers (apps/api) and consumers
 * (apps/browser-worker) both reuse one connection per process rather than
 * opening a new socket per Queue/Worker instance.
 */
export function getRedisConnection(): Redis {
  if (connection) return connection;
  connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
