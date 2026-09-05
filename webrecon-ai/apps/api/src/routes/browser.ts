import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Project } from "@webrecon/types";
import { ForbiddenError, NotFoundError } from "@webrecon/shared";
import { getBrowserSessionManager, VIEWPORT_PRESETS } from "@webrecon/browser";
import { getFirebaseAdminFirestore } from "@webrecon/firebase/admin";
import { COLLECTIONS } from "@webrecon/firebase";

const SessionIdParams = z.object({ id: z.string().min(1) });

const CreateSessionBody = z.object({
  projectId: z.string().min(1),
  viewport: z.enum(["desktop", "tablet", "mobile"]).optional(),
});

const NavigateBody = z.object({ url: z.string().url() });
const ClickBody = z.object({ selector: z.string().min(1) });
const TypeBody = z.object({ selector: z.string().min(1), text: z.string() });
const ScrollBody = z.object({ deltaY: z.number().default(800) });
const ScreenshotBody = z.object({ fullPage: z.boolean().default(false) });

export default async function browserRoutes(app: FastifyInstance) {
  const manager = getBrowserSessionManager();
  const db = getFirebaseAdminFirestore;

  /** Ensures the session exists AND belongs to the requesting user. */
  function requireOwnedSession(sessionId: string, userId: string) {
    const info = manager.getSessionInfo(sessionId);
    if (info.userId !== userId) throw new ForbiddenError();
    return info;
  }

  app.post("/browser/session", async (request, reply) => {
    const userId = request.requireUserId();
    const input = CreateSessionBody.parse(request.body);

    const projectDoc = await db().collection(COLLECTIONS.projects).doc(input.projectId).get();
    if (!projectDoc.exists) throw new NotFoundError("Project not found");
    const project = Project.parse(projectDoc.data());
    if (project.userId !== userId) throw new ForbiddenError();

    const session = await manager.create({
      userId,
      projectId: project.id,
      allowedDomains: project.allowedDomains,
      viewport: VIEWPORT_PRESETS[input.viewport ?? "desktop"],
      maxSessionTimeMs: Number(process.env.MAX_BROWSER_TIME ?? 180_000),
    });

    return reply.status(201).send(session);
  });

  app.get("/browser/session/:id", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    const session = requireOwnedSession(id, userId);
    const pageInfo = await manager.getPageInfo(id);
    return { ...session, ...pageInfo };
  });

  app.get("/browser/session/:id/html", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const html = await manager.getHtml(id);
    return { html };
  });

  app.get("/browser/session/:id/dom", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    return manager.getDom(id);
  });

  app.get("/browser/session/:id/styles", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const { styles } = await manager.getDom(id);
    return { styles };
  });

  app.get("/browser/session/:id/scripts", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const { scripts } = await manager.getDom(id);
    return { scripts };
  });

  app.get("/browser/session/:id/links", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const links = await manager.getLinks(id);
    return { links };
  });

  app.get("/browser/session/:id/network", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    return { requests: manager.getNetworkRequests(id) };
  });

  app.get("/browser/session/:id/api-summary", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    return { apiSummary: manager.getApiSummary(id) };
  });

  app.post("/browser/session/:id/navigate", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const { url } = NavigateBody.parse(request.body);
    return manager.navigate(id, url);
  });

  app.post("/browser/session/:id/reload", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    return manager.reload(id);
  });

  app.post("/browser/session/:id/back", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    return manager.back(id);
  });

  app.post("/browser/session/:id/forward", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    return manager.forward(id);
  });

  app.post("/browser/session/:id/click", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const { selector } = ClickBody.parse(request.body);
    return manager.click(id, selector);
  });

  app.post("/browser/session/:id/type", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const { selector, text } = TypeBody.parse(request.body);
    return manager.type(id, selector, text);
  });

  app.post("/browser/session/:id/scroll", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const { deltaY } = ScrollBody.parse(request.body);
    return manager.scroll(id, deltaY);
  });

  app.post("/browser/session/:id/screenshot", async (request) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    const { fullPage } = ScreenshotBody.parse(request.body ?? {});
    const image = await manager.screenshot(id, fullPage);
    return { image, mimeType: "image/png" };
  });

  app.delete("/browser/session/:id", async (request, reply) => {
    const userId = request.requireUserId();
    const { id } = SessionIdParams.parse(request.params);
    requireOwnedSession(id, userId);
    await manager.close(id);
    return reply.status(204).send();
  });
}
