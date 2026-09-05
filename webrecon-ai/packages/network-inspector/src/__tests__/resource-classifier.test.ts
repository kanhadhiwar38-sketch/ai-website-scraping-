import { describe, expect, it } from "vitest";
import { classifyResourceType } from "../resource-classifier.js";

describe("classifyResourceType", () => {
  it("passes through known types unchanged", () => {
    for (const type of ["document", "stylesheet", "script", "image", "font", "fetch", "xhr", "websocket", "media"]) {
      expect(classifyResourceType(type)).toBe(type);
    }
  });

  it("folds unknown types into 'other'", () => {
    expect(classifyResourceType("manifest")).toBe("other");
    expect(classifyResourceType("eventsource")).toBe("other");
    expect(classifyResourceType("texttrack")).toBe("other");
  });
});
