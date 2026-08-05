import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Search Message (Monitoring > Search-Message) ─────────────────────────────
  // Message search rule'ların çıkardığı değere göre mesaj arama (2. aşama).
  {
    name: "mip_search_messages",
    description:
      "Monitoring > Search-Message: bir flow'un message search rule'larının çıkardığı değere göre mesajları arar. resultValue verilirse o değere (regex) uyan mesajlar; boş bırakılırsa tarih aralığındaki tüm mesajlar döner. Her sonuç: messageId, createdDate, resultValue, status, messageSearchRuleId.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Aranacak flow ID (rule tanımlı olmalı; ör. F_SAP_TO_ICE_EDONUSUM)" },
        resultValue: {
          type: "string",
          description: "Aranan değer (regex). Boş/verilmezse aralıktaki tüm mesajlar döner.",
        },
        ruleIds: {
          type: "array",
          items: { type: "number" },
          description: "Aranacak message search rule ID'leri. Verilmezse flow'un tüm ETKİN kuralları kullanılır.",
        },
        startDate: {
          type: "string",
          description: "Başlangıç tarihi 'YYYY-MM-DD HH:mm' formatında. Verilmezse son 24 saat.",
        },
        endDate: {
          type: "string",
          description: "Bitiş tarihi 'YYYY-MM-DD HH:mm' formatında. Verilmezse şimdi.",
        },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 25)" },
      },
      required: ["flowId"],
    },
  },
];

const handlers = {
    // ─── Search Message ─────────────────────────────────────────────────────────
    mip_search_messages: async (args, headers) => {
      // ruleIds verilmediyse flow'un tüm etkin kurallarını kullan.
      let ruleIds = args.ruleIds;
      if (!ruleIds || ruleIds.length === 0) {
        const rulesRes = await axios.get(`${BASE_URL}/api/message-search-rules`, {
          headers,
          params: { paginationPage: 0, paginationSize: 500 },
        });
        ruleIds = (rulesRes.data?.content ?? [])
          .filter((r) => r.flowId === args.flowId && r.isEnabled)
          .map((r) => r.id);
        if (ruleIds.length === 0) {
          throw new Error(
            `'${args.flowId}' için etkin message search rule yok. Önce mip_create_message_search_rule ile kural ekleyip isEnabled=true yapın veya ruleIds belirtin.`
          );
        }
      }

      // Tarih aralığı: verilmezse son 24 saat. Format 'YYYY-MM-DD HH:mm'.
      const pad = (n) => String(n).padStart(2, "0");
      const fmt = (d) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const now = new Date();
      const endDate = args.endDate ?? fmt(now);
      const startDate = args.startDate ?? fmt(new Date(now.getTime() - 24 * 60 * 60 * 1000));

      const resultValue = args.resultValue ?? "";
      // Kural filtresi base64: seçili kural id'leri, operation "re" (regex), value = aranan değer.
      const criteria = {
        dataOption: "any",
        searchCriteriaList: ruleIds.map((id) => ({ filterKey: String(id), operation: "re", value: resultValue })),
      };
      const ruleFilter = Buffer.from(JSON.stringify(criteria)).toString("base64");

      // ÖNEMLİ: resultValueRegex ve messagesearchrulelistfilter QUERY değil HEADER olarak gönderilir.
      const res = await axios.get(
        `${BASE_URL}/api/flows/${args.flowId}/message-search-rules/message-ids`,
        {
          headers: {
            ...headers,
            resultValueRegex: resultValue,
            messagesearchrulelistfilter: ruleFilter,
          },
          params: {
            startDate,
            endDate,
            paginationPage: (args.page ?? 1) - 1,
            paginationSize: args.size ?? 25,
          },
        }
      );
      return JSON.stringify(res.data, null, 2);
    },
};

export default { tools, handlers };
