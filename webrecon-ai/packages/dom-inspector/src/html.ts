import type { Page } from "playwright";

/**
 * Returns the browser's rendered HTML (post-JS DOM serialization), i.e.
 * exactly what the browser has, not the server's original response body
 * and never server-side template/source files. This is the only kind of
 * "HTML inspection" this platform performs (spec Section 13).
 */
export async function extractRenderedHtml(page: Page): Promise<string> {
  return page.content();
}
