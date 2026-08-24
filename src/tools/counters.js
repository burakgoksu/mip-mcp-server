import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Counters (Integrations > Counters) ───────────────────────────────────────
  // Backend'de counter'lar "number-ranges" olarak tutulur (/api/number-ranges).
  {
    name: "mip_list_counters",
    description:
      "Returns the counter (number range) list. Each counter: name, minimumValue, maximumValue, currentValue, length. Paginated.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description:
            "Optional search filter (text occurring in the name/values). Returns everything if left empty.",
        },
        page: { type: "number", description: "Page number (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_counter",
    description:
      "Creates a new counter (number range). name must be unique; minimumValue/maximumValue set the numeric range, and length the zero-padded width.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Counter name (unique)" },
        minimumValue: { type: "number", description: "Minimum value (e.g. 1)" },
        maximumValue: { type: "number", description: "Maximum value (e.g. 99999)" },
        currentValue: {
          type: "number",
          description: "Initial/current value (optional; usually starts at minimumValue)",
        },
        length: {
          type: "number",
          description: "Zero-padded width of the generated number (e.g. 5)",
        },
      },
      required: ["name", "minimumValue", "maximumValue"],
    },
  },
  {
    name: "mip_update_counter",
    description: "Updates an existing counter. id is required; the given fields are updated.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the counter to update (from mip_list_counters)" },
        name: { type: "string", description: "New name (optional)" },
        minimumValue: { type: "number", description: "New minimum value (optional)" },
        maximumValue: { type: "number", description: "New maximum value (optional)" },
        currentValue: { type: "number", description: "New current value (optional)" },
        length: { type: "number", description: "New length (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_counter",
    description: "Deletes a specific counter.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the counter to delete" },
      },
      required: ["id"],
    },
  },
];

const handlers = {
    // ─── Counters (number-ranges) ───────────────────────────────────────────────
    mip_list_counters: async (args, headers) => {
      const params = {
        paginationPage: (args.page ?? 1) - 1,
        paginationSize: args.size ?? 200,
      };
      if (args.filter) {
        // MIP, filtreyi base64 kodlu bir JSON olarak bekler: tüm alanlarda
        // "contains" (cn) araması, dataOption "any" (OR). Düz metni bu yapıya çevir.
        const keys = ["name", "minimumValue", "maximumValue", "currentValue", "length"];
        const criteria = {
          dataOption: "any",
          searchCriteriaList: keys.map((k) => ({ filterKey: k, operation: "cn", value: args.filter })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/number-ranges`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_create_counter: async (args, headers) => {
      const body = {
        name: args.name,
        minimumValue: args.minimumValue,
        maximumValue: args.maximumValue,
        currentValue: args.currentValue ?? args.minimumValue,
        length: args.length ?? 1,
      };
      const res = await axios.post(`${BASE_URL}/api/number-ranges`, body, { headers });
      return `Counter oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_counter: async (args, headers) => {
      const { id, ...updates } = args;
      // MIP PUT tam objeyi bekler; kısmi güncellemede diğer alanların sıfırlanmaması
      // için önce mevcut kaydı bul, üstüne verilen alanları merge et.
      const cur = await axios.get(`${BASE_URL}/api/number-ranges`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const existing = (cur.data?.content ?? []).find((c) => c.id === id);
      if (!existing) throw new Error(`Counter bulunamadı: id ${id}`);
      const body = {
        name: updates.name ?? existing.name,
        minimumValue: updates.minimumValue ?? existing.minimumValue,
        maximumValue: updates.maximumValue ?? existing.maximumValue,
        currentValue: updates.currentValue ?? existing.currentValue,
        length: updates.length ?? existing.length,
      };
      const res = await axios.put(`${BASE_URL}/api/number-ranges/${id}`, body, { headers });
      return `Counter güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_counter: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/number-ranges/${args.id}`, { headers });
      return `Counter silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
