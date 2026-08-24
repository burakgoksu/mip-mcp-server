import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Message Search Rules (Integrations > Message-Search-Rules) ────────────────
  // Bir flow'un mesajlarından XPATH/JSON_PATH ile alan çıkaran kurallar; sonuç
  // Monitoring ekranında aranabilir/gösterilebilir. Endpoint: /api/message-search-rules.
  {
    name: "mip_list_message_search_rules",
    description:
      "Returns the message search rule list. Each rule: flowId, name, type (XPATH|JSON_PATH), value (the expression), isEnabled. Paginated. filter searches within flowId/name/type/value.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: text occurring in flowId/name/type/value" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_message_search_rule",
    description:
      "Creates a new message search rule. It extracts a field from the given flow's message using a type=XPATH or JSON_PATH expression (value); that field is then used for searching/display in Monitoring. isEnabled activates the rule.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "ID of the flow the rule applies to (e.g. F_SAP_TO_ICE_EDONUSUM)" },
        name: { type: "string", description: "Rule name / label of the extracted field (e.g. UserName)" },
        type: {
          type: "string",
          enum: ["XPATH", "JSON_PATH"],
          description: "Expression type: XPATH (XML) or JSON_PATH (JSON)",
        },
        value: {
          type: "string",
          description: "Extraction expression (e.g. XPATH: //*[local-name()='UserName']/text() , JSON_PATH: $.userName)",
        },
        isEnabled: { type: "boolean", description: "Whether the rule is enabled (default false)" },
      },
      required: ["flowId", "name", "type", "value"],
    },
  },
  {
    name: "mip_update_message_search_rule",
    description:
      "Updates an existing message search rule (including toggling isEnabled). id is required; the given fields are merged over the current record.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the rule to update (from mip_list_message_search_rules)" },
        flowId: { type: "string", description: "New flow ID (optional)" },
        name: { type: "string", description: "Yeni ad (opsiyonel)" },
        type: { type: "string", enum: ["XPATH", "JSON_PATH"], description: "New type (optional)" },
        value: { type: "string", description: "New expression (optional)" },
        isEnabled: { type: "boolean", description: "Etkin/pasif (opsiyonel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_message_search_rule",
    description:
      "Deletes a specific message search rule. NOTE: an enabled (isEnabled) rule cannot be deleted (409); set isEnabled=false via mip_update_message_search_rule first.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the rule to delete" },
      },
      required: ["id"],
    },
  },
];

const handlers = {
    // ─── Message Search Rules ───────────────────────────────────────────────────
    mip_list_message_search_rules: async (args, headers) => {
      const params = {
        paginationPage: (args.page ?? 1) - 1,
        paginationSize: args.size ?? 200,
      };
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: ["flowId", "name", "type", "value"].map((k) => ({
            filterKey: k,
            operation: "cn",
            value: args.filter,
          })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/message-search-rules`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_create_message_search_rule: async (args, headers) => {
      const body = {
        flowId: args.flowId,
        name: args.name,
        type: args.type,
        value: args.value,
        isEnabled: args.isEnabled ?? false,
      };
      const res = await axios.post(`${BASE_URL}/api/message-search-rules`, body, { headers });
      return `Message search rule oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_message_search_rule: async (args, headers) => {
      const { id } = args;
      // Liste tam kaydı döndürür; mevcut kaydı bul, üstüne verilen alanları merge et.
      const cur = await axios.get(`${BASE_URL}/api/message-search-rules`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const existing = (cur.data?.content ?? []).find((r) => r.id === id);
      if (!existing) throw new Error(`Message search rule bulunamadı: id ${id}`);
      const body = {
        flowId: args.flowId ?? existing.flowId,
        name: args.name ?? existing.name,
        type: args.type ?? existing.type,
        value: args.value ?? existing.value,
        isEnabled: args.isEnabled ?? existing.isEnabled,
      };
      const res = await axios.put(`${BASE_URL}/api/message-search-rules/${id}`, body, { headers });
      return `Message search rule güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_message_search_rule: async (args, headers) => {
      try {
        const res = await axios.delete(`${BASE_URL}/api/message-search-rules/${args.id}`, { headers });
        return `Message search rule silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
      } catch (err) {
        if (err?.response?.status === 409) {
          throw new Error(
            `Kural silinemedi (409): etkin bir kural doğrudan silinemez. Önce mip_update_message_search_rule ile isEnabled=false yapın.`
          );
        }
        throw err;
      }
    },
};

export default { tools, handlers };
