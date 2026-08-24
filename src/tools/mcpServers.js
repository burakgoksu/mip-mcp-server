import axios from "axios";
import { BASE_URL } from "../config.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  // ─── MCP Servers (Operations > Destinations > MCP Servers) ─────────────────────
  // MIP flow'larının çağırabileceği harici MCP sunucuları. Endpoint: /api/mcp-servers.
  {
    name: "mip_list_mcp_servers",
    description:
      "Returns the list of defined MCP servers. Each record: name, serverConfigJson, authType, isEnabled, defaultTool. Paginated. filter searches within name/serverConfigJson.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: text occurring in the name/config" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_mcp_server",
    description:
      "Defines a new MCP server. serverConfigJson must be valid JSON (an MCP server config). credentialId is required unless authType is NONE; credentialHeaderName may be given for API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "MCP server name (unique, max 255)" },
        serverConfigJson: {
          type: "string",
          description:
            "MCP server configuration (valid JSON text). E.g. {\"mcpServers\":{\"filesystem\":{\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-filesystem\",\"/tmp\"]}}}",
        },
        authType: {
          type: "string",
          enum: ["NONE", "API_KEY", "BEARER", "BASIC", "OAUTH2", "CLIENT_CERT"],
          description: "Authentication type (default NONE)",
        },
        credentialId: { type: "string", description: "Required unless authType is NONE — the credential ID holding the authentication details" },
        credentialHeaderName: { type: "string", description: "Header/env variable name for API_KEY (optional)" },
        defaultTool: { type: "string", description: "Default tool name (optional)" },
        isEnabled: { type: "boolean", description: "Whether it is enabled (default true)" },
      },
      required: ["name", "serverConfigJson"],
    },
  },
  {
    name: "mip_update_mcp_server",
    description:
      "Updates an existing MCP server by id (including isEnabled). The given fields are merged over the current record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the MCP server to update" },
        name: { type: "string", description: "New name (optional)" },
        serverConfigJson: { type: "string", description: "New config JSON (optional)" },
        authType: {
          type: "string",
          enum: ["NONE", "API_KEY", "BEARER", "BASIC", "OAUTH2", "CLIENT_CERT"],
          description: "New auth type (optional)",
        },
        credentialId: { type: "string", description: "New credential ID (optional)" },
        credentialHeaderName: { type: "string", description: "New header name (optional)" },
        defaultTool: { type: "string", description: "New default tool (optional)" },
        isEnabled: { type: "boolean", description: "Enabled/disabled (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_mcp_server",
    description: "Deletes a specific MCP server by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "ID of the MCP server to delete" } },
      required: ["id"],
    },
  },
  {
    name: "mip_sync_mcp_server",
    description:
      "Connects to the MCP server and synchronizes the tools it exposes (refresh-tools). On success connectionStatus becomes SYNCED and toolsCount is populated. Call this first to see the tools of a newly created/updated MCP server.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "ID of the MCP server to sync" } },
      required: ["id"],
    },
  },
  {
    name: "mip_list_mcp_server_tools",
    description:
      "Returns the tools discovered for an MCP server (after a sync): name, description, inputSchemaJson, outputSchemaJson. Paginated. The server must be SYNCED via mip_sync_mcp_server first.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "MCP server ID" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 25)" },
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
        throw err.at("mcp.credentialRequired", null, "credentialId is required unless authType is NONE.");
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
      return msg.created("MCP server", res.data);
    },

    mip_update_mcp_server: async (args, headers) => {
      const { id } = args;
      const cur = await axios.get(`${BASE_URL}/api/mcp-servers`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const existing = items.find((s) => s.id === id);
      if (!existing) throw err.notFound("MCP server", id);
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
      return msg.updated("MCP server", res.data);
    },

    mip_delete_mcp_server: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/mcp-servers/${args.id}`, { headers });
      return msg.deletedRef("MCP server", `id ${args.id}`, res.data);
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
        s.connectionStatus === "FAILED" ? t("mcp.connectionFailed", null, " — connection failed (check the config/access).") : ""
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
