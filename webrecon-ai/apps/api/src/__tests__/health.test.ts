import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("GET /health", () => {
  it("returns ok status", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("@webrecon/api");

    await app.close();
  });
});

describe("unauthenticated project routes", () => {
  it("rejects POST /projects without a token", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/projects",
      payload: { url: "https://example.com" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");

    await app.close();
  });

  it("returns a 404 envelope for unknown routes", async () => {
    const app = await buildApp({ logger: false });
    const response = await app.inject({ method: "GET", url: "/does-not-exist" });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("NOT_FOUND");

    await app.close();
  });
});
