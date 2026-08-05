// ─── XI Queues (Sap-Connections > XI Proxy > Queues) ──────────────────────────
// SAP XI/PI mesaj kuyrukları: listele, özet, payload, retry/cancel. /api/xi-queues.
import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  {
    name: "mip_list_xi_queue_messages",
    description:
      "XI Proxy > Queues: XI/PI kuyruk mesajlarını döner (sayfalı). status/qos/queueId/interfaceName/from/to ile filtrelenebilir. Takılan (blocked) mesajları bulmak ve retry/cancel etmek için kullanılır.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Mesaj durumu (ör. blocked/error) — opsiyonel" },
        qos: { type: "string", description: "Quality of Service (ör. EO/EOIO) — opsiyonel" },
        queueId: { type: "string", description: "Kuyruk ID — opsiyonel" },
        interfaceName: { type: "string", description: "Interface adı — opsiyonel" },
        from: { type: "string", description: "Başlangıç tarihi — opsiyonel" },
        to: { type: "string", description: "Bitiş tarihi — opsiyonel" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 25)" },
      },
      required: [],
    },
  },
  {
    name: "mip_get_xi_queue_summary",
    description: "XI Proxy > Queues özeti: definedQueues, blockedQueues ve durum bazlı counts döner.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_get_xi_queue_payload",
    description: "Belirli bir XI kuyruk mesajının payload'ını döner (id ile).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "XI kuyruk mesajı ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_retry_xi_queue_message",
    description: "Takılan/hatalı bir XI kuyruk mesajını yeniden işlenmek üzere kuyruğa alır (PATCH /{id}/retry). updated:true ise başarılı.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "XI kuyruk mesajı ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_cancel_xi_queue_message",
    description: "Bir XI kuyruk mesajını iptal eder (PATCH /{id}/cancel). updated:true ise başarılı.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "XI kuyruk mesajı ID" } },
      required: ["id"],
    },
  },
];

const handlers = {
  mip_list_xi_queue_messages: async (args, headers) => {
    const p = {
      status: args.status,
      qos: args.qos,
      queueId: args.queueId,
      interfaceName: args.interfaceName,
      from: args.from,
      to: args.to,
      paginationPage: (args.page ?? 1) - 1,
      paginationSize: args.size ?? 25,
    };
    const qs = Object.entries(p)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const res = await axios.get(`${BASE_URL}/api/xi-queues?${qs}`, { headers });
    return JSON.stringify(res.data, null, 2);
  },

  mip_get_xi_queue_summary: async (args, headers) => {
    const res = await axios.get(`${BASE_URL}/api/xi-queues/summary`, { headers });
    return JSON.stringify(res.data, null, 2);
  },

  mip_get_xi_queue_payload: async (args, headers) => {
    const res = await axios.get(`${BASE_URL}/api/xi-queues/${encodeURIComponent(args.id)}/payload`, { headers });
    return JSON.stringify(res.data, null, 2);
  },

  mip_retry_xi_queue_message: async (args, headers) => {
    const res = await axios.patch(`${BASE_URL}/api/xi-queues/${encodeURIComponent(args.id)}/retry`, null, { headers });
    return `XI mesajı retry (id ${args.id}): ${JSON.stringify(res.data)}`;
  },

  mip_cancel_xi_queue_message: async (args, headers) => {
    const res = await axios.patch(`${BASE_URL}/api/xi-queues/${encodeURIComponent(args.id)}/cancel`, null, { headers });
    return `XI mesajı iptal (id ${args.id}): ${JSON.stringify(res.data)}`;
  },
};

export default { tools, handlers };
