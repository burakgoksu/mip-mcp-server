#!/usr/bin/env node

// ─── MIP MCP Server — ince giriş ──────────────────────────────────────────────
// Tool tanımları ve handler'ları src/tools/* modüllerinde; src/registry.js hepsini
// TOOLS (dizi) + HANDLERS (obje) olarak toplar. Bu dosya yalnızca: dispatch +
// MCP server kurulumu + stdio bağlantısı. Paylaşılan altyapı: src/config, src/auth,
// src/util, src/xlsx, src/wsdl, src/kb/flowSchema.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";

import { getToken, authHeaders } from "./src/auth.js";
import { tools as TOOLS, handlers as HANDLERS } from "./src/registry.js";
import { t } from "./src/i18n/index.js";

// ─── Dispatch ─────────────────────────────────────────────────────────────────
// Her istekte token tazele + auth header üret; tool'u registry'den bul ve çağır.
// Handler'lar (args, headers) alır, string döner veya throw eder; hata formatı
// aşağıdaki CallTool wrapper'ında merkezileştirilmiştir.
async function handleTool(name, args) {
  await getToken();
  const headers = authHeaders();
  const handler = HANDLERS[name];
  if (!handler) throw new Error(t("server.unknownTool", { name }, "Unknown tool: {name}"));
  return handler(args, headers);
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server(
  { name: "mip-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args ?? {});
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    const message = err?.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    return {
      content: [{ type: "text", text: t("server.errorPrefix", { message }, "Error: {message}") }],
      isError: true,
    };
  }
});

// Test/registry import'u server'i baslatmasin diye: yalnizca dosya DOGRUDAN
// calistirilinca (entry) stdio transport'a baglan. `export`'lar dogrulama
// harness'inin TOOLS + handleTool'a erisebilmesi icin.
export { TOOLS, handleTool };

const selfPath = fileURLToPath(import.meta.url);
const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isEntry = entryArg && (entryArg === selfPath || entryArg.toLowerCase() === selfPath.toLowerCase());
if (isEntry) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
