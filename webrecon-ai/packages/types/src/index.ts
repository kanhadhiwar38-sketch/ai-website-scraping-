import { z } from "zod";

/**
 * Single source of truth for every persisted shape in WebRecon AI.
 * All other packages import types from here rather than redeclaring them.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const IsoDateString = z.string().datetime();

export const JobStatus = z.enum([
  "pending",
  "active",
  "completed",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobQueueName = z.enum([
  "crawl",
  "network-analysis",
  "asset-analysis",
  "screenshot",
  "ai-analysis",
  "project-generation",
  "visual-test",
]);
export type JobQueueName = z.infer<typeof JobQueueName>;

// ---------------------------------------------------------------------------
// URL / domain validation (used by API request schemas AND the security guard)
// ---------------------------------------------------------------------------

/**
 * Structural validation only — this does NOT perform DNS resolution or SSRF
 * checks. That belongs to packages/security, which runs at request time
 * (DNS can change between validation and use). This schema just rejects
 * obviously malformed or non-http(s) input at the API boundary.
 */
export const HttpUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use http or https");

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export const ProjectStatus = z.enum([
  "created",
  "analyzing",
  "analyzed",
  "generating",
  "generated",
  "comparing",
  "completed",
  "failed",
]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const ProjectOptions = z.object({
  maxPages: z.number().int().min(1).max(500).default(50),
  maxDepth: z.number().int().min(0).max(10).default(3),
  autoScroll: z.boolean().default(true),
  screenshots: z.boolean().default(true),
  networkInspection: z.boolean().default(true),
  assetDiscovery: z.boolean().default(true),
  responsiveInspection: z.boolean().default(true),
  aiAnalysis: z.boolean().default(true),
});
export type ProjectOptions = z.infer<typeof ProjectOptions>;

export const Project = z.object({
  id: z.string(),
  userId: z.string(),
  url: HttpUrl,
  allowedDomains: z.array(z.string()).min(1),
  status: ProjectStatus,
  options: ProjectOptions,
  pagesScanned: z.number().int().min(0).default(0),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type Project = z.infer<typeof Project>;

export const CreateProjectInput = z.object({
  url: HttpUrl,
  options: ProjectOptions.partial().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

// ---------------------------------------------------------------------------
// Browser session
// ---------------------------------------------------------------------------

export const BrowserSessionStatus = z.enum([
  "starting",
  "ready",
  "busy",
  "closed",
  "error",
]);
export type BrowserSessionStatus = z.infer<typeof BrowserSessionStatus>;

export const BrowserSession = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  status: BrowserSessionStatus,
  currentUrl: z.string().optional(),
  viewport: z.object({ width: z.number(), height: z.number() }).optional(),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
  expiresAt: IsoDateString,
});
export type BrowserSession = z.infer<typeof BrowserSession>;

// ---------------------------------------------------------------------------
// Pages / DOM
// ---------------------------------------------------------------------------

export const DomElement = z.object({
  tag: z.string(),
  id: z.string().optional(),
  classes: z.array(z.string()).default([]),
  text: z.string().optional(),
  attributes: z.record(z.string()).default({}),
  boundingBox: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional(),
  selector: z.string(),
  role: z.string().optional(),
});
export type DomElement = z.infer<typeof DomElement>;

export const Page = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  url: z.string(),
  title: z.string().optional(),
  depth: z.number().int().min(0),
  html: z.string().optional(),
  links: z.array(z.string()).default([]),
  elements: z.array(DomElement).default([]),
  styles: z.array(z.string()).default([]),
  scripts: z.array(z.string()).default([]),
  discoveredAt: IsoDateString,
});
export type Page = z.infer<typeof Page>;

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export const ResourceType = z.enum([
  "document",
  "stylesheet",
  "script",
  "image",
  "font",
  "fetch",
  "xhr",
  "websocket",
  "media",
  "other",
]);
export type ResourceType = z.infer<typeof ResourceType>;

export const NetworkRequest = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  pageId: z.string(),
  url: z.string(),
  method: z.string(),
  status: z.number().int().optional(),
  resourceType: ResourceType,
  requestHeaders: z.record(z.string()).default({}),
  responseHeaders: z.record(z.string()).default({}),
  queryParams: z.record(z.string()).default({}),
  requestBody: z.string().nullable().default(null),
  responseBody: z.string().nullable().default(null),
  durationMs: z.number().optional(),
  redacted: z.boolean().default(false),
  capturedAt: IsoDateString,
});
export type NetworkRequest = z.infer<typeof NetworkRequest>;

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const AssetType = z.enum([
  "image",
  "svg",
  "font",
  "css",
  "js",
  "video",
  "favicon",
  "other",
]);
export type AssetType = z.infer<typeof AssetType>;

