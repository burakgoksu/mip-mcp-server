// ─── XI Queues (Sap-Connections > XI Proxy > Queues) ──────────────────────────
// SAP XI/PI mesaj kuyrukları: listele, özet, payload, retry/cancel. /api/xi-queues.
import axios from "axios";
import { BASE_URL } from "../config.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  {
    name: "mip_list_xi_queue_messages",
    description:
      "XI Proxy > Queues: returns XI/PI queue messages (paginated). Can be filtered by status/qos/queueId/interfaceName/from/to. Used to find blocked messages and retry/cancel them.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Message status (e.g. blocked/error) — optional" },
        qos: { type: "string", description: "Quality of Service (e.g. EO/EOIO) — optional" },
        queueId: { type: "string", description: "Queue ID — optional" },
        interfaceName: { type: "string", description: "Interface name — optional" },
        from: { type: "string", description: "Start date — optional" },
        to: { type: "string", description: "End date — optional" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 25)" },
      },
      required: [],
    },
  },
  {
    name: "mip_get_xi_queue_summary",
    description: "XI Proxy > Queues summary: returns definedQueues, blockedQueues and per-status counts.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_get_xi_queue_payload",
    description: "Returns the payload of a specific XI queue message (by id).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "XI queue message ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_retry_xi_queue_message",
    description: "Re-queues a blocked/failed XI queue message for reprocessing (PATCH /{id}/retry). updated:true means it succeeded.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "XI queue message ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_cancel_xi_queue_message",
    description: "Cancels an XI queue message (PATCH /{id}/cancel). updated:true means it succeeded.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "XI queue message ID" } },
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
    return t("xi.messageRetried", { id: args.id, detail: JSON.stringify(res.data) }, "XI message retried (id {id}): {detail}");
  },

  mip_cancel_xi_queue_message: async (args, headers) => {
    const res = await axios.patch(`${BASE_URL}/api/xi-queues/${encodeURIComponent(args.id)}/cancel`, null, { headers });
    return t("xi.messageCancelled", { id: args.id, detail: JSON.stringify(res.data) }, "XI message cancelled (id {id}): {detail}");
  },
};

export default { tools, handlers };
