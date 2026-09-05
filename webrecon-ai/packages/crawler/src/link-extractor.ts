export interface ExtractedLink {
  href: string;
  text: string;
}

const SKIPPED_SCHEMES = ["mailto:", "tel:", "javascript:", "data:", "blob:"];

/**
 * Resolves raw hrefs against the page's URL, strips fragments, dedupes, and
 * keeps only links that fall within `allowedDomains` — schemes like
 * mailto/tel/javascript are dropped outright (spec Section 10/38: "only
 * visit allowed pages", "do not blindly follow external links").
 *
 * This is pure string/URL logic with no browser dependency, so it can be
 * unit tested without a Chromium binary.
 */
export function resolveInternalLinks(
  baseUrl: string,
  links: ExtractedLink[],
  allowedDomains: string[],
): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const link of links) {
    const raw = link.href.trim();
    if (!raw || SKIPPED_SCHEMES.some((scheme) => raw.toLowerCase().startsWith(scheme))) {
      continue;
    }

    let absolute: URL;
    try {
      absolute = new URL(raw, baseUrl);
    } catch {
      continue;
    }

    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") continue;

    const hostname = absolute.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(
      (domain) => hostname === domain.toLowerCase() || hostname.endsWith(`.${domain.toLowerCase()}`),
    );
    if (!isAllowed) continue;

    absolute.hash = "";
    const normalized = absolute.toString();

    if (seen.has(normalized)) continue;
    seen.add(normalized);
    resolved.push(normalized);
  }

  return resolved;
}
