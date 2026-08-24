import axios from "axios";
import { BASE_URL } from "../config.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  // ─── RFC Destinations (Operations > Destinations > RFC) ────────────────────────
  // SAP RFC bağlantı hedefleri. Endpoint: /api/rfc-destinations.
  {
    name: "mip_list_rfc_destinations",
    description:
      "Returns the RFC (SAP) destination list. Each record: destinationName, ashost (Application Server), sysnr, client, user, lang, peakLimit, poolCapacity, sapRouter. The password is hidden. Paginated.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: search within name/ashost/client/sysnr/user/sapRouter" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_rfc_destination",
    description: "Creates a new RFC (SAP) destination. Holds the SAP application server connection details.",
    inputSchema: {
      type: "object",
      properties: {
        destinationName: { type: "string", description: "Destination name (unique)" },
        ashost: { type: "string", description: "Application Server host (SAP AS host)" },
        sysnr: { type: "string", description: "System Number (e.g. '00')" },
        client: { type: "string", description: "Client (e.g. '100')" },
        user: { type: "string", description: "SAP user name" },
        password: { type: "string", description: "SAP password" },
        lang: { type: "string", description: "Language (e.g. 'EN', 'TR') — optional" },
        peakLimit: { type: "string", description: "Peak limit (e.g. '0') — optional" },
        poolCapacity: { type: "string", description: "Pool capacity (e.g. '10') — optional" },
        sapRouter: { type: "string", description: "SAP Router string — optional" },
      },
      required: ["destinationName", "ashost", "sysnr", "client", "user", "password"],
    },
  },
  {
    name: "mip_update_rfc_destination",
    description:
      "Updates an existing RFC destination by id. The given fields are merged over the current record; if password is omitted the existing one is kept.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the destination to update" },
        destinationName: { type: "string", description: "New name (optional)" },
        ashost: { type: "string", description: "New AS host (optional)" },
        sysnr: { type: "string", description: "New system number (optional)" },
        client: { type: "string", description: "New client (optional)" },
        user: { type: "string", description: "New user (optional)" },
        password: { type: "string", description: "New password (optional; kept if omitted)" },
        lang: { type: "string", description: "New language (optional)" },
        peakLimit: { type: "string", description: "New peak limit (optional)" },
        poolCapacity: { type: "string", description: "New pool capacity (optional)" },
        sapRouter: { type: "string", description: "New SAP router (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_rfc_destination",
    description: "Deletes a specific RFC destination by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "ID of the destination to delete" } },
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
      return msg.created("RFC destination", res.data);
    },

    mip_update_rfc_destination: async (args, headers) => {
      const { id } = args;
      const cur = await axios.get(`${BASE_URL}/api/rfc-destinations`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const existing = items.find((d) => d.id === id);
      if (!existing) throw err.notFound("RFC destination", id);
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
      return msg.updated("RFC destination", res.data);
    },

    mip_delete_rfc_destination: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/rfc-destinations/${args.id}`, { headers });
      return msg.deletedRef("RFC destination", `id ${args.id}`, res.data);
    },
};

export default { tools, handlers };
