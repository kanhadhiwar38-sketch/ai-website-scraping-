import { Queue } from "bullmq";
import type { JobQueueName } from "@webrecon/types";
import { getRedisConnection } from "./redis.js";

export const QUEUE_NAMES: JobQueueName[] = [
  "crawl",
  "network-analysis",
  "asset-analysis",
  "screenshot",
  "ai-analysis",
  "project-generation",
  "visual-test",
];

/** Payload each queue's jobs are enqueued with. Kept 1:1 with what each processor needs. */
export interface JobPayloadMap {
  crawl: { userId: string; projectId: string };
  "network-analysis": { userId: string; projectId: string };
  "asset-analysis": { userId: string; projectId: string };
  screenshot: { userId: string; projectId: string; pageId: string; url: string };
  "ai-analysis": { userId: string; projectId: string };
  "project-generation": { userId: string; projectId: string };
  "visual-test": { userId: string; projectId: string };
}

/** Concurrency per queue — bounds resource use (spec Section 37/39). */
export const QUEUE_CONCURRENCY: Record<JobQueueName, number> = {
  crawl: 1,
  "network-analysis": 5,
  "asset-analysis": 5,
  screenshot: 2,
  "ai-analysis": 2,
  "project-generation": 1,
  "visual-test": 2,
};

/** Hard wall-clock cap per job, enforced by withTimeout() in each processor. */
export const QUEUE_TIMEOUT_MS: Record<JobQueueName, number> = {
  crawl: 10 * 60_000,
  "network-analysis": 60_000,
  "asset-analysis": 60_000,
  screenshot: 5 * 60_000,
  "ai-analysis": 5 * 60_000,
  "project-generation": 10 * 60_000,
  "visual-test": 5 * 60_000,
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { age: 3600 }, // 1 hour
  removeOnFail: { age: 86_400 }, // 24 hours
};

const queues = new Map<JobQueueName, Queue>();

/** Lazily creates (and caches) the BullMQ Queue for a given queue name. */
export function getQueue<Q extends JobQueueName>(name: Q): Queue<JobPayloadMap[Q]> {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    queues.set(name, queue);
  }
  return queue as Queue<JobPayloadMap[Q]>;
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all(Array.from(queues.values()).map((queue) => queue.close()));
  queues.clear();
}
