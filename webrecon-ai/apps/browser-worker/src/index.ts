import { createQueueWorker, closeAllQueues, closeRedisConnection } from "@webrecon/jobs";
import { createLogger } from "@webrecon/logger";
import { processCrawlJob } from "./processors/crawl.js";
import { processNetworkAnalysisJob } from "./processors/network-analysis.js";
import { processAssetAnalysisJob } from "./processors/asset-analysis.js";
import { processScreenshotJob } from "./processors/screenshot.js";
import { makeUnimplementedProcessor } from "./processors/unimplemented.js";

const logger = createLogger({ name: "browser-worker" });

const workers = [
  createQueueWorker("crawl", processCrawlJob),
  createQueueWorker("network-analysis", processNetworkAnalysisJob),
  createQueueWorker("asset-analysis", processAssetAnalysisJob),
  createQueueWorker("screenshot", processScreenshotJob),
  createQueueWorker("ai-analysis", makeUnimplementedProcessor("ai-analysis", "Phase 9-10")),
  createQueueWorker(
    "project-generation",
    makeUnimplementedProcessor("project-generation", "Phase 11-12"),
  ),
  createQueueWorker("visual-test", makeUnimplementedProcessor("visual-test", "Phase 12")),
];

logger.info({ queues: workers.map((w) => w.name) }, "browser-worker started");

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down browser-worker");
  await Promise.all(workers.map((worker) => worker.close()));
  await closeAllQueues();
  await closeRedisConnection();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
