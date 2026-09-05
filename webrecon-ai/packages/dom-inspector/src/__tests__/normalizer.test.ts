import { describe, expect, it } from "vitest";
import type { DomElement } from "@webrecon/types";
import { normalizeElements } from "../normalizer.js";

function makeElement(overrides: Partial<DomElement> = {}): DomElement {
  return {
    tag: "div",
    classes: [],
    attributes: {},
    selector: `div-${Math.random()}`,
    ...overrides,
  };
}

describe("normalizeElements", () => {
  it("dedupes elements with the same selector", () => {
    const el = makeElement({ selector: "#same" });
    const result = normalizeElements([el, { ...el }, { ...el }]);
    expect(result).toHaveLength(1);
  });

  it("truncates long text content", () => {
    const longText = "a".repeat(500);
    const result = normalizeElements([makeElement({ text: longText })], { maxTextLength: 50 });
    expect(result[0]?.text).toHaveLength(50);
  });

  it("leaves short text untouched", () => {
    const result = normalizeElements([makeElement({ text: "hello" })], { maxTextLength: 50 });
    expect(result[0]?.text).toBe("hello");
  });

  it("caps the total element count", () => {
    const elements = Array.from({ length: 10 }, (_, i) => makeElement({ selector: `#el-${i}` }));
    const result = normalizeElements(elements, { maxElements: 3 });
    expect(result).toHaveLength(3);
  });

  it("preserves elements with no text", () => {
    const result = normalizeElements([makeElement({ text: undefined })]);
    expect(result[0]?.text).toBeUndefined();
  });

  it("applies default limits when no options are passed", () => {
    const elements = Array.from({ length: 400 }, (_, i) => makeElement({ selector: `#el-${i}` }));
    const result = normalizeElements(elements);
    expect(result.length).toBeLessThanOrEqual(300);
  });
});
