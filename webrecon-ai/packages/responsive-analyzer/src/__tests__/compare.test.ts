import { describe, expect, it } from "vitest";
import type { ResponsiveElementState, ResponsiveViewportSnapshot } from "@webrecon/types";
import { compareResponsiveSnapshots } from "../compare.js";

function el(overrides: Partial<ResponsiveElementState>): ResponsiveElementState {
  return {
    selector: "#el",
    tag: "div",
    visible: true,
    boundingBox: { x: 0, y: 0, width: 100, height: 50 },
    ...overrides,
  };
}

function snapshot(overrides: Partial<ResponsiveViewportSnapshot>): ResponsiveViewportSnapshot {
  return {
    viewport: "desktop",
    width: 1440,
    height: 900,
    documentHeight: 2000,
    elements: [],
    ...overrides,
  };
}

describe("compareResponsiveSnapshots", () => {
  it("flags an element hidden at a narrower viewport", () => {
    const desktop = snapshot({
      viewport: "desktop",
      elements: [el({ selector: "#sidebar", visible: true })],
    });
    const mobile = snapshot({
      viewport: "mobile",
      elements: [el({ selector: "#sidebar", visible: false })],
    });

    const { differences } = compareResponsiveSnapshots([desktop, mobile]);
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({ selector: "#sidebar", kind: "hidden" });
  });

  it("flags an element shown only at a narrower viewport", () => {
    const desktop = snapshot({
      viewport: "desktop",
      elements: [el({ selector: "#hamburger", visible: false })],
    });
    const mobile = snapshot({
      viewport: "mobile",
      elements: [el({ selector: "#hamburger", visible: true })],
    });

    const { differences } = compareResponsiveSnapshots([desktop, mobile]);
    expect(differences[0]).toMatchObject({ kind: "shown" });
  });

  it("flags a meaningful width/height change as resized", () => {
    const desktop = snapshot({
      viewport: "desktop",
      elements: [el({ selector: "#card", boundingBox: { x: 0, y: 0, width: 300, height: 200 } })],
    });
    const tablet = snapshot({
      viewport: "tablet",
      elements: [el({ selector: "#card", boundingBox: { x: 0, y: 0, width: 700, height: 200 } })],
    });

    const { differences } = compareResponsiveSnapshots([desktop, tablet]);
    expect(differences).toHaveLength(1);
    expect(differences[0]?.kind).toBe("resized");
  });

  it("ignores sub-threshold size changes (rounding noise)", () => {
    const desktop = snapshot({
      viewport: "desktop",
      elements: [el({ selector: "#card", boundingBox: { x: 0, y: 0, width: 300, height: 200 } })],
    });
    const tablet = snapshot({
      viewport: "tablet",
      elements: [el({ selector: "#card", boundingBox: { x: 0, y: 0, width: 302, height: 200 } })],
    });

    const { differences } = compareResponsiveSnapshots([desktop, tablet]);
    expect(differences).toEqual([]);
  });

  it("produces no differences for identical elements across viewports", () => {
    const shared = [el({ selector: "#same" })];
    const { differences, breakpoints } = compareResponsiveSnapshots([
      snapshot({ viewport: "desktop", elements: shared }),
      snapshot({ viewport: "tablet", elements: shared }),
    ]);
    expect(differences).toEqual([]);
    expect(breakpoints).toEqual([]);
  });

  it("records a navigation variant change as a difference", () => {
    const desktop = snapshot({ viewport: "desktop", navigationVariant: "horizontal-nav" });
    const mobile = snapshot({ viewport: "mobile", navigationVariant: "hamburger-menu" });

    const { differences } = compareResponsiveSnapshots([desktop, mobile]);
    expect(differences.some((d) => d.selector === "nav" && d.kind === "reflowed")).toBe(true);
  });

  it("records one approximate breakpoint per viewport pair with changes", () => {
    const desktop = snapshot({
      viewport: "desktop",
      elements: [el({ selector: "#sidebar", visible: true })],
    });
    const tablet = snapshot({
      viewport: "tablet",
      elements: [el({ selector: "#sidebar", visible: true })],
    });
    const mobile = snapshot({
      viewport: "mobile",
      elements: [el({ selector: "#sidebar", visible: false })],
    });

    const { breakpoints } = compareResponsiveSnapshots([desktop, tablet, mobile]);
    expect(breakpoints).toHaveLength(1);
    expect(breakpoints[0]?.betweenViewports).toEqual(["tablet", "mobile"]);
  });
});
