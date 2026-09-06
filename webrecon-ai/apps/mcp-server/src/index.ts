import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  WebReconApiClient,
  WebReconApiError,
  MCP_TOOL_DESCRIPTIONS,
  browserCreateSessionInput,
  sessionIdOnlyInput,
  browserNavigateInput,
  browserScreenshotInput,
  browserScrollInput,
  browserClickInput,
  browserTypeInput,
  projectCreateInput,
  projectIdOnlyInput,
} from "@webrecon/mcp-tools";

const apiKey = process.env.WEBRECON_API_KEY;
if (!apiKey) {
  process.stderr.write(
    "WEBRECON_API_KEY is not set. Create one from WebRecon AI's /api-keys page and set it " +
      "in this MCP server's environment before starting.\n",
  );
  process.exit(1);
}

const client = new WebReconApiClient({
  baseUrl: process.env.WEBRECON_API_URL ?? "http://localhost:4000",
  apiKey,
});

const server = new McpServer({ name: "webrecon-ai", version: "0.1.0" });

/** Wraps a tool handler so any WebReconApiError becomes a clear MCP tool error, not a crash. */
function toolResult(work: () => Promise<unknown>) {
  return async () => {
    try {
      const data = await work();
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      const message =
        error instanceof WebReconApiError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
    }
  };
}

// ---------------------------------------------------------------------------
// Browser tools
// ---------------------------------------------------------------------------

server.tool(
  "browser_create_session",
  MCP_TOOL_DESCRIPTIONS.browser_create_session,
  browserCreateSessionInput,
  (input) => toolResult(() => client.browserCreateSession(input))(),
);

server.tool(
  "browser_navigate",
  MCP_TOOL_DESCRIPTIONS.browser_navigate,
  browserNavigateInput,
  ({ sessionId, url }) => toolResult(() => client.browserNavigate(sessionId, url))(),
);

server.tool(
  "browser_get_page_info",
  MCP_TOOL_DESCRIPTIONS.browser_get_page_info,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserGetPageInfo(sessionId))(),
);

server.tool(
  "browser_get_dom",
  MCP_TOOL_DESCRIPTIONS.browser_get_dom,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserGetDom(sessionId))(),
);

server.tool(
  "browser_get_html",
  MCP_TOOL_DESCRIPTIONS.browser_get_html,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserGetHtml(sessionId))(),
);

server.tool(
  "browser_get_network",
  MCP_TOOL_DESCRIPTIONS.browser_get_network,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserGetNetwork(sessionId))(),
);

server.tool(
  "browser_get_api_summary",
  MCP_TOOL_DESCRIPTIONS.browser_get_api_summary,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserGetApiSummary(sessionId))(),
);

server.tool(
  "browser_get_assets",
  MCP_TOOL_DESCRIPTIONS.browser_get_assets,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserGetAssets(sessionId))(),
);

server.tool(
  "browser_screenshot",
  MCP_TOOL_DESCRIPTIONS.browser_screenshot,
  browserScreenshotInput,
  ({ sessionId, fullPage }) => toolResult(() => client.browserScreenshot(sessionId, fullPage))(),
);

server.tool(
  "browser_scroll",
  MCP_TOOL_DESCRIPTIONS.browser_scroll,
  browserScrollInput,
  ({ sessionId, deltaY }) => toolResult(() => client.browserScroll(sessionId, deltaY))(),
);

server.tool(
  "browser_click",
  MCP_TOOL_DESCRIPTIONS.browser_click,
  browserClickInput,
  ({ sessionId, selector }) => toolResult(() => client.browserClick(sessionId, selector))(),
);

server.tool(
  "browser_type",
  MCP_TOOL_DESCRIPTIONS.browser_type,
  browserTypeInput,
  ({ sessionId, selector, text }) => toolResult(() => client.browserType(sessionId, selector, text))(),
);

server.tool(
  "browser_get_links",
  MCP_TOOL_DESCRIPTIONS.browser_get_links,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserGetLinks(sessionId))(),
);

server.tool(
  "browser_analyze_page",
  MCP_TOOL_DESCRIPTIONS.browser_analyze_page,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserAnalyzePage(sessionId))(),
);

server.tool(
  "browser_close_session",
  MCP_TOOL_DESCRIPTIONS.browser_close_session,
  sessionIdOnlyInput,
  ({ sessionId }) => toolResult(() => client.browserCloseSession(sessionId))(),
);

// ---------------------------------------------------------------------------
// Project tools
// ---------------------------------------------------------------------------

server.tool(
  "project_create",
  MCP_TOOL_DESCRIPTIONS.project_create,
  projectCreateInput,
  ({ url, maxPages, maxDepth }) =>
    toolResult(() =>
      client.projectCreate({
        url,
        options: {
          ...(maxPages !== undefined ? { maxPages } : {}),
          ...(maxDepth !== undefined ? { maxDepth } : {}),
        },
      }),
    )(),
);

server.tool(
  "project_get_status",
  MCP_TOOL_DESCRIPTIONS.project_get_status,
  projectIdOnlyInput,
  ({ projectId }) => toolResult(() => client.projectGetStatus(projectId))(),
);

server.tool(
  "project_get_analysis",
  MCP_TOOL_DESCRIPTIONS.project_get_analysis,
  projectIdOnlyInput,
  ({ projectId }) => toolResult(() => client.projectGetAnalysis(projectId))(),
);

server.tool(
  "project_get_screenshots",
  MCP_TOOL_DESCRIPTIONS.project_get_screenshots,
  projectIdOnlyInput,
  ({ projectId }) => toolResult(() => client.projectGetScreenshots(projectId))(),
);

server.tool(
  "project_get_assets",
  MCP_TOOL_DESCRIPTIONS.project_get_assets,
  projectIdOnlyInput,
  ({ projectId }) => toolResult(() => client.projectGetAssets(projectId))(),
);

server.tool(
  "project_get_network_report",
  MCP_TOOL_DESCRIPTIONS.project_get_network_report,
  projectIdOnlyInput,
  ({ projectId }) => toolResult(() => client.projectGetNetworkReport(projectId))(),
);

server.tool(
  "project_get_implementation_plan",
  MCP_TOOL_DESCRIPTIONS.project_get_implementation_plan,
  projectIdOnlyInput,
  ({ projectId }) => toolResult(() => client.projectGetImplementationPlan(projectId))(),
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("WebRecon AI MCP server running on stdio\n");
