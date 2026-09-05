import { getFirebaseAdminFirestore, getFirebaseAdminStorage } from "@webrecon/firebase/admin";
import { COLLECTIONS, storagePaths } from "@webrecon/firebase";
import { generateId, nowIso } from "@webrecon/shared";
import { Screenshot } from "@webrecon/types";
import type { CapturedScreenshot } from "./capture.js";

/**
 * Uploads each screenshot's PNG bytes to Firebase Storage (spec Section 6:
 * binary files live in Storage, metadata in Firestore) and writes the
 * matching Firestore `screenshots` record pointing at the storage path.
 * Binary bytes never touch Firestore.
 */
export async function storeScreenshots(
  userId: string,
  projectId: string,
  pageId: string,
  captured: CapturedScreenshot[],
): Promise<Screenshot[]> {
  if (captured.length === 0) return [];

  const bucket = getFirebaseAdminStorage().bucket();
  const paths = storagePaths(userId, projectId);
  const db = getFirebaseAdminFirestore();

  const records: Screenshot[] = [];

  for (const shot of captured) {
    const id = generateId("shot");
    const fileName = `${pageId}-${shot.viewport}-${shot.fullPage ? "full" : "viewport"}-${id}.png`;
    const storagePath = paths.screenshot(fileName);

    await bucket.file(storagePath).save(shot.buffer, {
      contentType: "image/png",
      metadata: { cacheControl: "private, max-age=3600" },
    });

    records.push(
      Screenshot.parse({
        id,
        userId,
        projectId,
        pageId,
        viewport: shot.viewport,
        storagePath,
        fullPage: shot.fullPage,
        capturedAt: shot.capturedAt ?? nowIso(),
      }),
    );
  }

  const batch = db.batch();
  for (const record of records) {
    batch.set(db.collection(COLLECTIONS.screenshots).doc(record.id), record);
  }
  await batch.commit();

  return records;
}

/** Returns a short-lived signed URL for a stored screenshot (for UI display). */
export async function getScreenshotSignedUrl(storagePath: string, expiresInMs = 15 * 60_000): Promise<string> {
  const bucket = getFirebaseAdminStorage().bucket();
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMs,
  });
  return url;
}
