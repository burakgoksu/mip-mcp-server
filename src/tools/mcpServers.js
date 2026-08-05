import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── MCP Servers (Operations > Destinations > MCP Servers) ─────────────────────
  // MIP flow'larının çağırabileceği harici MCP sunucuları. Endpoint: /api/mcp-servers.
  {
    name: "mip_list_mcp_servers",
    description:
      "Tanımlı MCP server listesini döner. Her kayıt: name, serverConfigJson, authType, isEnabled, defaultTool. Sayfalıdır. filter name/serverConfigJson içinde arar.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: ad/config içinde geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_mcp_server",
    description:
      "Yeni bir MCP server tanımlar. serverConfigJson geçerli bir JSON (MCP server config) olmalı. authType NONE değilse credentialId zorunludur; API_KEY için credentialHeaderName verilebilir.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "MCP server adı (benzersiz, max 255)" },
        serverConfigJson: {
          type: "string",
          description:
            "MCP server konfigürasyonu (geçerli JSON metni). Ör. {\"mcpServers\":{\"filesystem\":{\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-filesystem\",\"/tmp\"]}}}",
        },
        authType: {
          type: "string",
          enum: ["NONE", "API_KEY", "BEARER", "BASIC", "OAUTH2", "CLIENT_CERT"],
          description: "Kimlik doğrulama tipi (varsayılan NONE)",
        },
        credentialId: { type: "string", description: "authType NONE değilse zorunlu — kimlik bilgisi credential ID" },
        credentialHeaderName: { type: "string", description: "API_KEY için header/env değişken adı (opsiyonel)" },
        defaultTool: { type: "string", description: "Varsayılan tool adı (opsiyonel)" },
        isEnabled: { type: "boolean", description: "Etkin mi (varsayılan true)" },
      },
      required: ["name", "serverConfigJson"],
    },
  },
  {
    name: "mip_update_mcp_server",
    description:
      "Mevcut bir MCP server'ı id ile günceller (isEnabled dahil). Verilen alanlar mevcut kaydın üstüne merge edilir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Güncellenecek MCP server ID" },
        name: { type: "string", description: "Yeni ad (opsiyonel)" },
        serverConfigJson: { type: "string", description: "Yeni config JSON (opsiyonel)" },
        authType: {
          type: "string",
          enum: ["NONE", "API_KEY", "BEARER", "BASIC", "OAUTH2", "CLIENT_CERT"],
          description: "Yeni auth tipi (opsiyonel)",
        },
        credentialId: { type: "string", description: "Yeni credential ID (opsiyonel)" },
        credentialHeaderName: { type: "string", description: "Yeni header adı (opsiyonel)" },
        defaultTool: { type: "string", description: "Yeni varsayılan tool (opsiyonel)" },
        isEnabled: { type: "boolean", description: "Etkin/pasif (opsiyonel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_mcp_server",
    description: "Belirli bir MCP server'ı id ile siler.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Silinecek MCP server ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_sync_mcp_server",
    description:
      "MCP server'a bağlanıp sunduğu tool'ları senkronize eder (refresh-tools). Başarılıysa connectionStatus SYNCED olur ve toolsCount dolar. Yeni oluşturulan/güncellenen bir MCP server'ın tool'larını görebilmek için önce bu çağrılır.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Sync edilecek MCP server ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_list_mcp_server_tools",
    description:
      "Bir MCP server'ın (sync sonrası) keşfedilen tool'larını döner: name, description, inputSchemaJson, outputSchemaJson. Sayfalıdır. Önce mip_sync_mcp_server ile SYNCED olmalıdır.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "MCP server ID" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 25)" },
      },
      required: ["id"],
    },
  },
];

const handlers = {
    // ─── MCP Servers (/api/mcp-servers) ─────────────────────────────────────────
    mip_list_mcp_servers: async (args, headers) => {
      const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 200 };
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: ["name", "serverConfigJson"].map((k) => ({
            filterKey: k,
            operation: "cn",
            value: args.filter,
          })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/mcp-servers`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_create_mcp_server: async (args, headers) => {
      const authType = args.authType ?? "NONE";
      if (authType !== "NONE" && !args.credentialId) {
        throw new Error("authType NONE değilse credentialId zorunludur.");
      }
      const useCredentialAuth = authType !== "NONE";
      const body = {
        name: args.name,
        serverConfigJson: args.serverConfigJson,
        isEnabled: args.isEnabled ?? true,
        authType,
        useCredentialAuth,
        credentialId: useCredentialAuth ? (args.credentialId ?? null) : null,
        credentialHeaderName: authType === "API_KEY" ? (args.credentialHeaderName ?? null) : null,
        defaultTool: args.defaultTool ?? null,
      };
      const res = await axios.post(`${BASE_URL}/api/mcp-servers`, body, { headers });
      return `MCP server oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_mcp_server: async (args, headers) => {
      const { id } = args;
      const cur = await axios.get(`${BASE_URL}/api/mcp-servers`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const existing = items.find((s) => s.id === id);
      if (!existing) throw new Error(`MCP server bulunamadı: id ${id}`);
      const authType = args.authType ?? existing.authType ?? "NONE";
      const useCredentialAuth = authType !== "NONE";
      const body = {
        name: args.name ?? existing.name,
        serverConfigJson: args.serverConfigJson ?? existing.serverConfigJson,
        isEnabled: args.isEnabled ?? existing.isEnabled ?? true,
        authType,
        useCredentialAuth,
        credentialId: useCredentialAuth ? (args.credentialId ?? existing.credentialId ?? null) : null,
        credentialHeaderName:
          authType === "API_KEY" ? (args.credentialHeaderName ?? existing.credentialHeaderName ?? null) : null,
        defaultTool: args.defaultTool ?? existing.defaultTool ?? null,
      };
      const res = await axios.put(`${BASE_URL}/api/mcp-servers/${id}`, body, { headers });
      return `MCP server güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_mcp_server: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/mcp-servers/${args.id}`, { headers });
      return `MCP server silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    },

    mip_sync_mcp_server: async (args, headers) => {
      await axios.post(`${BASE_URL}/api/mcp-servers/${args.id}/refresh-tools`, null, { headers });
      // sync sonrası güncel durumu döndür (SYNCED/FAILED + toolsCount).
      const cur = await axios.get(`${BASE_URL}/api/mcp-servers`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const s = items.find((x) => x.id === args.id);
      if (!s) return `Sync tetiklendi (id ${args.id}).`;
      return `MCP server sync edildi: connectionStatus=${s.connectionStatus}, toolsCount=${s.toolsCount}${
        s.connectionStatus === "FAILED" ? " — bağlantı başarısız (config/erişim kontrol edin)." : ""
      }`;
    },

    mip_list_mcp_server_tools: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/mcp-servers/${args.id}/tools`, {
        headers,
        params: { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 25 },
      });
      return JSON.stringify(res.data, null, 2);
    },
};

export default { tools, handlers };
