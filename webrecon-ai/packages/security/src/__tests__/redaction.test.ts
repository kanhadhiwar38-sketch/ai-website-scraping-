import { describe, expect, it } from "vitest";
import {
  redactBodyText,
  redactHeaders,
  redactNetworkRequest,
  redactParams,
} from "../redaction.js";

describe("redactHeaders", () => {
  it("redacts Authorization regardless of case", () => {
    const result = redactHeaders({ Authorization: "Bearer abc123", "X-Custom": "keep-me" });
    expect(result.Authorization).toBe("[REDACTED]");
    expect(result["X-Custom"]).toBe("keep-me");
  });

  it("redacts Cookie and Set-Cookie", () => {
    const result = redactHeaders({ cookie: "session=abc", "set-cookie": "id=xyz" });
    expect(result.cookie).toBe("[REDACTED]");
    expect(result["set-cookie"]).toBe("[REDACTED]");
  });
});

describe("redactParams", () => {
  it("redacts token/secret/apiKey-like query params", () => {
    const result = redactParams({ api_key: "sk-123", q: "shoes", session_id: "abc" });
    expect(result.api_key).toBe("[REDACTED]");
    expect(result.session_id).toBe("[REDACTED]");
    expect(result.q).toBe("shoes");
  });
});

describe("redactBodyText", () => {
  it("redacts JWT-shaped tokens embedded in text", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const result = redactBodyText(`{"token":"${jwt}"}`);
    expect(result).not.toContain(jwt);
    expect(result).toContain("[REDACTED]");
  });

  it("redacts Bearer tokens embedded in text", () => {
    const result = redactBodyText("Authorization header was Bearer abcdef123456");
    expect(result).toBe("Authorization header was Bearer [REDACTED]");
  });

  it("passes through null", () => {
    expect(redactBodyText(null)).toBeNull();
  });
});

describe("redactNetworkRequest", () => {
  it("flags redacted=true when anything was changed", () => {
    const result = redactNetworkRequest({
      requestHeaders: { Authorization: "Bearer secret" },
      responseHeaders: {},
      queryParams: {},
      requestBody: null,
      responseBody: null,
    });
    expect(result.redacted).toBe(true);
    expect(result.requestHeaders.Authorization).toBe("[REDACTED]");
  });

  it("flags redacted=false when nothing needed changing", () => {
    const result = redactNetworkRequest({
      requestHeaders: { "content-type": "application/json" },
      responseHeaders: {},
      queryParams: { q: "shoes" },
      requestBody: null,
      responseBody: null,
    });
    expect(result.redacted).toBe(false);
  });
});
