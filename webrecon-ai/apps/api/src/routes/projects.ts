import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Asset, CreateProjectInput, NetworkRequest, Page, Project, Screenshot } from "@webrecon/types";
import { NotFoundError, ForbiddenError, generateId, nowIso } from "@webrecon/shared";
import { assertSafeUrl } from "@webrecon/security";
import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";
import { enqueueJob } from "@webrecon/jobs";

const ProjectIdParams = z.object({ id: z.string().min(1) });
const ProjectPageParams = z.object({ id: z.string().min(1), pageId: z.string().min(1) });

export default async function projectRoutes(app: FastifyInstance) {
  const db = getFirebaseAdminFirestore;

  async function requireOwnedProject(id: string, userId: string): Promise<Project> {
    const doc = await db().collection(COLLECTIONS.projects).doc(id).get();
    if (!doc.exists) throw new NotFoundError("Project not found");
    const project = Project.parse(doc.data());
    if (project.userId !== userId) throw new ForbiddenError();
    return project;
  }

  app.post("/projects", async (request, reply) => {
    const userId = request.requireUserId();
    const input = CreateProjectInput.parse(request.body);

    // SSRF / domain safety check happens at creation time AND again at
    // crawl time (packages/security is re-checked by the crawler in a
    // later phase) — DNS can change between the two.
    await assertSafeUrl(input.url);

    const hostname = new URL(input.url).hostname;
    const now = nowIso();
    const project: Project = {
      id: generateId("project"),
      userId,
      url: input.url,
      allowedDomains: [hostname],
      status: "created",
      options: {
        maxPages: input.options?.maxPages ?? 50,
        maxDepth: input.options?.maxDepth ?? 3,
        autoScroll: input.options?.autoScroll ?? true,
        screenshots: input.options?.screenshots ?? true,
        networkInspection: input.options?.networkInspection ?? true,
        assetDiscovery: input.options?.assetDiscovery ?? true,
        responsiveInspection: input.options?.responsiveInspection ?? true,
        aiAnalysis: input.options?.aiAnalysis ?? true,
      },
      pagesScanned: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db().collection(COLLECTIONS.projects).doc(project.id).set(project);

    return reply.status(201).send(project);
  });

  app.get("/projects", async (request) => {
    const userId = request.requireUserId();
    const snapshot = await db()
      .collection(COLLECTIONS.projects)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const projects = snapshot.docs.map((doc) => Project.parse(doc.data()));
    return { projects };
  });

  app.get("/projects/:id", async (request) => {
    const userId = request.requireUserId();
    const { id } = ProjectIdParams.parse(request.params);
    return requireOwnedProject(id, userId);
  });

  app.delete("/projects/:id", async (request, reply) => {
    const userId = request.requireUserId();
    const { id } = ProjectIdParams.parse(request.params);
    await requireOwnedProject(id, userId);

    await db().collection(COLLECTIONS.projects).doc(id).delete();
    return reply.status(204).send();
  });

  // ---------------------------------------------------------------------
  // Kick off analysis (spec Section 35/36 POST /projects/:id/analyze).
  // Enqueues the `crawl` job and returns immediately — no crawling happens
  // inside this request (spec Section 8). The crawl worker chains
  // network-analysis/asset-analysis/screenshot jobs itself once it finishes.
  // ---------------------------------------------------------------------

  app.post("/projects/:id/analyze", async (request, reply) => {
    const userId = request.requireUserId();
    const { id } = ProjectIdParams.parse(request.params);
    const project = await requireOwnedProject(id, userId);

    const job = await enqueueJob("crawl", userId, project.id, { userId, projectId: project.id });

    await db()
      .collection(COLLECTIONS.projects)
      .doc(project.id)
      .set({ status: "analyzing", updatedAt: nowIso() }, { merge: true });

    return reply.status(202).send({ jobId: job.id, status: "queued" });
  });

  // ---------------------------------------------------------------------
  // Crawled pages (spec Section 36 GET /projects/:id/pages, Section 13
  // HTML/DOM inspection surfaced over the crawl archive rather than a live
  // session). Populated once the Phase 7 BullMQ `crawl` queue runs
  // packages/crawler against this project.
  // ---------------------------------------------------------------------

  app.get("/projects/:id/pages", async (request) => {
    const userId = request.requireUserId();
    const { id } = ProjectIdParams.parse(request.params);
    await requireOwnedProject(id, userId);

    const snapshot = await db()
      .collection(COLLECTIONS.pages)
      .where("projectId", "==", id)
      .orderBy("discoveredAt", "asc")
      .get();

    // Lightweight list view: omit the (potentially large) html/elements
    // payload here; fetch a single page's full detail via the route below.
    const pages = snapshot.docs.map((doc) => {
      const page = Page.parse(doc.data());
      const { html: _html, elements: _elements, ...summary } = page;
      return summary;
    });

    return { pages };
  });

  app.get("/projects/:id/pages/:pageId", async (request) => {
    const userId = request.requireUserId();
    const { id, pageId } = ProjectPageParams.parse(request.params);
    await requireOwnedProject(id, userId);

    const doc = await db().collection(COLLECTIONS.pages).doc(pageId).get();
    if (!doc.exists) throw new NotFoundError("Page not found");

    const page = Page.parse(doc.data());
    if (page.projectId !== id) throw new NotFoundError("Page not found");

    return page;
  });

  // ---------------------------------------------------------------------
  // Network requests captured during the crawl (spec Section 36
  // GET /projects/:id/network). Secrets are already redacted at capture
  // time (packages/security) — this route does no further sanitization.
  // ---------------------------------------------------------------------

  app.get("/projects/:id/network", async (request) => {
    const userId = request.requireUserId();
    const { id } = ProjectIdParams.parse(request.params);
    await requireOwnedProject(id, userId);

    const snapshot = await db()
      .collection(COLLECTIONS.networkRequests)
      .where("projectId", "==", id)
      .orderBy("capturedAt", "desc")
      .limit(500)
      .get();

    const requests = snapshot.docs.map((doc) => NetworkRequest.parse(doc.data()));
    return { requests };
  });

  // ---------------------------------------------------------------------
  // Assets discovered during the crawl (spec Section 36 GET
  // /projects/:id/assets). Populated by packages/asset-analyzer, one batch
  // per crawled page.
  // ---------------------------------------------------------------------

  app.get("/projects/:id/assets", async (request) => {
    const userId = request.requireUserId();
    const { id } = ProjectIdParams.parse(request.params);
    await requireOwnedProject(id, userId);

    const snapshot = await db()
      .collection(COLLECTIONS.assets)
      .where("projectId", "==", id)
      .orderBy("discoveredAt", "desc")
      .limit(500)
      .get();

    const assets = snapshot.docs.map((doc) => Asset.parse(doc.data()));
    return { assets };
  });

  // ---------------------------------------------------------------------
  // Screenshots captured during the crawl (spec Section 36 GET
  // /projects/:id/screenshots). Returns metadata + storage paths only —
  // binary bytes live in Firebase Storage (see packages/screenshot-engine).
  // ---------------------------------------------------------------------

  app.get("/projects/:id/screenshots", async (request) => {
    const userId = request.requireUserId();
    const { id } = ProjectIdParams.parse(request.params);
    await requireOwnedProject(id, userId);

    const snapshot = await db()
      .collection(COLLECTIONS.screenshots)
      .where("projectId", "==", id)
      .orderBy("capturedAt", "desc")
      .limit(500)
      .get();

    const screenshots = snapshot.docs.map((doc) => Screenshot.parse(doc.data()));
    return { screenshots };
  });
}
