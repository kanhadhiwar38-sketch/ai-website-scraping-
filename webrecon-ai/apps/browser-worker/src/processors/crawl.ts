import type { Job as BullJob } from "bullmq";
import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { createLogger } from "@webrecon/logger";
import {
  withJobTracking,
  updateJobStatus,
  isJobCancelled,
  enqueueJob,
  withTimeout,
  QUEUE_TIMEOUT_MS,
} from "@webrecon/jobs";
import type { JobPayloadMap } from "@webrecon/jobs";
import { CrawlerEngine, storeCrawlResult } from "@webrecon/crawler";
import { getProjectOrThrow } from "../firestore-helpers.js";

const logger = createLogger({ name: "crawl-processor" });

export async function processCrawlJob(job: BullJob<JobPayloadMap["crawl"]>): Promise<void> {
  const jobId = job.id!;
  const { userId, projectId } = job.data;

  await withJobTracking(jobId, async () => {
    const project = await getProjectOrThrow(projectId);

    const engine = new CrawlerEngine();
    const crawlPromise = engine.crawl({
      startUrl: project.url,
      allowedDomains: project.allowedDomains,
      autoScroll: project.options.autoScroll,
      limits: {
        maxPages: project.options.maxPages,
        maxDepth: project.options.maxDepth,
        maxSessionTimeMs: Number(process.env.MAX_BROWSER_TIME ?? 180_000),
      },
      onPageCrawled: (_page, pagesSoFar) => {
        const progress = Math.min(90, Math.round((pagesSoFar / project.options.maxPages) * 90));
        void updateJobStatus(jobId, { progress });
      },
      shouldAbort: () => isJobCancelled(jobId),
    });

    const result = await withTimeout(crawlPromise, QUEUE_TIMEOUT_MS.crawl);

    const stored = await storeCrawlResult(userId, projectId, result.pages);

    await getFirebaseAdminFirestore()
      .collection(COLLECTIONS.projects)
      .doc(projectId)
      .set(
        {
          pagesScanned: stored.pages.length,
          status: result.stoppedReason === "cancelled" ? "failed" : "analyzed",
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

    logger.info(
      { projectId, pages: stored.pages.length, stoppedReason: result.stoppedReason },
      "crawl stored",
    );

    // Chain follow-up jobs. Best-effort: a failure to *enqueue* a follow-up
    // must not fail the crawl job itself, since the crawl's own data is
    // already safely persisted at this point.
    if (project.options.networkInspection) {
      await enqueueJob("network-analysis", userId, projectId, { userId, projectId }).catch(
        (error: unknown) => logger.warn({ projectId, error }, "failed to enqueue network-analysis"),
      );
    }
    if (project.options.assetDiscovery) {
      await enqueueJob("asset-analysis", userId, projectId, { userId, projectId }).catch(
        (error: unknown) => logger.warn({ projectId, error }, "failed to enqueue asset-analysis"),
      );
    }
    if (project.options.screenshots) {
      const startPage = stored.pages.find((page) => page.url === project.url) ?? stored.pages[0];
      if (startPage) {
        await enqueueJob("screenshot", userId, projectId, {
          userId,
          projectId,
          pageId: startPage.id,
          url: startPage.url,
        }).catch((error: unknown) =>
          logger.warn({ projectId, error }, "failed to enqueue screenshot"),
        );
      }
    }
  });
}
