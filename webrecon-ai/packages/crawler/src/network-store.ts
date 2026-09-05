import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { generateId } from "@webrecon/shared";
import { NetworkRequest } from "@webrecon/types";
import type { CapturedNetworkRequest } from "@webrecon/network-inspector";

/**
 * Writes captured network requests for a single page into Firestore.
 * Batched (Firestore's 500-write batch limit), already redacted upstream
 * by NetworkCapture — this function does not perform any additional
 * sanitization, it only persists what it's given.
 */
export async function storeNetworkRequests(
  userId: string,
  projectId: string,
  pageId: string,
  captured: CapturedNetworkRequest[],
): Promise<NetworkRequest[]> {
  if (captured.length === 0) return [];

  const db = getFirebaseAdminFirestore();
  const records: NetworkRequest[] = captured.map((request) =>
    NetworkRequest.parse({
      id: generateId("net"),
      userId,
      projectId,
      pageId,
      ...request,
    }),
  );

  const BATCH_LIMIT = 500;
  for (let start = 0; start < records.length; start += BATCH_LIMIT) {
    const batch = db.batch();
    for (const record of records.slice(start, start + BATCH_LIMIT)) {
      batch.set(db.collection(COLLECTIONS.networkRequests).doc(record.id), record);
    }
    await batch.commit();
  }

  return records;
}
