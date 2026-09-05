import type { Page, Request } from "playwright";
import type { ResourceType } from "@webrecon/types";
import { redactNetworkRequest } from "@webrecon/security";
import { createLogger } from "@webrecon/logger";
import { classifyResourceType } from "./resource-classifier.js";

const logger = createLogger({ name: "network-capture" });

export interface CapturedNetworkRequest {
  url: string;
  method: string;
  status?: number;
  resourceType: ResourceType;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  queryParams: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  durationMs?: number;
  redacted: boolean;
  capturedAt: string;
}

const TEXTUAL_CONTENT_TYPE_PATTERN =
  /^(application\/(json|xml|javascript|x-www-form-urlencoded)|text\/)/i;
const MAX_BODY_BYTES = 200_000; // 200KB — defends against oversized-response capture (Section 37)

function isTextualContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return TEXTUAL_CONTENT_TYPE_PATTERN.test(contentType);
}

function extractQueryParams(url: string): Record<string, string> {
  try {
    const params: Record<string, string> = {};
    new URL(url).searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

/**
 * Attaches to a single Page's network events and accumulates redacted
 * request/response records in memory. One instance per page/session — call
 * `getRecords()` whenever you need a snapshot, `clear()` to reset between
 * navigations if desired.
 */
export class NetworkCapture {
  private readonly records: CapturedNetworkRequest[] = [];
  private readonly startTimes = new WeakMap<Request, number>();

  attach(page: Page): void {
    page.on("request", (request) => {
      this.startTimes.set(request, Date.now());
    });

    page.on("requestfinished", (request) => {
      void this.handleFinished(request);
    });

    page.on("requestfailed", (request) => {
      this.handleFailed(request);
    });
  }

  private async handleFinished(request: Request): Promise<void> {
    try {
      const response = await request.response();
      const startedAt = this.startTimes.get(request);
      const durationMs = startedAt ? Date.now() - startedAt : undefined;

      const requestHeaders = await request.allHeaders();
      const responseHeaders = response ? await response.allHeaders() : {};
      const contentType = responseHeaders["content-type"];

      let responseBody: string | null = null;
      if (response && isTextualContentType(contentType)) {
        try {
          const buffer = await response.body();
          if (buffer.byteLength <= MAX_BODY_BYTES) {
            responseBody = buffer.toString("utf-8");
          }
        } catch {
          // Body may be unavailable (redirects, already-consumed streams, etc.) — skip silently.
        }
      }

      const rawRequestBody = request.postData();
      const requestBody =
        rawRequestBody && rawRequestBody.length <= MAX_BODY_BYTES ? rawRequestBody : null;

      const redactedResult = redactNetworkRequest({
        requestHeaders,
        responseHeaders,
        queryParams: extractQueryParams(request.url()),
        requestBody,
        responseBody,
      });

      this.records.push({
        url: request.url(),
        method: request.method(),
        status: response?.status(),
        resourceType: classifyResourceType(request.resourceType()),
        ...redactedResult,
        durationMs,
        capturedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn({ url: request.url(), error }, "failed to capture finished request");
    }
  }

  private handleFailed(request: Request): void {
    const startedAt = this.startTimes.get(request);
    const durationMs = startedAt ? Date.now() - startedAt : undefined;

    this.records.push({
      url: request.url(),
      method: request.method(),
      status: undefined,
      resourceType: classifyResourceType(request.resourceType()),
      requestHeaders: {},
      responseHeaders: {},
      queryParams: extractQueryParams(request.url()),
      requestBody: null,
      responseBody: null,
      durationMs,
      redacted: false,
      capturedAt: new Date().toISOString(),
    });
  }

  getRecords(): CapturedNetworkRequest[] {
    return [...this.records];
  }

  clear(): void {
    this.records.length = 0;
  }
}
