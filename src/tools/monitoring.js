import axios from "axios";
import { BASE_URL } from "../config.js";
import { saveFile, extractFilename } from "../util.js";
import { buildMonitoringReportXlsx } from "../xlsx.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  // ── Monitoring ──
  {
    name: "mip_download_logs",
    description: "Downloads MIP monitoring logs. Returns per-flow successful/error/delivering counts.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        type: {
          type: "string",
          description: "Log types, comma-separated: SUCCESS,ERROR,DELIVERING",
          default: "SUCCESS,ERROR,DELIVERING",
        },
        paginationPage: { type: "number", description: "Page number (optional)" },
        paginationSize: { type: "number", description: "Page size (optional)" },
        paginationSort: { type: "string", description: "Sort (optional, e.g. 'desc,flowId')" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_get_flow_message_logs",
    description:
      "Returns a flow's PER-MESSAGE logs with timestamps (the list that opens when you click a flow on the monitoring screen). " +
      "Each record: messageId, status, startDate/endDate (millisecond-precision timestamp), plus nodeId/errorMessage on ERROR records. " +
      "Use this for hourly volume/load analysis — mip_download_logs only gives totals and carries no time information. " +
      "IMPORTANT: 'type' accepts a SINGLE value (SUCCESS | ERROR | DELIVERING); passing a comma-separated list returns empty (204). Call it once per status and merge the results. " +
      "startDate/endDate filter at day granularity; for an hourly breakdown, bucket the returned records locally by their startDate field.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Flow ID (e.g. F_SAP_TO_ICE_EDONUSUM)" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        type: {
          type: "string",
          description: "A single status value",
          enum: ["SUCCESS", "ERROR", "DELIVERING"],
          default: "SUCCESS",
        },
        paginationPage: { type: "number", description: "Page number (0-based, optional)" },
        paginationSize: { type: "number", description: "Page size (optional, e.g. 1000)" },
        paginationSort: { type: "string", description: "Sort (optional, e.g. 'asc,startDate')" },
        filter: { type: "string", description: "Text filter (optional)" },
      },
      required: ["flowId", "startDate", "endDate"],
    },
  },
  {
    name: "mip_get_message_counts",
    description:
      "Returns the total successful/failed message count per time bucket (the dashboard message chart). " +
      "timeType selects the granularity: DAY, WEEK, MONTH or YEAR. HOURLY (HOUR) IS NOT SUPPORTED — use mip_get_flow_message_logs for an hourly breakdown. " +
      "Note: there is no startDate/endDate parameter; it returns the most recent buckets, as many as paginationSize.",
    inputSchema: {
      type: "object",
      properties: {
        timeType: {
          type: "string",
          description: "Bucket granularity",
          enum: ["DAY", "WEEK", "MONTH", "YEAR"],
          default: "DAY",
        },
        paginationSize: { type: "number", description: "Number of buckets to return (optional, e.g. 60)" },
      },
      required: ["timeType"],
    },
  },
  {
    name: "mip_get_message_completion_times",
    description:
      "The data behind the Monitoring > Performance-Monitoring screen: returns the message count and processing (completion) time per flow over a date range. " +
      "Useful for performance / slow-flow analysis (it carries no timestamps). filter searches within flowId/flowName/messageCount.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'" },
        endDate: { type: "string", description: "End date 'YYYY-MM-DD' or 'YYYY-MM-DD HH:mm'" },
        filter: { type: "string", description: "Optional: text occurring in flowId/flowName/messageCount" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        paginationSize: { type: "number", description: "Page size (optional)" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_generate_monitoring_report",
    description:
      "Fetches the monitoring messages in the given date (and optional time) range, produces a multi-sheet EXCEL (.xlsx) report and saves it to MIP_DOWNLOAD_DIR. " +
      "Sheets: Summary, Hour (hourly distribution + quietest/busiest hour), Day x Hour heat map, Flow x Hour heat map, Daily Total, Flow Summary. " +
      "Used to find the quietest hour for maintenance/upgrades, or for volume analysis. Timestamps are processed in MIP system time (raw); NO clock-offset correction is applied. " +
      "Note: if startTime/endTime are given, only the messages inside that time window of each day are counted.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        startTime: { type: "string", description: "Start of the daily time window (HH:MM, optional)" },
        endTime: { type: "string", description: "End of the daily time window (HH:MM, optional)" },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "Include only these flows (optional; empty = every flow active in the range)",
        },
        statuses: {
          type: "array",
          items: { type: "string", enum: ["SUCCESS", "ERROR", "DELIVERING"] },
          description: "Statuses to include (optional; default: all)",
        },
        fileName: { type: "string", description: "Output file name (optional; .xlsx is appended)" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_download_payload",
    description: "Downloads the payload of a specific messageId and saves it to a file.",
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
    description: "Downloads the payload of the log details by messageId and nodeId.",
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
    description: "Downloads an attachment by a specific attachment ID.",
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
    description: "Downloads every attachment of a messageId and nodeId as a zip.",
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
    description: "Downloads the system log file for a date range.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
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
          { flowId: args.flowId, type: params.type, content: [], totalElements: 0, note: t("monitoring.noRecords", null, "No records for these criteria (HTTP 204).") },
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
            process.stderr.write(t("monitoring.fetchFailed", { flow: f.id, type, message: e.message },
              "warning: could not fetch {flow}/{type}: {message}\n"));
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
        t("monitoring.excelCreated", { path: filePath }, "Excel report created: {path}"),
        t("monitoring.range", { start: startDate, end: endDate }, "Range: {start} → {end}") +
          (startTime || endTime
            ? t("monitoring.rangeWithTime", { startTime: startTime || "00:00", endTime: endTime || "23:59" }, " (time {startTime}-{endTime})")
            : ""),
        t("monitoring.totals", { total: grand, flows: meta.flowCount, statuses: wantStatuses.join(",") },
          "Total messages: {total} | Flow count: {flows} | Statuses: {statuses}"),
      ];
      if (quietest && busiest) {
        lines.push(t("monitoring.quietBusy", {
          quiet: `${String(quietest[0]).padStart(2, "0")}:00`, quietCount: quietest[1],
          busy: `${String(busiest[0]).padStart(2, "0")}:00`, busyCount: busiest[1],
        }, "Quietest hour: {quiet} ({quietCount}) | Busiest: {busy} ({busyCount})"));
      }
      if (truncated)
        lines.push(t("monitoring.truncated", null,
          "WARNING: the safety limit (2,000,000 records) was exceeded; the report is partial. Choose a narrower range."));
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
      return msg.downloaded("Payload", filePath);
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
      return msg.downloaded("Log detail payload", filePath);
    },

    mip_download_attachment_by_id: async (args, headers) => {
      const res = await axios.get(
        `${BASE_URL}/api/monitoring/attachments/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `attachment_${args.id}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return msg.downloaded("Attachment", filePath);
    },

    mip_download_all_attachments: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/monitoring/attachments/download`, {
        headers,
        params: { messageId: args.messageId, nodeId: args.nodeId },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `attachments_${args.messageId}.zip`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return msg.downloaded("Attachments", filePath);
    },

    mip_get_system_logs: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/monitoring/logs/system-logs-file`, {
        headers,
        params: { startDate: args.startDate, endDate: args.endDate },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `system_logs_${args.startDate}_${args.endDate}.log`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return msg.downloaded("System logs", filePath);
    },
};

export default { tools, handlers };
