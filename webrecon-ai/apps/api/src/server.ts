import { buildApp } from "./app.js";
import { getBrowserSessionManager } from "@webrecon/browser";

async function main() {
  const app = await buildApp();
  const port = Number(process.env.API_PORT ?? 4000);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void (async () => {
        app.log.info(`${signal} received, shutting down`);
        await getBrowserSessionManager().shutdown();
        await app.close();
        process.exit(0);
      })();
    });
  }

  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
