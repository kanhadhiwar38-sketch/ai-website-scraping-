import type { Job as BullJob } from "bullmq";
import { withJobTracking } from "@webrecon/jobs";

/**
 * These three queues exist now (spec Section 35 lists all seven up front)
 * so the API/Firestore/BullMQ plumbing is uniform, but their actual work —
 * the AI Gateway (Phase 8-9), AI website analyzer (Phase 10), and the
 * rebuild + visual-diff loop (Phase 11-12) — hasn't been built yet. Rather
 * than silently hang forever if something enqueues one early, this fails
 * fast with a clear, honest message.
 */
export function makeUnimplementedProcessor(queueName: string, availableFromPhase: string) {
  return async function processUnimplementedJob(job: BullJob): Promise<void> {
    await withJobTracking(job.id!, async () => {
      throw new Error(
        `The "${queueName}" queue has no processor yet — it lands in ${availableFromPhase}.`,
      );
    });
  };
}
