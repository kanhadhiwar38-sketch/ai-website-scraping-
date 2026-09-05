/**
 * Canonical Firestore collection names and Storage path builders.
 * Import this from both client and admin contexts — it has no SDK
 * dependency, just string constants and pure functions.
 */

export const COLLECTIONS = {
  users: "users",
  projects: "projects",
  browserSessions: "browserSessions",
  pages: "pages",
  networkRequests: "networkRequests",
  assets: "assets",
  screenshots: "screenshots",
  jobs: "jobs",
  aiAnalyses: "aiAnalyses",
  implementationPlans: "implementationPlans",
  generatedProjects: "generatedProjects",
  aiProviders: "aiProviders",
  aiUsage: "aiUsage",
  apiKeys: "apiKeys",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export function storagePaths(userId: string, projectId: string) {
  const base = `users/${userId}/projects/${projectId}`;
  return {
    screenshots: `${base}/screenshots`,
    assets: `${base}/assets`,
    reports: `${base}/reports`,
    screenshot: (fileName: string) => `${base}/screenshots/${fileName}`,
    asset: (fileName: string) => `${base}/assets/${fileName}`,
    report: (fileName: string) => `${base}/reports/${fileName}`,
  };
}
