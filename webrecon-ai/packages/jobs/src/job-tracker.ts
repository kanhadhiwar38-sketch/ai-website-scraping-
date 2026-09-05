import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { generateId, nowIso, NotFoundError, ForbiddenError } from "@webrecon/shared";
import { Job, type JobQueueName, type JobStatus } from "@webrecon/types";
import { getQueue, type JobPayloadMap } from "./queues.js";

/**
 * Creates the Firestore `jobs` record and enqueues the matching BullMQ job
 * using the *same id* for both — this is what makes `GET /jobs/:id` a
 * single Firestore read regardless of which queue actually ran it.
 */
export async function enqueueJob<Q extends JobQueueName>(
  queue: Q,
  userId: string,
  projectId: string,
  payload: JobPayloadMap[Q],
): Promise<Job> {
  const id = generateId("job");
  const now = nowIso();

  const job = Job.parse({
    id,
    userId,
    projectId,
    queue,
    status: "pending" satisfies JobStatus,
    progress: 0,
    createdAt: now,
    updatedAt: now,
  });

  const db = getFirebaseAdminFirestore();
  await db.collection(COLLECTIONS.jobs).doc(id).set(job);

  // BullMQ's Queue.add() ties its "name" parameter type to a conditional
  // type derived from the data type, which can't be resolved while Q is
  // still an abstract generic here (a known limitation of wrapping BullMQ
  // in a generic helper). The cast is safe: `queue` is always a valid
  // JobQueueName string, which is all `.add()` actually needs at runtime.
  const addJob = getQueue(queue).add as (
    name: string,
    data: JobPayloadMap[Q],
    opts: { jobId: string },
  ) => Promise<unknown>;
  await addJob(queue, payload, { jobId: id });

  return job;
}

export interface UpdateJobPatch {
  status?: JobStatus;
  progress?: number;
  error?: string;
}

/** Called by worker processors as a job moves through its lifecycle. */
export async function updateJobStatus(jobId: string, patch: UpdateJobPatch): Promise<void> {
  const db = getFirebaseAdminFirestore();
  await db
    .collection(COLLECTIONS.jobs)
    .doc(jobId)
    .set({ ...patch, updatedAt: nowIso() }, { merge: true });
}

export async function getJob(jobId: string): Promise<Job | null> {
  const db = getFirebaseAdminFirestore();
  const doc = await db.collection(COLLECTIONS.jobs).doc(jobId).get();
  if (!doc.exists) return null;
  return Job.parse(doc.data());
}

export async function requireOwnedJob(jobId: string, userId: string): Promise<Job> {
  const job = await getJob(jobId);
  if (!job) throw new NotFoundError("Job not found");
  if (job.userId !== userId) throw new ForbiddenError();
  return job;
}

/**
 * Best-effort cancellation: removes the BullMQ job outright if it hasn't
 * started yet (waiting/delayed), otherwise just flags the Firestore record
 * as `cancelled` — long-running processors (currently: crawl) poll this via
 * their `shouldAbort` hook and stop at the next safe checkpoint. Short jobs
 * (screenshot, network-analysis, asset-analysis) don't check mid-flight, so
 * "cancel" on an already-active one of those just prevents any retry.
 */
export async function cancelJob(jobId: string, userId: string): Promise<Job> {
  const job = await requireOwnedJob(jobId, userId);

  const bullJob = await getQueue(job.queue).getJob(jobId);
  if (bullJob) {
    const state = await bullJob.getState();
    if (state === "waiting" || state === "delayed") {
      await bullJob.remove();
    }
  }

  await updateJobStatus(jobId, { status: "cancelled" });
  return { ...job, status: "cancelled" };
}

/** Polled by the shouldAbort hook of long-running processors. */
export async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await getJob(jobId);
  return job?.status === "cancelled";
}

/**
 * Wraps a processor body with the standard active→completed/failed
 * Firestore lifecycle, so every processor gets consistent status tracking
 * without repeating the same try/catch.
 */
export async function withJobTracking<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  await updateJobStatus(jobId, { status: "active" });
  try {
    const result = await fn();
    await updateJobStatus(jobId, { status: "completed", progress: 100 });
    return result;
  } catch (error) {
    await updateJobStatus(jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
