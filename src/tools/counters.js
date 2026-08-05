import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Counters (Integrations > Counters) ───────────────────────────────────────
  // Backend'de counter'lar "number-ranges" olarak tutulur (/api/number-ranges).
  {
    name: "mip_list_counters",
    description:
      "Counter (number range) listesini döner. Her counter: name, minimumValue, maximumValue, currentValue, length. Sayfalıdır.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description:
            "Opsiyonel arama filtresi (isim/değerlerde geçen metin). Boş bırakılırsa tümü döner.",
        },
        page: { type: "number", description: "Sayfa numarası (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_counter",
    description:
      "Yeni bir counter (number range) oluşturur. name benzersiz olmalı; minimumValue/maximumValue sayısal aralığı, length ise sıfır dolgulu uzunluğu belirtir.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Counter adı (benzersiz)" },
        minimumValue: { type: "number", description: "Minimum değer (ör. 1)" },
        maximumValue: { type: "number", description: "Maksimum değer (ör. 99999)" },
        currentValue: {
          type: "number",
          description: "Başlangıç/güncel değer (opsiyonel; genelde minimumValue ile başlar)",
        },
        length: {
          type: "number",
          description: "Üretilen numaranın sıfır dolgulu uzunluğu (ör. 5)",
        },
      },
      required: ["name", "minimumValue", "maximumValue"],
    },
  },
  {
    name: "mip_update_counter",
    description: "Mevcut bir counter'ı günceller. id zorunlu; verilen alanlar güncellenir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Güncellenecek counter ID (mip_list_counters ile alınır)" },
        name: { type: "string", description: "Yeni ad (opsiyonel)" },
        minimumValue: { type: "number", description: "Yeni minimum değer (opsiyonel)" },
        maximumValue: { type: "number", description: "Yeni maksimum değer (opsiyonel)" },
        currentValue: { type: "number", description: "Yeni güncel değer (opsiyonel)" },
        length: { type: "number", description: "Yeni uzunluk (opsiyonel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_counter",
    description: "Belirli bir counter'ı siler.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Silinecek counter ID" },
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
