import type { Page, NetworkRequest, Asset } from "@webrecon/types";
import type { CrawledPage } from "./crawler-engine.js";
import { storeCrawledPages } from "./page-store.js";
import { storeNetworkRequests } from "./network-store.js";
import { storeAssets } from "@webrecon/asset-analyzer";

export interface StoredCrawlResult {
  pages: Page[];
  networkRequests: NetworkRequest[];
  assets: Asset[];
}

/**
 * Persists every crawled page and then, using the page IDs Firestore just
 * assigned, persists each page's captured network requests and discovered
 * assets, both linked by pageId. Kept as a single entry point so callers
 * (the Phase 7 BullMQ `crawl` worker) don't have to remember the ordering.
 */
export async function storeCrawlResult(
  userId: string,
  projectId: string,
  crawledPages: CrawledPage[],
): Promise<StoredCrawlResult> {
  const storedPages = await storeCrawledPages(userId, projectId, crawledPages);

  const networkRequests: NetworkRequest[] = [];
  const assets: Asset[] = [];
  for (let i = 0; i < storedPages.length; i += 1) {
    const storedPage = storedPages[i];
    const crawledPage = crawledPages[i];
    if (!storedPage || !crawledPage) continue;

    const storedNetwork = await storeNetworkRequests(
      userId,
      projectId,
      storedPage.id,
      crawledPage.networkRequests,
    );
    networkRequests.push(...storedNetwork);

    const storedAssets = await storeAssets(userId, projectId, storedPage.id, crawledPage.assets);
    assets.push(...storedAssets);
  }

  return { pages: storedPages, networkRequests, assets };
}
