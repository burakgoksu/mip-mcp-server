import axios from "axios";
import { BASE_URL } from "../config.js";
import { parseConfigValue } from "../util.js";

const tools = [
  // ─── Global Flow Configurations (Operations > Global-Flow-Configurations) ──────
  // Flow'lar arası ortak exchange property'leri. Endpoint: /api/global-flow-configurations.
  {
    name: "mip_list_global_flow_configs",
    description:
      "Global flow configuration listesini döner. Her kayıt: configKey, configValue (scalar veya JSON), enabled, appliedGlobally. Sayfalıdır. filter configKey içinde arar.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: configKey içinde geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_global_flow_config",
    description:
      "Yeni bir global flow configuration (flow'lar arası ortak exchange property) oluşturur. configValue skaler (metin/sayı/bool) veya JSON olabilir; JSON metni otomatik parse edilir. enabled=flow'lara görünür/etkin, appliedGlobally=tüm flow'lara otomatik uygulanır (opt-out).",
    inputSchema: {
      type: "object",
      properties: {
        configKey: { type: "string", description: "Konfigürasyon anahtarı (benzersiz)" },
        configValue: {
          type: "string",
          description: "Değer: skaler (ör. 'No', '5', 'true') veya JSON metni (ör. '{\"a\":1}'). JSON ise otomatik parse edilir.",
        },
        enabled: { type: "boolean", description: "Etkin / flow'lara görünür (varsayılan false)" },
        appliedGlobally: {
          type: "boolean",
          description: "Tüm flow'lara otomatik uygulansın mı / opt-out (varsayılan false)",
        },
      },
      required: ["configKey", "configValue"],
    },
  },
  {
    name: "mip_update_global_flow_config",
    description:
      "Mevcut bir global flow configuration'ı configKey ile günceller (verilen alanlar mevcut kaydın üstüne merge edilir). configValue skaler veya JSON olabilir. Kullanımdaki config için uyarı çıkarsa force=true ile geçilebilir.",
    inputSchema: {
      type: "object",
      properties: {
        configKey: { type: "string", description: "Güncellenecek konfigürasyon anahtarı" },
        configValue: { type: "string", description: "Yeni değer: skaler veya JSON metni (opsiyonel)" },
        enabled: { type: "boolean", description: "Etkin/pasif (opsiyonel)" },
        appliedGlobally: { type: "boolean", description: "Global uygulama aç/kapa (opsiyonel)" },
        force: { type: "boolean", description: "Uyarıyı yok sayıp güncellemeyi zorla (opsiyonel)" },
      },
      required: ["configKey"],
    },
  },
  {
    name: "mip_delete_global_flow_config",
    description: "Belirli bir global flow configuration'ı configKey ile siler.",
    inputSchema: {
      type: "object",
      properties: {
        configKey: { type: "string", description: "Silinecek konfigürasyon anahtarı" },
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
      return `Global flow config oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_global_flow_config: async (args, headers) => {
      const { configKey } = args;
      const cur = await axios.get(`${BASE_URL}/api/global-flow-configurations`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const existing = (cur.data?.content ?? []).find((c) => c.configKey === configKey);
      if (!existing) throw new Error(`Global flow config bulunamadı: ${configKey}`);
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
      return `Global flow config güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_global_flow_config: async (args, headers) => {
      const res = await axios.delete(
        `${BASE_URL}/api/global-flow-configurations/${encodeURIComponent(args.configKey)}`,
        { headers }
      );
      return `Global flow config silindi (${args.configKey}): ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
