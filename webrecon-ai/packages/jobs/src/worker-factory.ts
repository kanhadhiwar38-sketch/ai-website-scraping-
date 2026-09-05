import { Worker, type Job as BullJob, type Processor } from "bullmq";
import type { JobQueueName } from "@webrecon/types";
import { createLogger } from "@webrecon/logger";
import { getRedisConnection } from "./redis.js";
import { QUEUE_CONCURRENCY } from "./queues.js";
import type { JobPayloadMap } from "./queues.js";

const logger = createLogger({ name: "jobs-worker" });

/**
 * Creates a BullMQ Worker for a single queue with this queue's configured
 * concurrency. The processor itself is responsible for calling
 * updateJobStatus() as it progresses — this factory only handles wiring +
 * logging of the terminal BullMQ-level events (which fire regardless of
 * whether the processor remembered to update Firestore).
 */
export function createQueueWorker<Q extends JobQueueName>(
  name: Q,
  processor: Processor<JobPayloadMap[Q]>,
): Worker<JobPayloadMap[Q]> {
  const worker = new Worker<JobPayloadMap[Q]>(name, processor, {
    connection: getRedisConnection(),
    concurrency: QUEUE_CONCURRENCY[name],
  });

  worker.on("completed", (job: BullJob<JobPayloadMap[Q]>) => {
    logger.info({ queue: name, jobId: job.id }, "job completed");
  });

  worker.on("failed", (job: BullJob<JobPayloadMap[Q]> | undefined, error: Error) => {
    logger.error({ queue: name, jobId: job?.id, error }, "job failed");
  });

  return worker;
}
