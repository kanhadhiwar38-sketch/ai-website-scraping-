import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { SecurityViolationError } from "@webrecon/shared";

/**
 * Blocks navigation/fetches to loopback, private, link-local, and cloud
 * metadata addresses. This is the primary SSRF defense (spec Section 37)
 * and MUST run at request time — not just at project-creation time —
 * because DNS answers can change between validation and use (DNS
 * rebinding). Every call site (crawler navigation, browser-worker fetches,
 * network-inspector) should call `assertSafeUrl` immediately before use.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
]);

// Cloud metadata endpoints, checked as literal IPs regardless of DNS result.
const BLOCKED_IPS = new Set([
  "169.254.169.254", // AWS / GCP / Azure metadata
  "169.254.170.2", // AWS ECS task metadata
  "fd00:ec2::254", // AWS IPv6 metadata
]);

function ipv4ToLong(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0;
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number.parseInt(bitsStr ?? "32", 10);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToLong(ip) & mask) === (ipv4ToLong(range as string) & mask);
}

const BLOCKED_IPV4_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10", // carrier-grade NAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local + cloud metadata
  "172.16.0.0/12",
  "192.0.0.0/24", // IETF protocol assignments
  "192.168.0.0/16",
  "198.18.0.0/15", // benchmarking
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
];

function isBlockedIpv4(ip: string): boolean {
  if (BLOCKED_IPS.has(ip)) return true;
  return BLOCKED_IPV4_RANGES.some((cidr) => isIpv4InCidr(ip, cidr));
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (BLOCKED_IPS.has(normalized)) return true;
  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  if (normalized.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — unwrap and check the IPv4 rules too.
    const mapped = normalized.replace("::ffff:", "");
    if (isIP(mapped) === 4) return isBlockedIpv4(mapped);
  }
  return false;
}

export interface AssertSafeUrlOptions {
  /** Domains this project is allowed to touch (spec Section 38). */
  allowedDomains?: string[];
}

/**
 * Throws SecurityViolationError if the URL resolves to a blocked address or
 * falls outside the project's allowed domains. Resolves the hostname itself
 * (does not trust a pre-resolved IP) so DNS rebinding between check and use
 * is the caller's remaining responsibility — call this immediately before
 * each navigation/fetch, and re-call it after every redirect hop.
 */
export async function assertSafeUrl(
  rawUrl: string,
  options: AssertSafeUrlOptions = {},
): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SecurityViolationError("Malformed URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SecurityViolationError(`Protocol not allowed: ${url.protocol}`);
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new SecurityViolationError(`Host not allowed: ${hostname}`);
  }

  if (options.allowedDomains && options.allowedDomains.length > 0) {
    const allowed = options.allowedDomains.some(
      (domain) => hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`),
    );
    if (!allowed) {
      throw new SecurityViolationError(
        `Domain "${hostname}" is not in this project's allowed domains`,
      );
    }
  }

  // If the hostname is already a literal IP, check it directly.
  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isBlockedIpv4(hostname)) {
    throw new SecurityViolationError(`IP address not allowed: ${hostname}`);
  }
  if (ipVersion === 6 && isBlockedIpv6(hostname)) {
    throw new SecurityViolationError(`IP address not allowed: ${hostname}`);
  }

  // Otherwise resolve DNS and check every returned address (A + AAAA).
  if (ipVersion === 0) {
    let records: { address: string; family: number }[];
    try {
      records = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new SecurityViolationError(`Could not resolve host: ${hostname}`);
    }

    if (records.length === 0) {
      throw new SecurityViolationError(`Host did not resolve: ${hostname}`);
    }

    for (const record of records) {
      const blocked =
        record.family === 4 ? isBlockedIpv4(record.address) : isBlockedIpv6(record.address);
      if (blocked) {
        throw new SecurityViolationError(
          `Host "${hostname}" resolves to a disallowed address`,
        );
      }
    }
  }
}

/**
 * Non-throwing variant for call sites (e.g. UI form validation) that just
 * want a boolean rather than a caught exception.
 */
export async function isSafeUrl(
  rawUrl: string,
  options: AssertSafeUrlOptions = {},
): Promise<boolean> {
  try {
    await assertSafeUrl(rawUrl, options);
    return true;
  } catch {
    return false;
  }
}
