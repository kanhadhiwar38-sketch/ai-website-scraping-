# MCP Server & Coding-Agent Integration

WebRecon AI ships an MCP server (`apps/mcp-server`) exposing the 22 tools from
`implementation_plan.md` / spec Section 31 — 15 browser tools and 7 project tools.
It's a thin stdio MCP server: every tool call is a single REST call into `apps/api`,
so the same auth, ownership checks, and validation apply regardless of whether the
caller is the web dashboard or a coding agent.

```
Claude Code  →  MCP (stdio)  →  WebRecon AI API  →  Browser (Playwright)  →  Website
```

## 1. Create an API key

In the dashboard, go to **API Keys** → **Add Provider**... actually: **Create key**,
or via the API directly:

```bash
curl -X POST http://localhost:4000/api-keys \
  -H "Authorization: Bearer <your Firebase ID token>" \
  -H "Content-Type: application/json" \
  -d '{"label": "Claude Code"}'
```

The response includes the raw key (`wr_live_...`) **exactly once** — copy it now, it
is never shown again (only its hash is stored).

## 2. Configure your coding agent

For Claude Code, add an MCP server entry (e.g. in `.claude/mcp.json` or via
`claude mcp add`):

```json
{
  "mcpServers": {
    "webrecon-ai": {
      "command": "npx",
      "args": ["-y", "@webrecon/mcp-server"],
      "env": {
        "WEBRECON_API_URL": "http://localhost:4000",
        "WEBRECON_API_KEY": "wr_live_..."
      }
    }
  }
}
```

`GET /mcp/config` on the running API returns this same shape (with a placeholder for
the key) if you want to fetch it programmatically.

## 3. Local development

```bash
pnpm --filter @webrecon/mcp-server dev
```

Runs the server on stdio directly (useful for manual testing with an MCP inspector
tool) — set `WEBRECON_API_URL`/`WEBRECON_API_KEY` in your shell first.

## Tool reference

| Tool | Purpose |
| --- | --- |
| `browser_create_session` | Open an isolated browser session for a project |
| `browser_navigate` | Navigate to a URL (SSRF- and domain-checked) |
| `browser_get_page_info` | Current URL/title/viewport |
| `browser_get_dom` | Normalized DOM element snapshot + style/script URLs |
| `browser_get_html` | Rendered HTML |
| `browser_get_network` | Captured, secret-redacted network requests |
| `browser_get_api_summary` | Structural (values-stripped) API summary |
| `browser_get_assets` | Discovered assets on the current page |
| `browser_screenshot` | Screenshot (viewport or full page) |
| `browser_scroll` | Scroll to trigger lazy-loaded content |
| `browser_click` / `browser_type` | Basic interaction |
| `browser_get_links` | Raw anchor list |
| `browser_analyze_page` | Combined DOM + links + assets + network + API summary in one call |
| `browser_close_session` | Free the session's resources |
| `project_create` | Create a project for a URL |
| `project_get_status` | Status + crawl progress |
| `project_get_analysis` | AI-generated structural analysis |
| `project_get_screenshots` / `project_get_assets` | Crawl-archive metadata |
| `project_get_network_report` | Aggregated network/API report |
| `project_get_implementation_plan` | AI-generated implementation plan |

## Security notes

- API keys are stored as SHA-256 hashes only — the raw value is shown once, at
  creation.
- Every tool call still goes through the same SSRF guard, domain allowlist, and
  ownership checks as the REST API and web dashboard — the MCP layer adds no new
  privileges.
- Revoke a compromised key immediately via `POST /api-keys/:id/revoke` (or delete it
  outright with `DELETE /api-keys/:id`).