export const Asset = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  url: z.string(),
  type: AssetType,
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
  sourcePageId: z.string().optional(),
  discoveredAt: IsoDateString,
});
export type Asset = z.infer<typeof Asset>;

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

export const ViewportPreset = z.enum(["desktop", "tablet", "mobile"]);
export type ViewportPreset = z.infer<typeof ViewportPreset>;

export const Screenshot = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  pageId: z.string(),
  viewport: ViewportPreset,
  storagePath: z.string(),
  fullPage: z.boolean(),
  capturedAt: IsoDateString,
});
export type Screenshot = z.infer<typeof Screenshot>;

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export const Job = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  queue: JobQueueName,
  status: JobStatus,
  progress: z.number().min(0).max(100).default(0),
  error: z.string().optional(),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type Job = z.infer<typeof Job>;

// ---------------------------------------------------------------------------
// AI: providers, models, usage
// ---------------------------------------------------------------------------

export const AIMode = z.enum(["AUTO", "FREE", "BEST_CODING", "CUSTOM"]);
export type AIMode = z.infer<typeof AIMode>;

export const AITaskType = z.enum([
  "WEBSITE_ANALYSIS",
  "DOM_ANALYSIS",
  "SCREENSHOT_ANALYSIS",
  "NETWORK_ANALYSIS",
  "IMPLEMENTATION_PLAN",
  "CODE_GENERATION",
  "CODE_REVIEW",
  "VISUAL_COMPARISON",
  "DEBUGGING",
]);
export type AITaskType = z.infer<typeof AITaskType>;

export const AIModel = z.object({
  id: z.string(),
  providerId: z.string(),
  contextLength: z.number().optional(),
  inputModalities: z.array(z.string()).default(["text"]),
  outputModalities: z.array(z.string()).default(["text"]),
  supportsTools: z.boolean().default(false),
  supportsStructuredOutput: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsReasoning: z.boolean().default(false),
  supportsStreaming: z.boolean().default(false),
  pricePerMInputTokens: z.number().optional(),
  pricePerMOutputTokens: z.number().optional(),
  isFree: z.boolean().default(false),
  codingScore: z.number().min(0).max(100).optional(),
  available: z.boolean().default(true),
});
export type AIModel = z.infer<typeof AIModel>;

export const AIProviderKind = z.enum(["openrouter", "custom"]);

export const AIProviderConfig = z.object({
  id: z.string(),
  userId: z.string(),
  kind: AIProviderKind,
  name: z.string(),
  baseURL: z.string().url(),
  // apiKey is intentionally NOT included here — it is stored separately,
  // server-side only, and never round-tripped to the client. See
  // packages/firebase server-only "aiProviderSecrets" access pattern.
  status: z.enum(["untested", "ok", "error"]).default("untested"),
  lastTestedAt: IsoDateString.optional(),
  disabled: z.boolean().default(false),
  createdAt: IsoDateString,
  updatedAt: IsoDateString,
});
export type AIProviderConfig = z.infer<typeof AIProviderConfig>;

export const AIUsage = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string().optional(),
  providerId: z.string(),
  model: z.string(),
  taskType: AITaskType,
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  estimatedCost: z.number().min(0),
  latencyMs: z.number().min(0),
  status: z.enum(["ok", "error"]),
  createdAt: IsoDateString,
});
export type AIUsage = z.infer<typeof AIUsage>;

// ---------------------------------------------------------------------------
// AI analysis / implementation plan / generated projects
// ---------------------------------------------------------------------------

