#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

// ─── Paylaşılan modüller (config/auth/util) ───────────────────────────────────
import { BASE_URL, DOWNLOAD_DIR, HEALTH_BASE } from "./src/config.js";
import { getToken, authHeaders } from "./src/auth.js";
import { parseConfigValue, ensureDownloadDir, saveFile, extractFilename } from "./src/util.js";

// ─── Ağır modüller (xlsx / wsdl / flow-schema KB) ─────────────────────────────
import { buildSystemHealthXlsx, buildMonitoringReportXlsx } from "./src/xlsx.js";
import { ensureElementFormDefaultQualified, generateWsdl } from "./src/wsdl.js";
import { MIP_FLOW_SCHEMA, validateFlow } from "./src/kb/flowSchema.js";
// Modüler tool kayıtları (domain'ler taşındıkça dolar). Geçiş boyunca aşağıdaki
// LEGACY_TOOLS + switch ile birlikte çalışır.
import { tools as registryTools, handlers as HANDLERS } from "./src/registry.js";
// ─── Tool Definitions (henüz modüle taşınmamış olanlar) ───────────────────────
const LEGACY_TOOLS = [
];

// Modül registry'sinden gelen tool'lar + henüz taşınmamış legacy tool'lar.
const TOOLS = [...registryTools, ...LEGACY_TOOLS];

// ─── Tool Handlers ────────────────────────────────────────────────────────────
async function handleTool(name, args) {
  await getToken();
  const headers = authHeaders();

  // Modüle taşınmış tool'lar registry'den; kalanlar aşağıdaki switch'ten.
  if (HANDLERS[name]) return HANDLERS[name](args, headers);

  switch (name) {
    default:
      throw new Error(`Bilinmeyen tool: ${name}`);
  }
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
      content: [{ type: "text", text: `Hata: ${message}` }],
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
