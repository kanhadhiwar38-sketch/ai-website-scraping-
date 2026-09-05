import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { UnauthorizedError } from "@webrecon/shared";
import { verifyIdToken } from "@webrecon/firebase/admin";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

/**
 * Reads `Authorization: Bearer <Firebase ID token>`, verifies it against
 * Firebase Admin, and sets `request.userId`. Routes call
 * `request.requireUserId()` to get a guaranteed-non-null id or throw
 * UnauthorizedError, keeping the "is the caller logged in" check explicit
 * and impossible to accidentally skip.
 */
async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("userId", undefined);

  app.addHook("onRequest", async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return;
    }
    const token = header.slice("Bearer ".length);
    try {
      const decoded = await verifyIdToken(token);
      request.userId = decoded.uid;
    } catch {
      // Leave userId undefined; routes that require auth will reject via
      // requireUserId(). We don't throw here so public routes (e.g.
      // /health) keep working without a token.
    }
  });

  app.decorateRequest("requireUserId", function requireUserId(this: FastifyRequest) {
    if (!this.userId) {
      throw new UnauthorizedError();
    }
    return this.userId;
  });
}

declare module "fastify" {
  interface FastifyRequest {
    requireUserId(): string;
  }
}

export default fp(authPlugin, { name: "auth-plugin" });
