export { getRedisConnection, closeRedisConnection } from "./redis.js";

export {
  QUEUE_NAMES,
  QUEUE_CONCURRENCY,
  QUEUE_TIMEOUT_MS,
  getQueue,
  closeAllQueues,
} from "./queues.js";
export type { JobPayloadMap } from "./queues.js";

export {
  enqueueJob,
  updateJobStatus,
  getJob,
  requireOwnedJob,
  cancelJob,
  isJobCancelled,
  withJobTracking,
} from "./job-tracker.js";
export type { UpdateJobPatch } from "./job-tracker.js";

export { withTimeout, JobTimeoutError } from "./timeout.js";

export { createQueueWorker } from "./worker-factory.js";
