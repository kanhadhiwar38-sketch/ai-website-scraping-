import type { Job as BullJob } from "bullmq";
import { chromium } from "playwright";
import { assertSafeUrl } from "@webrecon/security";
import { withJobTracking, withTimeout, QUEUE_TIMEOUT_MS } from "@webrecon/jobs";
import type { JobPayloadMap } from "@webrecon/jobs";
import { captureScreenshotSet } from "@webrecon/screenshot-engine";
import { storeScreenshots } from "@webrecon/screenshot-engine";
import { getProjectOrThrow } from "../firestore-helpers.js";

export async function processScreenshotJob(
  job: BullJob<JobPayloadMap["screenshot"]>,
): Promise<void> {
  const jobId = job.id!;
  const { userId, projectId, pageId, url } = job.data;

  await withJobTracking(jobId, () =>
    withTimeout(
      (async () => {
        const project = await getProjectOrThrow(projectId);
        await assertSafeUrl(url, { allowedDomains: project.allowedDomains });

        const browser = await chromium.launch({ headless: true });
        try {
          const context = await browser.newContext();
          try {
            const captured = await captureScreenshotSet(context, url);
            await storeScreenshots(userId, projectId, pageId, captured);
          } finally {
            await context.close();
          }
        } finally {
          await browser.close();
        }
      })(),
      QUEUE_TIMEOUT_MS.screenshot,
    ),
  );
}
