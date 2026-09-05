import type { Page } from "playwright";

export interface ExtractedLink {
  href: string;
  text: string;
}

/** Pulls every `<a href>` on the page as raw (possibly relative) hrefs + link text. */
export async function extractLinks(page: Page): Promise<ExtractedLink[]> {
  return page.$$eval("a[href]", (anchors) =>
    anchors.map((anchor) => ({
      href: anchor.getAttribute("href") ?? "",
      text: anchor.textContent?.trim() ?? "",
    })),
  );
}
