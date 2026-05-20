#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { FlowMailerClient } from "./flowmailer-client.js";
import { registerTools } from "./tools.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = new McpServer(
    {
      name: "sendpro-flowmailer-mcp",
      version: "0.1.1"
    },
    {
      instructions:
        "Unofficial MCP server for Spotler SendPro, formerly FlowMailer. Use read-only tools for investigation. Mutating SendPro API calls are unavailable when READ_ONLY/SENDPRO_READ_ONLY is true."
    }
  );

  registerTools(server, new FlowMailerClient(config), config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SendPro MCP server failed to start: ${message}`);
  process.exit(1);
});
