import { z } from "zod";

// ---------------------------------------------------------------------------
// Browser tools
// ---------------------------------------------------------------------------

export const browserCreateSessionInput = {
  projectId: z.string().min(1).describe("The project this browser session belongs to"),
  viewport: z.enum(["desktop", "tablet", "mobile"]).optional().describe("Viewport preset, default desktop"),
};

export const sessionIdOnlyInput = {
  sessionId: z.string().min(1).describe("Browser session id from browser_create_session"),
};

export const browserNavigateInput = {
  sessionId: z.string().min(1),
  url: z.string().url().describe("URL to navigate to — must be within the project's allowed domains"),
};

export const browserScreenshotInput = {
  sessionId: z.string().min(1),
  fullPage: z.boolean().optional().describe("Capture the full scrollable page instead of just the viewport"),
};

export const browserScrollInput = {
  sessionId: z.string().min(1),
  deltaY: z.number().optional().describe("Pixels to scroll down (default 800)"),
};

export const browserClickInput = {
  sessionId: z.string().min(1),
  selector: z.string().min(1).describe("CSS selector of the element to click"),
};

export const browserTypeInput = {
  sessionId: z.string().min(1),
  selector: z.string().min(1).describe("CSS selector of the input/textarea to fill"),
  text: z.string().describe("Text to type into the field"),
};

// ---------------------------------------------------------------------------
// Project tools
// ---------------------------------------------------------------------------

export const projectCreateInput = {
  url: z.string().url().describe("Website URL to analyze — must be owned by or authorized for the caller"),
  maxPages: z.number().int().min(1).max(500).optional(),
  maxDepth: z.number().int().min(0).max(10).optional(),
};

export const projectIdOnlyInput = {
  projectId: z.string().min(1),
};

// ---------------------------------------------------------------------------
// Tool catalog (names + descriptions), matching spec Section 31 exactly.
// The MCP server (apps/mcp-server) registers one entry per item here.
// ---------------------------------------------------------------------------

export const MCP_TOOL_NAMES = [
  "browser_create_session",
  "browser_navigate",
  "browser_get_page_info",
  "browser_get_dom",
  "browser_get_html",
  "browser_get_network",
  "browser_get_api_summary",
  "browser_get_assets",
  "browser_screenshot",
  "browser_scroll",
  "browser_click",
  "browser_type",
  "browser_get_links",
  "browser_analyze_page",
  "browser_close_session",
  "project_create",
  "project_get_status",
  "project_get_analysis",
  "project_get_screenshots",
  "project_get_assets",
  "project_get_network_report",
  "project_get_implementation_plan",
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export const MCP_TOOL_DESCRIPTIONS: Record<McpToolName, string> = {
  browser_create_session: "Open a new isolated browser session for a project.",
  browser_navigate: "Navigate the session's browser to a URL (SSRF- and domain-checked).",
  browser_get_page_info: "Get the current page's URL, title, and viewport.",
  browser_get_dom: "Get a structured, normalized DOM element snapshot plus stylesheet/script URLs.",
  browser_get_html: "Get the browser-rendered HTML of the current page.",
  browser_get_network: "Get captured (secret-redacted) network requests for the session.",
  browser_get_api_summary: "Get a structural (values-stripped) summary of observed API calls.",
  browser_get_assets: "Get discovered assets (images, fonts, CSS, JS, video, favicon) on the current page.",
  browser_screenshot: "Capture a screenshot of the current page.",
  browser_scroll: "Scroll the page (use to trigger lazy-loaded content).",
  browser_click: "Click an element by CSS selector.",
  browser_type: "Type text into an input/textarea by CSS selector.",
  browser_get_links: "Get every raw anchor href + text on the current page.",
  browser_analyze_page:
    "Get a combined inspection payload (page info, DOM, links, assets, network, API summary) in one call.",
  browser_close_session: "Close a browser session and free its resources.",
  project_create: "Create a new WebRecon project for a website URL.",
  project_get_status: "Get a project's current status and crawl progress.",
  project_get_analysis: "Get the AI-generated structural analysis for a project.",
  project_get_screenshots: "Get metadata for a project's captured screenshots.",
  project_get_assets: "Get discovered assets across all of a project's crawled pages.",
  project_get_network_report: "Get the project's aggregated network/API report.",
  project_get_implementation_plan: "Get the AI-generated implementation plan for a project.",
};
