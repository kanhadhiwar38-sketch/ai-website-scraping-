export interface WebReconApiClientOptions {
  baseUrl: string;
  apiKey: string;
}

export class WebReconApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "WebReconApiError";
  }
}

/**
 * Every method here is a thin wrapper around one WebRecon REST endpoint —
 * deliberately dumb. All real validation, ownership checks, and business
 * logic live in apps/api; this client (and therefore the MCP server built
 * on it) never bypasses that surface, it only calls into it (spec Section
 * 32: "Claude Code -> MCP -> WebRecon AI -> Browser -> Website").
 */
export class WebReconApiClient {
  constructor(private readonly options: WebReconApiClientOptions) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.options.apiKey}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string; code?: string } }
        | null;
      throw new WebReconApiError(
        body?.error?.message ?? response.statusText,
        response.status,
        body?.error?.code ?? "UNKNOWN_ERROR",
      );
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  // ---------------------------------------------------------------------
  // Browser tools (spec Section 31)
  // ---------------------------------------------------------------------

  browserCreateSession(input: { projectId: string; viewport?: "desktop" | "tablet" | "mobile" }) {
    return this.request("/browser/session", { method: "POST", body: JSON.stringify(input) });
  }

  browserNavigate(sessionId: string, url: string) {
    return this.request(`/browser/session/${sessionId}/navigate`, {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }

  browserGetPageInfo(sessionId: string) {
    return this.request(`/browser/session/${sessionId}`);
  }

  browserGetDom(sessionId: string) {
    return this.request(`/browser/session/${sessionId}/dom`);
  }

  browserGetHtml(sessionId: string) {
    return this.request(`/browser/session/${sessionId}/html`);
  }

  browserGetNetwork(sessionId: string) {
    return this.request(`/browser/session/${sessionId}/network`);
  }

  browserGetApiSummary(sessionId: string) {
    return this.request(`/browser/session/${sessionId}/api-summary`);
  }

  browserGetAssets(sessionId: string) {
    return this.request(`/browser/session/${sessionId}/assets`);
  }

  browserScreenshot(sessionId: string, fullPage = false) {
    return this.request(`/browser/session/${sessionId}/screenshot`, {
      method: "POST",
      body: JSON.stringify({ fullPage }),
    });
  }

  browserScroll(sessionId: string, deltaY = 800) {
    return this.request(`/browser/session/${sessionId}/scroll`, {
      method: "POST",
      body: JSON.stringify({ deltaY }),
    });
  }

  browserClick(sessionId: string, selector: string) {
    return this.request(`/browser/session/${sessionId}/click`, {
      method: "POST",
      body: JSON.stringify({ selector }),
    });
  }

  browserType(sessionId: string, selector: string, text: string) {
    return this.request(`/browser/session/${sessionId}/type`, {
      method: "POST",
      body: JSON.stringify({ selector, text }),
    });
  }

  browserGetLinks(sessionId: string) {
    return this.request(`/browser/session/${sessionId}/links`);
  }

  browserAnalyzePage(sessionId: string) {
    return this.request(`/browser/session/${sessionId}/analyze`);
  }

  browserCloseSession(sessionId: string) {
    return this.request(`/browser/session/${sessionId}`, { method: "DELETE" });
  }

  // ---------------------------------------------------------------------
  // Project tools (spec Section 31)
  // ---------------------------------------------------------------------

  projectCreate(input: { url: string; options?: Record<string, unknown> }) {
    return this.request("/projects", { method: "POST", body: JSON.stringify(input) });
  }

  projectGetStatus(projectId: string) {
    return this.request(`/projects/${projectId}`);
  }

  projectGetAnalysis(projectId: string) {
    return this.request(`/projects/${projectId}/analysis`);
  }

  projectGetScreenshots(projectId: string) {
    return this.request(`/projects/${projectId}/screenshots`);
  }

  projectGetAssets(projectId: string) {
    return this.request(`/projects/${projectId}/assets`);
  }

  projectGetNetworkReport(projectId: string) {
    return this.request(`/projects/${projectId}/reports/network`);
  }

  projectGetImplementationPlan(projectId: string) {
    return this.request(`/projects/${projectId}/implementation-plan`);
  }
}
