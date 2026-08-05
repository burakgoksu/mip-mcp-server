import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── RFC Destinations (Operations > Destinations > RFC) ────────────────────────
  // SAP RFC bağlantı hedefleri. Endpoint: /api/rfc-destinations.
  {
    name: "mip_list_rfc_destinations",
    description:
      "RFC (SAP) destination listesini döner. Her kayıt: destinationName, ashost (Application Server), sysnr, client, user, lang, peakLimit, poolCapacity, sapRouter. Parola gizlidir. Sayfalıdır.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: ad/ashost/client/sysnr/user/sapRouter içinde arama" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_rfc_destination",
    description: "Yeni bir RFC (SAP) destination oluşturur. SAP application server bağlantı bilgilerini içerir.",
    inputSchema: {
      type: "object",
      properties: {
        destinationName: { type: "string", description: "Destination adı (benzersiz)" },
        ashost: { type: "string", description: "Application Server host (SAP AS host)" },
        sysnr: { type: "string", description: "System Number (ör. '00')" },
        client: { type: "string", description: "Client (ör. '100')" },
        user: { type: "string", description: "SAP kullanıcı adı" },
        password: { type: "string", description: "SAP parolası" },
        lang: { type: "string", description: "Dil (ör. 'EN', 'TR') — opsiyonel" },
        peakLimit: { type: "string", description: "Peak limit (ör. '0') — opsiyonel" },
        poolCapacity: { type: "string", description: "Pool capacity (ör. '10') — opsiyonel" },
        sapRouter: { type: "string", description: "SAP Router stringi — opsiyonel" },
      },
      required: ["destinationName", "ashost", "sysnr", "client", "user", "password"],
    },
  },
  {
    name: "mip_update_rfc_destination",
    description:
      "Mevcut bir RFC destination'ı id ile günceller. Verilen alanlar mevcut kaydın üstüne merge edilir; password verilmezse mevcut korunur.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Güncellenecek destination ID" },
        destinationName: { type: "string", description: "Yeni ad (opsiyonel)" },
        ashost: { type: "string", description: "Yeni AS host (opsiyonel)" },
        sysnr: { type: "string", description: "Yeni system number (opsiyonel)" },
        client: { type: "string", description: "Yeni client (opsiyonel)" },
        user: { type: "string", description: "Yeni kullanıcı (opsiyonel)" },
        password: { type: "string", description: "Yeni parola (opsiyonel; verilmezse korunur)" },
        lang: { type: "string", description: "Yeni dil (opsiyonel)" },
        peakLimit: { type: "string", description: "Yeni peak limit (opsiyonel)" },
        poolCapacity: { type: "string", description: "Yeni pool capacity (opsiyonel)" },
        sapRouter: { type: "string", description: "Yeni SAP router (opsiyonel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_rfc_destination",
    description: "Belirli bir RFC destination'ı id ile siler.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Silinecek destination ID" } },
      required: ["id"],
    },
  },
];

const handlers = {
    // ─── RFC Destinations (/api/rfc-destinations) ───────────────────────────────
    mip_list_rfc_destinations: async (args, headers) => {
      const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 200 };
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: ["destinationName", "ashost", "client", "sysnr", "user", "sapRouter"].map((k) => ({
            filterKey: k,
            operation: "cn",
            value: args.filter,
          })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/rfc-destinations`, { headers, params });
      const items = res.data?.content ?? (Array.isArray(res.data) ? res.data : []);
      const safe = items.map(({ password, ...rest }) => rest);
      return JSON.stringify(res.data?.content ? { ...res.data, content: safe } : safe, null, 2);
    },

    mip_create_rfc_destination: async (args, headers) => {
      const body = {
        destinationName: args.destinationName,
        ashost: args.ashost,
        sysnr: args.sysnr,
        client: args.client,
        user: args.user,
        password: args.password,
        lang: args.lang ?? "",
        peakLimit: args.peakLimit ?? "0",
        poolCapacity: args.poolCapacity ?? "",
        sapRouter: args.sapRouter ?? "",
      };
      const res = await axios.post(`${BASE_URL}/api/rfc-destinations`, body, { headers });
      return `RFC destination oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_rfc_destination: async (args, headers) => {
      const { id } = args;
      const cur = await axios.get(`${BASE_URL}/api/rfc-destinations`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const existing = items.find((d) => d.id === id);
      if (!existing) throw new Error(`RFC destination bulunamadı: id ${id}`);
      const body = {
        destinationName: args.destinationName ?? existing.destinationName,
        ashost: args.ashost ?? existing.ashost,
        sysnr: args.sysnr ?? existing.sysnr,
        client: args.client ?? existing.client,
        user: args.user ?? existing.user,
        lang: args.lang ?? existing.lang ?? "",
        peakLimit: args.peakLimit ?? existing.peakLimit ?? "0",
        poolCapacity: args.poolCapacity ?? existing.poolCapacity ?? "",
        sapRouter: args.sapRouter ?? existing.sapRouter ?? "",
      };
      // password liste yanıtında yok; yalnızca verilirse gönder (verilmezse MIP mevcut parolayı korur).
      if (args.password !== undefined) body.password = args.password;
      const res = await axios.put(`${BASE_URL}/api/rfc-destinations/${id}`, body, { headers });
      return `RFC destination güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_rfc_destination: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/rfc-destinations/${args.id}`, { headers });
      return `RFC destination silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