export const AIAnalysis = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  siteType: z.string().optional(),
  pages: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  navigation: z.record(z.unknown()).default({}),
  layout: z.record(z.unknown()).default({}),
  colors: z.array(z.string()).default([]),
  fonts: z.array(z.string()).default([]),
  spacing: z.record(z.unknown()).default({}),
  responsiveBehavior: z.record(z.unknown()).default({}),
  forms: z.array(z.record(z.unknown())).default([]),
  dataSources: z.array(z.string()).default([]),
  apiSummary: z.array(z.record(z.unknown())).default([]),
  assetSummary: z.array(z.record(z.unknown())).default([]),
  createdAt: IsoDateString,
});
export type AIAnalysis = z.infer<typeof AIAnalysis>;

export const ImplementationPlan = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  routes: z.array(z.string()).default([]),
  components: z.array(z.string()).default([]),
  pages: z.array(z.string()).default([]),
  stateManagement: z.string().optional(),
  apiIntegration: z.array(z.string()).default([]),
  responsiveBehavior: z.string().optional(),
  testingPlan: z.array(z.string()).default([]),
  createdAt: IsoDateString,
});
export type ImplementationPlan = z.infer<typeof ImplementationPlan>;

export const GeneratedProject = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  iteration: z.number().int().min(1),
  storagePath: z.string(),
  visualDiffScore: z.number().min(0).max(1).optional(),
  createdAt: IsoDateString,
});
export type GeneratedProject = z.infer<typeof GeneratedProject>;

// ---------------------------------------------------------------------------
// API keys (WebRecon's own API, not AI provider keys)
// ---------------------------------------------------------------------------

export const ApiKey = z.object({
  id: z.string(),
  userId: z.string(),
  label: z.string(),
  prefix: z.string(), // e.g. "wr_live_ab12" — safe to display
  hashedKey: z.string(), // never the raw key
  lastUsedAt: IsoDateString.optional(),
  createdAt: IsoDateString,
  revokedAt: IsoDateString.optional(),
});
export type ApiKey = z.infer<typeof ApiKey>;

// ---------------------------------------------------------------------------
// Responsive analysis (Section 19 — responsive-analysis.json)
// ---------------------------------------------------------------------------

/**
 * One element's geometry/visibility at a single viewport, keyed by the same
 * `selector` produced by packages/dom-inspector so records line up across
 * viewports without re-matching elements by content.
 */
export const ResponsiveElementState = z.object({
  selector: z.string(),
  tag: z.string(),
  visible: z.boolean(),
  boundingBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  fontSizePx: z.number().optional(),
});
export type ResponsiveElementState = z.infer<typeof ResponsiveElementState>;

export const ResponsiveViewportSnapshot = z.object({
  viewport: ViewportPreset,
  width: z.number(),
  height: z.number(),
  documentHeight: z.number(),
  navigationVariant: z.string().optional(), // e.g. "hamburger-menu" vs "horizontal-nav"
  elements: z.array(ResponsiveElementState),
});
export type ResponsiveViewportSnapshot = z.infer<typeof ResponsiveViewportSnapshot>;

/** A single element whose visibility or stacking order changed between two viewports. */
export const ResponsiveDifference = z.object({
  selector: z.string(),
  kind: z.enum(["hidden", "shown", "reflowed", "resized", "restacked"]),
  from: ViewportPreset,
  to: ViewportPreset,
  detail: z.string(),
});
export type ResponsiveDifference = z.infer<typeof ResponsiveDifference>;

export const ResponsiveBreakpoint = z.object({
  /** Approximate width (px) at which layout-affecting differences begin. */
  widthPx: z.number(),
  betweenViewports: z.tuple([ViewportPreset, ViewportPreset]),
  changeCount: z.number().int().min(0),
});
export type ResponsiveBreakpoint = z.infer<typeof ResponsiveBreakpoint>;

export const ResponsiveAnalysis = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string(),
  pageId: z.string(),
  snapshots: z.array(ResponsiveViewportSnapshot),
  differences: z.array(ResponsiveDifference),
  breakpoints: z.array(ResponsiveBreakpoint),
  analyzedAt: IsoDateString,
});
export type ResponsiveAnalysis = z.infer<typeof ResponsiveAnalysis>;

// ---------------------------------------------------------------------------
// Standard API error envelope (Section 47)
// ---------------------------------------------------------------------------

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
