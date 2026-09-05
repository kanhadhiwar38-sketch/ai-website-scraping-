import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { generateId, nowIso } from "@webrecon/shared";
import { Asset } from "@webrecon/types";
import type { DiscoveredAsset } from "./discover.js";

const BATCH_LIMIT = 500; // Firestore batch write limit.

/**
 * Persists discovered assets for a single page. Deduplicates by URL within
 * the batch (a page can reference the same asset URL multiple times, e.g.
 * one favicon linked twice) but does not deduplicate across pages — a
 * project-level "unique assets" view can be derived at read time.
 */
export async function storeAssets(
  userId: string,
  projectId: string,
  sourcePageId: string,
  discovered: DiscoveredAsset[],
): Promise<Asset[]> {
  const uniqueByUrl = new Map<string, DiscoveredAsset>();
  for (const asset of discovered) {
    if (!uniqueByUrl.has(asset.url)) uniqueByUrl.set(asset.url, asset);
  }
  if (uniqueByUrl.size === 0) return [];

  const now = nowIso();
  const records: Asset[] = Array.from(uniqueByUrl.values()).map((asset) =>
    Asset.parse({
      id: generateId("asset"),
      userId,
      projectId,
      url: asset.url,
      type: asset.type,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      dimensions: asset.dimensions,
      sourcePageId,
      discoveredAt: now,
    }),
  );

  const db = getFirebaseAdminFirestore();
  for (let start = 0; start < records.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    for (const record of records.slice(start, start + BATCH_LIMIT)) {
      batch.set(db.collection(COLLECTIONS.assets).doc(record.id), record);
    }
    await batch.commit();
  }

  return records;
}
