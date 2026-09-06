import type { FastifyInstance } from "fastify";

export default async function mcpConfigRoutes(app: FastifyInstance) {
  app.get("/mcp/config", async () => {
    return {
      command: "npx",
      args: ["-y", "@webrecon/mcp-server"],
      env: {
        WEBRECON_API_URL: process.env.WEB_API_PUBLIC_URL ?? "http://localhost:4000",
        WEBRECON_API_KEY: "<create one at /api-keys and paste it here>",
      },
      note:
        "Create a WebRecon API key (POST /api-keys) and set it as WEBRECON_API_KEY in your " +
        "coding agent's MCP server configuration.",
    };
  });
}
