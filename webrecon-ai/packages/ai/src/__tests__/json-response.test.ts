import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonResponse } from "../json-response.js";

const schema = z.object({
  items: z.array(z.string()).default([]),
  name: z.string().optional(),
});

describe("parseJsonResponse", () => {
  it("parses plain JSON", () => {
    const result = parseJsonResponse('{"name":"hi","items":["a","b"]}', schema);
    expect(result).toEqual({ name: "hi", items: ["a", "b"] });
  });

  it("strips a markdown JSON code fence", () => {
    const result = parseJsonResponse('```json\n{"name":"hi","items":[]}\n```', schema);
    expect(result.name).toBe("hi");
  });

  it("strips a plain code fence without a language tag", () => {
    const result = parseJsonResponse('```\n{"name":"hi","items":[]}\n```', schema);
    expect(result.name).toBe("hi");
  });

  it("fills in defaults for missing fields", () => {
    const result = parseJsonResponse("{}", schema);
    expect(result.items).toEqual([]);
  });

  it("throws a ValidationError on malformed JSON", () => {
    expect(() => parseJsonResponse("not json at all", schema)).toThrow(/not valid JSON/);
  });

  it("throws a ValidationError when the shape doesn't match", () => {
    expect(() => parseJsonResponse('{"items": "not-an-array"}', schema)).toThrow(
      /did not match expected shape/,
    );
  });
});
