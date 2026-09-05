import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { AppError } from "@webrecon/shared";

async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((rawError: FastifyError | AppError | ZodError | Error, request, reply) => {
    const error = rawError as FastifyError;
    const requestId = request.id;

    if (error instanceof AppError) {
      request.log.warn({ err: error, requestId }, "handled application error");
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, requestId },
      });
    }

    if (error instanceof ZodError) {
      request.log.warn({ err: error, requestId }, "validation error");
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues.map((issue) => issue.message).join("; "),
          requestId,
        },
      });
    }

    // Fastify's own validation errors (route schema) carry a statusCode.
    const statusCode = "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;

    if (statusCode < 500) {
      request.log.warn({ err: error, requestId }, "client error");
      return reply.status(statusCode).send({
        error: { code: "BAD_REQUEST", message: error.message, requestId },
      });
    }

    request.log.error({ err: error, requestId }, "unhandled error");
    return reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "Something went wrong", requestId },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route not found: ${request.method} ${request.url}`,
        requestId: request.id,
      },
    });
  });
}

export default fp(errorHandlerPlugin, { name: "error-handler-plugin" });
