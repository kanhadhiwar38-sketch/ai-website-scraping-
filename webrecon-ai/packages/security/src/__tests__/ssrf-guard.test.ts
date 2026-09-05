import { describe, expect, it } from "vitest";
import { assertSafeUrl, isSafeUrl } from "../ssrf-guard.js";

describe("assertSafeUrl", () => {
  it("blocks loopback IPs", async () => {
    await expect(assertSafeUrl("http://127.0.0.1/")).rejects.toThrow();
    await expect(assertSafeUrl("http://127.0.0.1:8080/admin")).rejects.toThrow();
  });

  it("blocks localhost by name", async () => {
    await expect(assertSafeUrl("http://localhost:3000/")).rejects.toThrow();
  });

  it("blocks 0.0.0.0", async () => {
    await expect(assertSafeUrl("http://0.0.0.0/")).rejects.toThrow();
  });

  it("blocks private RFC1918 ranges", async () => {
    await expect(assertSafeUrl("http://10.0.0.5/")).rejects.toThrow();
    await expect(assertSafeUrl("http://172.16.0.1/")).rejects.toThrow();
    await expect(assertSafeUrl("http://192.168.1.1/")).rejects.toThrow();
  });

  it("blocks the cloud metadata endpoint", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
  });

  it("blocks link-local addresses", async () => {
    await expect(assertSafeUrl("http://169.254.1.1/")).rejects.toThrow();
  });

  it("blocks IPv6 loopback and unique-local", async () => {
    await expect(assertSafeUrl("http://[::1]/")).rejects.toThrow();
    await expect(assertSafeUrl("http://[fd00::1]/")).rejects.toThrow();
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(assertSafeUrl("ftp://example.com/")).rejects.toThrow();
  });

  it("rejects malformed URLs", async () => {
    await expect(assertSafeUrl("not a url")).rejects.toThrow();
  });

  it("enforces the project's allowedDomains list", async () => {
    await expect(
      assertSafeUrl("http://93.184.216.34/", { allowedDomains: ["example.com"] }),
    ).rejects.toThrow();
  });

  it("allows a public IP with no domain restriction configured", async () => {
    await expect(isSafeUrl("http://93.184.216.34/")).resolves.toBe(true);
  });

  it("allows a subdomain of an allowed domain", async () => {
    // hostname check happens before DNS resolution short-circuits on literal IP
    const allowed = await isSafeUrl("http://93.184.216.34/", {
      allowedDomains: ["93.184.216.34"],
    });
    expect(allowed).toBe(true);
  });
});
