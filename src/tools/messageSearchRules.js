import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Message Search Rules (Integrations > Message-Search-Rules) ────────────────
  // Bir flow'un mesajlarından XPATH/JSON_PATH ile alan çıkaran kurallar; sonuç
  // Monitoring ekranında aranabilir/gösterilebilir. Endpoint: /api/message-search-rules.
  {
    name: "mip_list_message_search_rules",
    description:
      "Message search rule listesini döner. Her kural: flowId, name, type (XPATH|JSON_PATH), value (ifade), isEnabled. Sayfalıdır. filter flowId/name/type/value içinde arar.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: flowId/name/type/value içinde geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_message_search_rule",
    description:
      "Yeni bir message search rule oluşturur. Belirtilen flow'un mesajından, type=XPATH veya JSON_PATH ifadesiyle (value) bir alan çıkarır; bu alan Monitoring'de arama/görüntüleme için kullanılır. isEnabled ile kural etkinleştirilir.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Kuralın uygulanacağı flow ID (ör. F_SAP_TO_ICE_EDONUSUM)" },
        name: { type: "string", description: "Kural adı / çıkarılan alanın etiketi (ör. UserName)" },
        type: {
          type: "string",
          enum: ["XPATH", "JSON_PATH"],
          description: "İfade tipi: XPATH (XML) veya JSON_PATH (JSON)",
        },
        value: {
          type: "string",
          description: "Çıkarım ifadesi (ör. XPATH: //*[local-name()='UserName']/text() , JSON_PATH: $.userName)",
        },
        isEnabled: { type: "boolean", description: "Kural etkin mi (varsayılan false)" },
      },
      required: ["flowId", "name", "type", "value"],
    },
  },
  {
    name: "mip_update_message_search_rule",
    description:
      "Mevcut bir message search rule'u günceller (isEnabled aç/kapa dahil). id zorunlu; verilen alanlar mevcut kaydın üstüne merge edilir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Güncellenecek kural ID (mip_list_message_search_rules ile alınır)" },
        flowId: { type: "string", description: "Yeni flow ID (opsiyonel)" },
        name: { type: "string", description: "Yeni ad (opsiyonel)" },
        type: { type: "string", enum: ["XPATH", "JSON_PATH"], description: "Yeni tip (opsiyonel)" },
        value: { type: "string", description: "Yeni ifade (opsiyonel)" },
        isEnabled: { type: "boolean", description: "Etkin/pasif (opsiyonel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_message_search_rule",
    description:
      "Belirli bir message search rule'u siler. NOT: etkin (isEnabled) bir kural silinemez (409); önce mip_update_message_search_rule ile isEnabled=false yapılmalıdır.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Silinecek kural ID" },
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
