import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("unauthenticated API key routes", () => {
  it("rejects GET /api-keys without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/api-keys" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects POST /api-keys without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api-keys",
      payload: { label: "test key" },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /mcp/config", () => {
  it("is publicly readable and describes how to connect", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/mcp/config" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.command).toBe("npx");
    expect(body.env.WEBRECON_API_KEY).toContain("api-keys");
    await app.close();
  });
});

describe("unauthenticated project report/analysis routes", () => {
  it("rejects GET /projects/:id/analysis without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/projects/proj_1/analysis" });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects GET /projects/:id/reports/network without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/projects/proj_1/reports/network",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects an unknown report name at the route level", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/projects/proj_1/reports/bogus",
    });
    // Auth is checked first, so this is still 401 rather than a validation
    // error — confirms auth runs before route param validation.
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("unauthenticated browser inspection routes (Phase 11 additions)", () => {
  it("rejects GET /browser/session/:id/assets without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/browser/session/sess_1/assets",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects GET /browser/session/:id/analyze without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/browser/session/sess_1/analyze",
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
