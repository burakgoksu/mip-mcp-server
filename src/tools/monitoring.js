import axios from "axios";
import { BASE_URL } from "../config.js";
import { saveFile, extractFilename } from "../util.js";
import { buildMonitoringReportXlsx } from "../xlsx.js";

const tools = [
  // ── Monitoring ──
  {
    name: "mip_download_logs",
    description: "MIP monitoring loglarını indirir. Flow bazlı successful/error/delivering sayılarını döner.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
        type: {
          type: "string",
          description: "Log tipleri, virgülle ayrılmış: SUCCESS,ERROR,DELIVERING",
          default: "SUCCESS,ERROR,DELIVERING",
        },
        paginationPage: { type: "number", description: "Sayfa numarası (opsiyonel)" },
        paginationSize: { type: "number", description: "Sayfa boyutu (opsiyonel)" },
        paginationSort: { type: "string", description: "Sıralama (opsiyonel, örn: 'desc,flowId')" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_get_flow_message_logs",
    description:
      "Bir flow'un MESAJ-BAZLI loglarını zaman damgasıyla döner (monitoring ekranında flow'a tıklayınca açılan liste). " +
      "Her kayıt: messageId, status, startDate/endDate (milisaniye hassasiyetli timestamp), ERROR kayıtlarında ayrıca nodeId/errorMessage. " +
      "Saat-bazlı hacim/yoğunluk analizi için bunu kullanın — mip_download_logs yalnızca toplam sayı verir, zaman bilgisi içermez. " +
      "ÖNEMLİ: 'type' TEK değer kabul eder (SUCCESS | ERROR | DELIVERING); virgüllü/çoklu verince boş (204) döner. Tüm statüler için ayrı ayrı çağırıp birleştirin. " +
      "startDate/endDate gün seviyesinde filtreler; saatlik kırılım için dönen kayıtların startDate alanından lokal olarak bucket'layın.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Flow ID (örn: F_SAP_TO_ICE_EDONUSUM)" },
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
        type: {
          type: "string",
          description: "Tek statü değeri",
          enum: ["SUCCESS", "ERROR", "DELIVERING"],
          default: "SUCCESS",
        },
        paginationPage: { type: "number", description: "Sayfa numarası (0 tabanlı, opsiyonel)" },
        paginationSize: { type: "number", description: "Sayfa boyutu (opsiyonel, örn: 1000)" },
        paginationSort: { type: "string", description: "Sıralama (opsiyonel, örn: 'asc,startDate')" },
        filter: { type: "string", description: "Metin filtresi (opsiyonel)" },
      },
      required: ["flowId", "startDate", "endDate"],
    },
  },
  {
    name: "mip_get_message_counts",
    description:
      "Zaman bucket'larına göre toplam başarılı/hatalı mesaj sayısını döner (dashboard mesaj grafiği). " +
      "timeType ile granülarite seçilir: DAY, WEEK, MONTH veya YEAR. SAATLİK (HOUR) DESTEKLENMEZ — saatlik kırılım için mip_get_flow_message_logs kullanın. " +
      "Not: startDate/endDate parametresi yoktur; paginationSize kadar en güncel bucket döner.",
    inputSchema: {
      type: "object",
      properties: {
        timeType: {
          type: "string",
          description: "Bucket granülaritesi",
          enum: ["DAY", "WEEK", "MONTH", "YEAR"],
          default: "DAY",
        },
        paginationSize: { type: "number", description: "Döndürülecek bucket sayısı (opsiyonel, örn: 60)" },
      },
      required: ["timeType"],
    },
  },
  {
    name: "mip_get_message_completion_times",
    description:
      "Monitoring > Performance-Monitoring ekranının verisi: tarih aralığında flow başına mesaj sayısını ve işlem (completion) süresini döner. " +
      "Performans/yavaş flow analizi için kullanışlıdır (zaman damgası içermez). filter ile flowId/flowName/messageCount içinde arama yapılabilir.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi 'YYYY-MM-DD' veya 'YYYY-MM-DD HH:mm'" },
        endDate: { type: "string", description: "Bitiş tarihi 'YYYY-MM-DD' veya 'YYYY-MM-DD HH:mm'" },
        filter: { type: "string", description: "Opsiyonel: flowId/flowName/messageCount içinde geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        paginationSize: { type: "number", description: "Sayfa boyutu (opsiyonel)" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_generate_monitoring_report",
    description:
      "Belirtilen tarih (ve opsiyonel saat) aralığındaki monitoring mesajlarını çekip çok sayfalı bir EXCEL (.xlsx) raporu üretir ve MIP_DOWNLOAD_DIR'e kaydeder. " +
      "Sayfalar: Özet, Saat (saat-bazlı dağılım + en sakin/yoğun saat), Gün x Saat ısı haritası, Flow x Saat ısı haritası, Günlük Toplam, Flow Özet. " +
      "Bakım/güncelleme için en sakin saati bulmak ya da hacim analizi için kullanılır. Saat damgaları MIP sistem saatiyle (ham) işlenir, saat kayması düzeltmesi UYGULANMAZ. " +
      "Not: startTime/endTime verilirse her gün içinde yalnızca o saat penceresindeki mesajlar sayılır.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
        startTime: { type: "string", description: "Günlük saat penceresi başlangıcı (HH:MM, opsiyonel)" },
        endTime: { type: "string", description: "Günlük saat penceresi bitişi (HH:MM, opsiyonel)" },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "Yalnızca bu flow'ları dahil et (opsiyonel; boş = aralıkta aktif tüm flow'lar)",
        },
        statuses: {
          type: "array",
          items: { type: "string", enum: ["SUCCESS", "ERROR", "DELIVERING"] },
          description: "Dahil edilecek statüler (opsiyonel; varsayılan: hepsi)",
        },
        fileName: { type: "string", description: "Çıktı dosya adı (opsiyonel; .xlsx eklenir)" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_download_payload",
    description: "Belirli bir messageId'ye ait payload'ı indirir ve dosyaya kaydeder.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Message ID" },
        isPayloadOut: { type: "boolean", description: "true = payload out, false = payload in" },
      },
      required: ["messageId", "isPayloadOut"],
    },
  },
  {
    name: "mip_download_log_details_payload",
    description: "Log detaylarına ait payload'ı messageId ve nodeId ile indirir.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Message ID" },
        nodeId: { type: "string", description: "Node ID" },
        isPayloadOut: { type: "boolean", description: "true = payload out, false = payload in" },
      },
      required: ["messageId", "nodeId", "isPayloadOut"],
    },
  },
  {
    name: "mip_download_attachment_by_id",
    description: "Belirli bir attachment ID'si ile attachment indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Attachment ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_download_all_attachments",
    description: "messageId ve nodeId'ye ait tüm attachment'ları zip olarak indirir.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Message ID" },
        nodeId: { type: "string", description: "Node ID" },
      },
      required: ["messageId", "nodeId"],
    },
  },
  {
    name: "mip_get_system_logs",
    description: "Sistem log dosyasını tarih aralığına göre indirir.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
      },
      required: ["startDate", "endDate"],
    },
  },
];

