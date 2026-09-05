import type { Job as BullJob } from "bullmq";
import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { getFirebaseAdminStorage } from "@webrecon/firebase/admin";
import { COLLECTIONS, storagePaths } from "@webrecon/firebase";
import { withJobTracking, withTimeout, QUEUE_TIMEOUT_MS } from "@webrecon/jobs";
import type { JobPayloadMap } from "@webrecon/jobs";
import { NetworkRequest } from "@webrecon/types";
import { summarizeApiRequests } from "@webrecon/network-inspector";

const MAX_REQUESTS = 2000;

export async function processNetworkAnalysisJob(
  job: BullJob<JobPayloadMap["network-analysis"]>,
): Promise<void> {
  const jobId = job.id!;
  const { userId, projectId } = job.data;

  await withJobTracking(jobId, () =>
    withTimeout(
      (async () => {
        const db = getFirebaseAdminFirestore();
        const snapshot = await db
          .collection(COLLECTIONS.networkRequests)
          .where("projectId", "==", projectId)
          .orderBy("capturedAt", "desc")
          .limit(MAX_REQUESTS)
          .get();

        const requests = snapshot.docs.map((doc) => NetworkRequest.parse(doc.data()));
        const apiSummary = summarizeApiRequests(requests);

        const report = {
          projectId,
          generatedAt: new Date().toISOString(),
          requestCount: requests.length,
          apiSummary,
        };

        const bucket = getFirebaseAdminStorage().bucket();
        const storagePath = storagePaths(userId, projectId).report("network-report.json");
        await bucket
          .file(storagePath)
          .save(Buffer.from(JSON.stringify(report, null, 2), "utf-8"), {
            contentType: "application/json",
          });
      })(),
      QUEUE_TIMEOUT_MS["network-analysis"],
    ),
  );
}
