import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MCP_TOOL_NAMES,
  MCP_TOOL_DESCRIPTIONS,
  browserNavigateInput,
  projectCreateInput,
} from "../tool-defs.js";

describe("MCP tool catalog", () => {
  it("lists exactly the 22 tools from spec Section 31", () => {
    expect(MCP_TOOL_NAMES).toHaveLength(22);
    expect(MCP_TOOL_NAMES).toContain("browser_analyze_page");
    expect(MCP_TOOL_NAMES).toContain("project_get_implementation_plan");
  });

  it("has a description for every tool", () => {
    for (const name of MCP_TOOL_NAMES) {
      expect(MCP_TOOL_DESCRIPTIONS[name]).toBeTruthy();
    }
  });
});

describe("tool input schemas", () => {
  it("browserNavigateInput rejects a non-URL", () => {
    const schema = z.object(browserNavigateInput);
    expect(schema.safeParse({ sessionId: "s1", url: "not-a-url" }).success).toBe(false);
    expect(schema.safeParse({ sessionId: "s1", url: "https://example.com" }).success).toBe(true);
  });

  it("projectCreateInput requires a valid URL and accepts optional limits", () => {
    const schema = z.object(projectCreateInput);
    expect(schema.safeParse({ url: "https://example.com", maxPages: 10 }).success).toBe(true);
    expect(schema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });
});
