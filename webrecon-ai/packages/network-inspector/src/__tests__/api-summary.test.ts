import { describe, expect, it } from "vitest";
import { inferSchema, summarizeApiRequests } from "../api-summary.js";
import type { CapturedNetworkRequest } from "../capture.js";

describe("inferSchema", () => {
  it("infers primitive types", () => {
    expect(inferSchema("hi")).toBe("string");
    expect(inferSchema(42)).toBe("number");
    expect(inferSchema(true)).toBe("boolean");
    expect(inferSchema(null)).toBe("null");
  });

  it("infers object shape without leaking values", () => {
    const result = inferSchema({ name: "Alice", age: 30 });
    expect(result).toEqual({ type: "object", properties: { name: "string", age: "number" } });
    expect(JSON.stringify(result)).not.toContain("Alice");
  });

  it("infers array shape from the first element", () => {
    const result = inferSchema([{ id: 1 }, { id: 2 }]);
    expect(result).toEqual({ type: "array", items: { type: "object", properties: { id: "number" } } });
  });

  it("handles empty arrays", () => {
    expect(inferSchema([])).toEqual({ type: "array", items: "unknown" });
  });

  it("caps recursion depth", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 20; i += 1) deep = { nested: deep };
    const result = inferSchema(deep);
    expect(JSON.stringify(result)).toContain("unknown");
  });

  it("caps the number of object keys", () => {
    const bigObject: Record<string, number> = {};
    for (let i = 0; i < 200; i += 1) bigObject[`key${i}`] = i;
    const result = inferSchema(bigObject);
    expect(result).toMatchObject({ type: "object" });
    if (typeof result === "object" && result.type === "object") {
      expect(Object.keys(result.properties).length).toBeLessThanOrEqual(50);
    }
  });
});

function makeRecord(overrides: Partial<CapturedNetworkRequest>): CapturedNetworkRequest {
  return {
    url: "https://example.com/api/products",
    method: "GET",
    status: 200,
    resourceType: "fetch",
    requestHeaders: {},
    responseHeaders: { "content-type": "application/json" },
    queryParams: {},
    requestBody: null,
    responseBody: JSON.stringify({ id: 1, name: "Widget" }),
    redacted: false,
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("summarizeApiRequests", () => {
  it("summarizes a fetch/xhr request with inferred response schema", () => {
    const result = summarizeApiRequests([makeRecord({})]);
    expect(result).toHaveLength(1);
    expect(result[0]?.endpoint).toBe("/api/products");
    expect(result[0]?.responseSchema).toEqual({
      type: "object",
      properties: { id: "number", name: "string" },
    });
  });

  it("ignores non-API resource types (images, stylesheets, etc.)", () => {
    const result = summarizeApiRequests([makeRecord({ resourceType: "image" })]);
    expect(result).toEqual([]);
  });

  it("dedupes multiple calls to the same method+endpoint", () => {
    const result = summarizeApiRequests([makeRecord({}), makeRecord({})]);
    expect(result).toHaveLength(1);
  });

  it("never includes raw response values in the summary", () => {
    const result = summarizeApiRequests([makeRecord({})]);
    expect(JSON.stringify(result)).not.toContain("Widget");
  });

  it("handles malformed JSON bodies without throwing", () => {
    const result = summarizeApiRequests([makeRecord({ responseBody: "not json" })]);
    expect(result[0]?.responseSchema).toBeUndefined();
  });
});
