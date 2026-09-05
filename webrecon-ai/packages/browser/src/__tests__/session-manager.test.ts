import { describe, expect, it } from "vitest";
import { BrowserSessionManager, VIEWPORT_PRESETS, getBrowserSessionManager } from "../index.js";

describe("VIEWPORT_PRESETS", () => {
  it("matches spec Section 18 dimensions", () => {
    expect(VIEWPORT_PRESETS.desktop).toEqual({ width: 1440, height: 900 });
    expect(VIEWPORT_PRESETS.tablet).toEqual({ width: 768, height: 1024 });
    expect(VIEWPORT_PRESETS.mobile).toEqual({ width: 390, height: 844 });
  });
});

describe("getBrowserSessionManager", () => {
  it("returns a process-wide singleton", () => {
    expect(getBrowserSessionManager()).toBe(getBrowserSessionManager());
  });
});

describe("BrowserSessionManager error paths (no browser launch required)", () => {
  const manager = new BrowserSessionManager();

  it("throws NotFoundError for an unknown session on navigate", async () => {
    await expect(manager.navigate("session_does_not_exist", "https://example.com")).rejects.toThrow(
      /not found/i,
    );
  });

  it("throws NotFoundError for an unknown session on screenshot", async () => {
    await expect(manager.screenshot("session_does_not_exist")).rejects.toThrow(/not found/i);
  });

  it("throws NotFoundError for an unknown session on getSessionInfo", () => {
    expect(() => manager.getSessionInfo("session_does_not_exist")).toThrow(/not found/i);
  });

  it("close() on an unknown session is a no-op, not an error", async () => {
    await expect(manager.close("session_does_not_exist")).resolves.toBeUndefined();
  });

  it("lists no active sessions initially", () => {
    expect(manager.listActiveSessionIds()).toEqual([]);
  });
});
