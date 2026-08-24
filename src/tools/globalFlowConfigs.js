import axios from "axios";
import { BASE_URL } from "../config.js";
import { parseConfigValue } from "../util.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  // ─── Global Flow Configurations (Operations > Global-Flow-Configurations) ──────
  // Flow'lar arası ortak exchange property'leri. Endpoint: /api/global-flow-configurations.
  {
    name: "mip_list_global_flow_configs",
    description:
      "Returns the global flow configuration list. Each record: configKey, configValue (scalar or JSON), enabled, appliedGlobally. Paginated. filter searches within configKey.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: text occurring in configKey" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_global_flow_config",
    description:
      "Creates a new global flow configuration (an exchange property shared across flows). configValue can be a scalar (text/number/bool) or JSON; JSON text is parsed automatically. enabled = visible/active to flows, appliedGlobally = applied automatically to every flow (opt-out).",
    inputSchema: {
      type: "object",
      properties: {
        configKey: { type: "string", description: "Configuration key (unique)" },
        configValue: {
          type: "string",
          description: "Value: scalar (e.g. 'No', '5', 'true') or JSON text (e.g. '{\"a\":1}'). Parsed automatically if it is JSON.",
        },
        enabled: { type: "boolean", description: "Enabled / visible to flows (default false)" },
        appliedGlobally: {
          type: "boolean",
          description: "Apply automatically to all flows / opt-out (default false)",
        },
      },
      required: ["configKey", "configValue"],
    },
  },
  {
    name: "mip_update_global_flow_config",
    description:
      "Updates an existing global flow configuration by configKey (the given fields are merged over the current record). configValue can be a scalar or JSON. If a warning is raised for a config already in use, it can be bypassed with force=true.",
    inputSchema: {
      type: "object",
      properties: {
        configKey: { type: "string", description: "Configuration key to update" },
        configValue: { type: "string", description: "New value: scalar or JSON text (optional)" },
        enabled: { type: "boolean", description: "Enabled/disabled (optional)" },
        appliedGlobally: { type: "boolean", description: "Turn global application on/off (optional)" },
        force: { type: "boolean", description: "Ignore the warning and force the update (optional)" },
      },
      required: ["configKey"],
    },
  },
  {
    name: "mip_delete_global_flow_config",
    description: "Deletes a specific global flow configuration by configKey.",
    inputSchema: {
      type: "object",
      properties: {
        configKey: { type: "string", description: "Configuration key to delete" },
      },
      required: ["configKey"],
    },
  },
];

const handlers = {
    // ─── Global Flow Configurations ─────────────────────────────────────────────
    mip_list_global_flow_configs: async (args, headers) => {
      const params = {
        paginationPage: (args.page ?? 1) - 1,
        paginationSize: args.size ?? 200,
      };
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: [{ filterKey: "configKey", operation: "cn", value: args.filter }],
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/global-flow-configurations`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_create_global_flow_config: async (args, headers) => {
      const body = {
        configKey: args.configKey,
        configValue: parseConfigValue(args.configValue),
        enabled: args.enabled ?? false,
        appliedGlobally: args.appliedGlobally ?? false,
      };
      const res = await axios.post(`${BASE_URL}/api/global-flow-configurations`, body, { headers });
      return msg.created("Global flow config", res.data);
    },

    mip_update_global_flow_config: async (args, headers) => {
      const { configKey } = args;
      const cur = await axios.get(`${BASE_URL}/api/global-flow-configurations`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const existing = (cur.data?.content ?? []).find((c) => c.configKey === configKey);
      if (!existing) throw err.notFound("Global flow config", configKey);
      const data = {
        configValue:
          args.configValue !== undefined ? parseConfigValue(args.configValue) : existing.configValue,
        enabled: args.enabled ?? existing.enabled,
        appliedGlobally: args.appliedGlobally ?? existing.appliedGlobally,
      };
      const url = `${BASE_URL}/api/global-flow-configurations/${encodeURIComponent(configKey)}${
        args.force ? "?force=true" : ""
      }`;
      const res = await axios.put(url, data, { headers });
      return msg.updated("Global flow config", res.data);
    },

    mip_delete_global_flow_config: async (args, headers) => {
      const res = await axios.delete(
        `${BASE_URL}/api/global-flow-configurations/${encodeURIComponent(args.configKey)}`,
        { headers }
      );
      return msg.deletedRef("Global flow config", args.configKey, res.data);
    },
};

export default { tools, handlers };
