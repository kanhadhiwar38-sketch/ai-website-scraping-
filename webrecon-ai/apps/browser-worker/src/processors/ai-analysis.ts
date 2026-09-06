import type { Job as BullJob } from "bullmq";
import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { withJobTracking, updateJobStatus, withTimeout, QUEUE_TIMEOUT_MS } from "@webrecon/jobs";
import type { JobPayloadMap } from "@webrecon/jobs";
import { Asset, NetworkRequest, Page } from "@webrecon/types";
import { summarizeApiRequests } from "@webrecon/network-inspector";
import { buildGatewayForUser, buildWebsiteAnalysisContext, analyzeWebsite, planImplementation } from "@webrecon/ai";
import { getProjectOrThrow } from "../firestore-helpers.js";

const MAX_PAGES_FOR_CONTEXT = 20;
const MAX_NETWORK_REQUESTS = 1000;
const MAX_ASSETS = 2000;

export async function processAiAnalysisJob(job: BullJob<JobPayloadMap["ai-analysis"]>): Promise<void> {
  const jobId = job.id!;
  const { userId, projectId, mode } = job.data;

  await withJobTracking(jobId, () =>
    withTimeout(
      (async () => {
        const project = await getProjectOrThrow(projectId);
        const db = getFirebaseAdminFirestore();

        const [pagesSnapshot, networkSnapshot, assetsSnapshot] = await Promise.all([
          db
            .collection(COLLECTIONS.pages)
            .where("projectId", "==", projectId)
            .limit(MAX_PAGES_FOR_CONTEXT)
            .get(),
          db
            .collection(COLLECTIONS.networkRequests)
            .where("projectId", "==", projectId)
            .limit(MAX_NETWORK_REQUESTS)
            .get(),
          db.collection(COLLECTIONS.assets).where("projectId", "==", projectId).limit(MAX_ASSETS).get(),
        ]);

        const pages = pagesSnapshot.docs.map((doc) => Page.parse(doc.data()));
        const networkRequests = networkSnapshot.docs.map((doc) => NetworkRequest.parse(doc.data()));
        const assets = assetsSnapshot.docs.map((doc) => Asset.parse(doc.data()));

        if (pages.length === 0) {
          throw new Error(
            "No crawled pages found for this project yet — run analysis (crawl) first.",
          );
        }

        await updateJobStatus(jobId, { progress: 20 });

        const apiSummary = summarizeApiRequests(networkRequests);
        const context = buildWebsiteAnalysisContext(project.url, pages, assets, apiSummary);

        const gateway = await buildGatewayForUser(userId);
        const selectedMode = mode ?? "AUTO";

        const analysis = await analyzeWebsite(gateway, {
          userId,
          projectId,
          mode: selectedMode,
          context,
        });
        await updateJobStatus(jobId, { progress: 60 });

        await planImplementation(gateway, {
          userId,
          projectId,
          mode: selectedMode,
          analysis,
        });
        await updateJobStatus(jobId, { progress: 90 });
      })(),
      QUEUE_TIMEOUT_MS["ai-analysis"],
    ),
  );
}
