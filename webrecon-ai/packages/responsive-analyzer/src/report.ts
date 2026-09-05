import { getFirebaseAdminStorage } from "@webrecon/firebase/admin";
import { storagePaths } from "@webrecon/firebase";
import { generateId, nowIso } from "@webrecon/shared";
import { ResponsiveAnalysis, type ResponsiveViewportSnapshot } from "@webrecon/types";
import { compareResponsiveSnapshots } from "./compare.js";

/**
 * Builds the typed report object from a set of per-viewport snapshots.
 * `ResponsiveAnalysis` is not one of the fixed Firestore collections from
 * spec Section 5 — it's an export artifact (Section 19: "Generate:
 * responsive-analysis.json", Section 44: project export) — so this only
 * constructs the object; `exportResponsiveAnalysis` below is what persists
 * it, to Storage rather than Firestore.
 */
export function buildResponsiveAnalysis(
  userId: string,
  projectId: string,
  pageId: string,
  snapshots: ResponsiveViewportSnapshot[],
): ResponsiveAnalysis {
  const { differences, breakpoints } = compareResponsiveSnapshots(snapshots);

  return ResponsiveAnalysis.parse({
    id: generateId("responsive"),
    userId,
    projectId,
    pageId,
    snapshots,
    differences,
    breakpoints,
    analyzedAt: nowIso(),
  });
}

/** Writes `responsive-analysis.json` for this page to Firebase Storage's reports path. */
export async function exportResponsiveAnalysis(analysis: ResponsiveAnalysis): Promise<string> {
  const bucket = getFirebaseAdminStorage().bucket();
  const paths = storagePaths(analysis.userId, analysis.projectId);
  const storagePath = paths.report(`responsive-analysis-${analysis.pageId}.json`);

  await bucket.file(storagePath).save(Buffer.from(JSON.stringify(analysis, null, 2), "utf-8"), {
    contentType: "application/json",
  });

  return storagePath;
}
