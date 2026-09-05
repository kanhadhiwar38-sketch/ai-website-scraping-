import { describe, expect, it } from "vitest";
import { withTimeout, JobTimeoutError } from "../timeout.js";

describe("withTimeout", () => {
  it("resolves normally when work finishes before the timeout", async () => {
    const result = await withTimeout(Promise.resolve("done"), 1000);
    expect(result).toBe("done");
  });

  it("rejects with JobTimeoutError when work takes too long", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 20)).rejects.toBeInstanceOf(JobTimeoutError);
  });

  it("propagates the original rejection if work fails before the timeout", async () => {
    const failing = Promise.reject(new Error("boom"));
    await expect(withTimeout(failing, 1000)).rejects.toThrow("boom");
  });
});
