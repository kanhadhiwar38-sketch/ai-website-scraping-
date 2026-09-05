import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { generateId, nowIso } from "@webrecon/shared";
import { Page } from "@webrecon/types";
import type { CrawledPage } from "./crawler-engine.js";

/**
 * Writes a batch of crawled pages to Firestore under the `pages` collection,
 * scoped to the owning user + project. Uses a single batch write so a crawl
 * either fully persists or fully fails rather than leaving a partial page
 * set behind.
 */
export async function storeCrawledPages(
  userId: string,
  projectId: string,
  crawledPages: CrawledPage[],
): Promise<Page[]> {
  const db = getFirebaseAdminFirestore();
  const batch = db.batch();
  const now = nowIso();

  const records: Page[] = crawledPages.map((crawled) =>
    Page.parse({
      id: generateId("page"),
      userId,
      projectId,
      url: crawled.url,
      title: crawled.title,
      depth: crawled.depth,
      html: crawled.html,
      links: crawled.links,
      elements: crawled.elements,
      styles: crawled.styles,
      scripts: crawled.scripts,
      discoveredAt: now,
    }),
  );

  for (const record of records) {
    batch.set(db.collection(COLLECTIONS.pages).doc(record.id), record);
  }

  await batch.commit();
  return records;
}