const handlers = {
    // ── Monitoring ──────────────────────────────────────────────────────────
    mip_download_logs: async (args, headers) => {
      const params = {
        startDate: args.startDate,
        endDate: args.endDate,
        type: args.type ?? "SUCCESS,ERROR,DELIVERING",
      };
      if (args.paginationPage !== undefined) params.paginationPage = args.paginationPage;
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      if (args.paginationSort !== undefined) params.paginationSort = args.paginationSort;

      const res = await axios.get(`${BASE_URL}/api/monitoring/logs`, {
        headers,
        params,
      });
      return JSON.stringify(res.data, null, 2);
    },

    mip_get_flow_message_logs: async (args, headers) => {
      const params = {
        startDate: args.startDate,
        endDate: args.endDate,
        type: args.type ?? "SUCCESS",
      };
      if (args.paginationPage !== undefined) params.paginationPage = args.paginationPage;
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      if (args.paginationSort !== undefined) params.paginationSort = args.paginationSort;
      if (args.filter !== undefined) params.filter = args.filter;

      const res = await axios.get(
        `${BASE_URL}/api/monitoring/flows/${encodeURIComponent(args.flowId)}/logs`,
        { headers, params }
      );
      // 204 = bu kriterlerde kayıt yok (axios bunu hata saymaz, res.data boş gelir)
      if (res.status === 204 || !res.data) {
        return JSON.stringify(
          { flowId: args.flowId, type: params.type, content: [], totalElements: 0, note: "Bu kriterlerde kayıt yok (HTTP 204)." },
          null,
          2
        );
      }
      return JSON.stringify(res.data, null, 2);
    },

    mip_get_message_counts: async (args, headers) => {
      const params = { timeType: args.timeType ?? "DAY" };
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      const res = await axios.get(`${BASE_URL}/api/message-counts`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_get_message_completion_times: async (args, headers) => {
      const params = {
        startDate: args.startDate,
        endDate: args.endDate,
        paginationPage: (args.page ?? 1) - 1,
      };
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: ["flowId", "flowName", "messageCount"].map((k) => ({
            filterKey: k,
            operation: "cn",
            value: args.filter,
          })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/monitoring/logs/message-completion-times`, {
        headers,
        params,
      });
      return JSON.stringify(res.data, null, 2);
    },

    mip_generate_monitoring_report: async (args, headers) => {
      const { startDate, endDate } = args;
      const startTime = args.startTime || null;
      const endTime = args.endTime || null;
      const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
      const tMin = startTime ? toMin(startTime) : null;
      const tMax = endTime ? toMin(endTime) : null;

      // 1) aralıktaki flow listesi + statü sayıları
      const aggRes = await axios.get(`${BASE_URL}/api/monitoring/logs`, {
        headers,
        params: { startDate, endDate, paginationSize: 500 },
      });
      let flows = (aggRes.data?.content || []).map((f) => ({ id: f.flowId, s: f.successful, e: f.error, d: f.delivering }));
      if (Array.isArray(args.flowIds) && args.flowIds.length) {
        const set = new Set(args.flowIds);
        flows = flows.filter((f) => set.has(f.id));
      }
      const wantStatuses = Array.isArray(args.statuses) && args.statuses.length
        ? args.statuses
        : ["SUCCESS", "ERROR", "DELIVERING"];

      // 2) topla
      const hour = Array.from({ length: 24 }, () => ({ s: 0, e: 0, d: 0 }));
      const byDate = {}, dateHour = {}, flowHour = {}, flowTotals = {};
      let grand = 0, pulled = 0, truncated = false;
      const PAGE = 1000, SAFETY = 2000000;

      for (const f of flows) {
        const jobs = [];
        if (f.s > 0 && wantStatuses.includes("SUCCESS")) jobs.push("SUCCESS");
        if (f.e > 0 && wantStatuses.includes("ERROR")) jobs.push("ERROR");
        if (f.d > 0 && wantStatuses.includes("DELIVERING")) jobs.push("DELIVERING");
        for (const type of jobs) {
          let page = 0, got = 0, total = null;
          try {
            while (true) {
              const r = await axios.get(
                `${BASE_URL}/api/monitoring/flows/${encodeURIComponent(f.id)}/logs`,
                {
                  headers,
                  params: { startDate, endDate, type, paginationPage: page, paginationSize: PAGE, paginationSort: "asc,startDate" },
                  validateStatus: (s) => s === 200 || s === 204,
                }
              );
              if (r.status === 204 || !r.data || !Array.isArray(r.data.content) || r.data.content.length === 0) break;
              if (total === null) total = r.data.totalElements;
              for (const m of r.data.content) {
                const ts = m.startDate;
                if (!ts || ts.length < 16) continue;
                const hh = parseInt(ts.slice(11, 13), 10);
                const mm = parseInt(ts.slice(14, 16), 10);
                if (Number.isNaN(hh)) continue;
                if (tMin != null || tMax != null) {
                  const cur = hh * 60 + (Number.isNaN(mm) ? 0 : mm);
                  if (tMin != null && cur < tMin) continue;
                  if (tMax != null && cur > tMax) continue;
                }
                const date = ts.slice(0, 10);
                const k = m.status === "SUCCESS" ? "s" : m.status === "ERROR" ? "e" : "d";
                hour[hh][k]++;
                byDate[date] = (byDate[date] || 0) + 1;
                (dateHour[date] ||= Array(24).fill(0))[hh]++;
                (flowHour[f.id] ||= Array(24).fill(0))[hh]++;
                const ft = (flowTotals[f.id] ||= { s: 0, e: 0, d: 0 }); ft[k]++;
                grand++;
              }
              got += r.data.content.length;
              pulled += r.data.content.length;
              if (pulled >= SAFETY) { truncated = true; break; }
              if (got >= (total ?? got) || r.data.last) break;
              page++;
            }
          } catch (e) {
            process.stderr.write(`uyarı: ${f.id}/${type} çekilemedi: ${e.message}\n`);
          }
          if (truncated) break;
        }
        if (truncated) break;
      }

      // 3) xlsx üret + kaydet
      const meta = {
        startDate, endDate, startTime, endTime,
        flowCount: Object.keys(flowTotals).length,
        statuses: wantStatuses, grandTotal: grand, truncated,
      };
      const buf = await buildMonitoringReportXlsx({ hour, byDate, dateHour, flowHour, flowTotals, grandTotal: grand }, meta);
      let fileName = (args.fileName || `MIP_Monitoring_Raporu_${startDate}_${endDate}`).replace(/[^\w.\-]/g, "_");
      if (!fileName.toLowerCase().endsWith(".xlsx")) fileName += ".xlsx";
      const filePath = saveFile(buf, fileName);

      const totals = hour.map((h) => h.s + h.e + h.d);
      const nz = totals.map((t, i) => [i, t]).filter((x) => x[1] > 0).sort((a, b) => a[1] - b[1]);
      const quietest = nz[0], busiest = nz[nz.length - 1];
      const lines = [
        `Excel raporu oluşturuldu: ${filePath}`,
        `Aralık: ${startDate} → ${endDate}` + (startTime || endTime ? ` (saat ${startTime || "00:00"}-${endTime || "23:59"})` : ""),
        `Toplam mesaj: ${grand} | Flow sayısı: ${meta.flowCount} | Statüler: ${wantStatuses.join(",")}`,
      ];
      if (quietest && busiest) {
        lines.push(`En sakin saat: ${String(quietest[0]).padStart(2, "0")}:00 (${quietest[1]}) | En yoğun: ${String(busiest[0]).padStart(2, "0")}:00 (${busiest[1]})`);
      }
      if (truncated) lines.push("UYARI: Güvenlik limiti (2.000.000 kayıt) aşıldı; rapor kısmi. Daha dar aralık seçin.");
      return lines.join("\n");
    },

    mip_download_payload: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/monitoring/logs/download-payload`, {
        headers,
        params: { messageId: args.messageId, isPayloadOut: args.isPayloadOut },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `payload_${args.messageId}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Payload indirildi: ${filePath}`;
    },

    mip_download_log_details_payload: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/monitoring/log-details/download-payload`, {
        headers,
        params: {
          messageId: args.messageId,
          nodeId: args.nodeId,
          isPayloadOut: args.isPayloadOut,
        },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `log_details_${args.messageId}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Log detay payload indirildi: ${filePath}`;
    },

    mip_download_attachment_by_id: async (args, headers) => {
      const res = await axios.get(
        `${BASE_URL}/api/monitoring/attachments/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `attachment_${args.id}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Attachment indirildi: ${filePath}`;
    },

    mip_download_all_attachments: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/monitoring/attachments/download`, {
        headers,
        params: { messageId: args.messageId, nodeId: args.nodeId },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `attachments_${args.messageId}.zip`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Attachment'lar indirildi: ${filePath}`;
    },

    mip_get_system_logs: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/monitoring/logs/system-logs-file`, {
        headers,
        params: { startDate: args.startDate, endDate: args.endDate },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `system_logs_${args.startDate}_${args.endDate}.log`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Sistem logları indirildi: ${filePath}`;
    },
};

export default { tools, handlers };
