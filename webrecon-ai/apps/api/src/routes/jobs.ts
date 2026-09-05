import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getJob, requireOwnedJob, cancelJob } from "@webrecon/jobs";

const JobIdParams = z.object({ id: z.string().min(1) });

export default async function jobRoutes(app: FastifyInstance) {
  app.get("/jobs/:id", async (request) => {
    const userId = request.requireUserId();
    const { id } = JobIdParams.parse(request.params);
    return requireOwnedJob(id, userId);
  });

  app.post("/jobs/:id/cancel", async (request) => {
    const userId = request.requireUserId();
    const { id } = JobIdParams.parse(request.params);
    return cancelJob(id, userId);
  });

  // Polling-based WebSocket: pushes the job's current state on connect and
  // whenever its status/progress changes, closing once a terminal state is
  // reached. A Firestore onSnapshot listener would be lower-latency, but a
  // 1s poll is simple, has no extra open connections to leak, and is fast
  // enough for a job-progress UI (spec Section 35 events: job.started,
  // job.progress, job.completed, job.failed).
  app.get("/ws/jobs/:id", { websocket: true }, (socket, request) => {
    const parseResult = JobIdParams.safeParse(request.params);
    if (!parseResult.success) {
      socket.close(1008, "Invalid job id");
      return;
    }
    const { id } = parseResult.data;

    let lastStatus: string | undefined;
    let lastProgress: number | undefined;
    let closed = false;

    socket.on("close", () => {
      closed = true;
    });

    const interval = setInterval(() => {
      void (async () => {
        if (closed) return;
        const job = await getJob(id).catch(() => null);
        if (!job) return;

        const changed = job.status !== lastStatus || job.progress !== lastProgress;
        if (changed) {
          const eventType =
            job.status === "completed"
              ? "job.completed"
              : job.status === "failed"
                ? "job.failed"
                : lastStatus === undefined
                  ? "job.started"
                  : "job.progress";

          socket.send(JSON.stringify({ event: eventType, job }));
          lastStatus = job.status;
          lastProgress = job.progress;
        }

        if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
          clearInterval(interval);
          socket.close(1000, "Job finished");
        }
      })();
    }, 1000);

    socket.on("close", () => clearInterval(interval));
  });
}
