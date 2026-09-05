import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("unauthenticated browser routes", () => {
  it("rejects POST /browser/session without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/browser/session",
      payload: { projectId: "project_123" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");

    await app.close();
  });

  it("rejects POST /browser/session/:id/navigate without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/browser/session/session_123/navigate",
      payload: { url: "https://example.com" },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });
});
