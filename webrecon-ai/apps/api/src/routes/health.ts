import type { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "@webrecon/api",
    timestamp: new Date().toISOString(),
  }));
}
