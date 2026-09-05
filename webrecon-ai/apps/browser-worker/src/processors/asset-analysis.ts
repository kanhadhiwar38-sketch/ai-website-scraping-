import type { Job as BullJob } from "bullmq";
import { getFirebaseAdminFirestore, getFirebaseAdminStorage } from "@webrecon/firebase/admin";
import { COLLECTIONS, storagePaths } from "@webrecon/firebase";
import { withJobTracking, withTimeout, QUEUE_TIMEOUT_MS } from "@webrecon/jobs";
import type { JobPayloadMap } from "@webrecon/jobs";
import { Asset, type AssetType } from "@webrecon/types";

const MAX_ASSETS = 5000;

export async function processAssetAnalysisJob(
  job: BullJob<JobPayloadMap["asset-analysis"]>,
): Promise<void> {
  const jobId = job.id!;
  const { userId, projectId } = job.data;

  await withJobTracking(jobId, () =>
    withTimeout(
      (async () => {
        const db = getFirebaseAdminFirestore();
        const snapshot = await db
          .collection(COLLECTIONS.assets)
          .where("projectId", "==", projectId)
          .limit(MAX_ASSETS)
          .get();

        const assets = snapshot.docs.map((doc) => Asset.parse(doc.data()));

        const uniqueByUrl = new Map<string, Asset>();
        for (const asset of assets) {
          if (!uniqueByUrl.has(asset.url)) uniqueByUrl.set(asset.url, asset);
        }
        const unique = Array.from(uniqueByUrl.values());

        const countsByType = unique.reduce<Record<string, number>>((counts, asset) => {
          const type: AssetType = asset.type;
          counts[type] = (counts[type] ?? 0) + 1;
          return counts;
        }, {});

        const report = {
          projectId,
          generatedAt: new Date().toISOString(),
          totalReferences: assets.length,
          uniqueAssetCount: unique.length,
          countsByType,
          assets: unique,
        };

        const bucket = getFirebaseAdminStorage().bucket();
        const storagePath = storagePaths(userId, projectId).report("asset-report.json");
        await bucket
          .file(storagePath)
          .save(Buffer.from(JSON.stringify(report, null, 2), "utf-8"), {
            contentType: "application/json",
          });
      })(),
      QUEUE_TIMEOUT_MS["asset-analysis"],
    ),
  );
}
