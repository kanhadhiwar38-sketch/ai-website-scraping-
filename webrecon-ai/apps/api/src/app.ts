import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import authPlugin from "./plugins/auth.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import healthRoutes from "./routes/health.js";
import projectRoutes from "./routes/projects.js";
import browserRoutes from "./routes/browser.js";
import jobRoutes from "./routes/jobs.js";

export interface BuildAppOptions {
  logger?: boolean;
  webUrl?: string;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cors, {
    origin: options.webUrl ?? process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });
  await app.register(websocket);

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(projectRoutes);
  await app.register(browserRoutes);
  await app.register(jobRoutes);

  return app;
}
