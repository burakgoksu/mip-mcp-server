import axios from "axios";
import { BASE_URL } from "../config.js";
import { saveFile } from "../util.js";
import { buildSystemHealthXlsx } from "../xlsx.js";

const tools = [
  // ─── Management: System Health & Test Connectivity ────────────────────────────
  {
    name: "mip_get_system_health",
    description:
      "System Health: returns the current resource usage of the MIP backend pods — for each pod podName, cpuLoad (0-1 ratio), memoryLoad (MB), inflightExchanges (number of messages being processed). Read-only.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_generate_system_health_report",
    description:
      "Produces a detailed report from System Health data. Samples the live snapshot several times (samples) and computes min/avg/max CPU% and memory (MB) plus inflight values per pod, returning a Markdown report with a threshold-based assessment (OK/WARNING). Note: this instance has no historical data; the report is based on a short sampling window.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Number of samples (default 4, max 10)" },
        intervalMs: { type: "number", description: "Wait between samples in ms (default 800, max 3000)" },
      },
      required: [],
    },
  },
  {
    name: "mip_generate_system_health_excel",
    description:
      "Produces a STANDARD-format EXCEL (.xlsx) report from System Health data and saves it to MIP_DOWNLOAD_DIR. Always 2 sheets: 'Summary' (per-pod CPU%/memory/inflight min-avg-max + Status) and 'Samples' (raw samples). The template is identical on every call; only the values change.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Number of samples (default 5, max 10)" },
        intervalMs: { type: "number", description: "Wait between samples in ms (default 800, max 3000)" },
      },
      required: [],
    },
  },
  {
    name: "mip_test_connectivity",
    description:
      "Test Connectivity: runs a connection test from the MIP backend to the given host:port (TCP/HTTP handshake, non-destructive). Result: status (SUCCESS/UNREACHABLE), resultCode, duration, responsePayload.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Target host (IP or domain name)" },
        port: { type: "number", description: "Target port" },
        connectorType: { type: "string", description: "Optional connection type (e.g. TCP/HTTP)" },
      },
      required: ["host", "port"],
    },
  },
];

const handlers = {
    // ─── Management: System Health & Test Connectivity ──────────────────────────
    mip_get_system_health: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/backend-system-statics`, { headers });
      return JSON.stringify(res.data?.data ?? res.data, null, 2);
    },

    mip_generate_system_health_report: async (args, headers) => {
      const samples = Math.min(Math.max(args.samples ?? 4, 1), 10);
      const intervalMs = Math.min(Math.max(args.intervalMs ?? 800, 0), 3000);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const pods = {}; // podName -> { cpu:[], mem:[], inflight:[] }
      for (let i = 0; i < samples; i++) {
        const res = await axios.get(`${BASE_URL}/api/backend-system-statics`, { headers });
        const rows = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
        for (const p of rows) {
          const k = p.podName ?? "unknown";
          (pods[k] ??= { cpu: [], mem: [], inflight: [] });
          pods[k].cpu.push(Number(p.cpuLoad));
          pods[k].mem.push(Number(p.memoryLoad));
          pods[k].inflight.push(Number(p.inflightExchanges));
        }
        if (i < samples - 1) await sleep(intervalMs);
      }
      const stat = (a) => {
        const v = a.filter((x) => Number.isFinite(x));
        if (!v.length) return { min: 0, avg: 0, max: 0 };
        return { min: Math.min(...v), avg: v.reduce((s, x) => s + x, 0) / v.length, max: Math.max(...v) };
      };
      const pct = (x) => `${(x * 100).toFixed(2)}%`;
      const mb = (x) => `${x.toFixed(0)} MB (${(x / 1024).toFixed(2)} GB)`;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      let md = `# MIP System Health Raporu\n\n`;
      md += `**Zaman:** ${ts}  |  **Örnekleme:** ${samples} örnek × ${intervalMs}ms  |  **Pod sayısı:** ${Object.keys(pods).length}\n\n`;
      for (const [name, d] of Object.entries(pods)) {
        const c = stat(d.cpu), m = stat(d.mem), f = stat(d.inflight);
        const cpuWarn = c.max > 0.8 ? " ⚠️ YÜKSEK" : c.max > 0.5 ? " ⚠️" : " ✅";
        md += `## Pod: ${name}\n\n`;
        md += `| Metrik | Min | Ortalama | Maks | Durum |\n|---|---|---|---|---|\n`;
        md += `| CPU | ${pct(c.min)} | ${pct(c.avg)} | ${pct(c.max)} |${cpuWarn} |\n`;
        md += `| Bellek | ${mb(m.min)} | ${mb(m.avg)} | ${mb(m.max)} | ${m.max / 1024 > 8 ? "⚠️" : "✅"} |\n`;
        md += `| Inflight Exchanges | ${f.min} | ${f.avg.toFixed(1)} | ${f.max} | ${f.max > 1000 ? "⚠️ yoğun" : "✅"} |\n\n`;
      }
      md += `_Not: Bu MIP instance'ında geçmiş (historical) health verisi mevcut değil; rapor yukarıdaki kısa örnekleme penceresine dayanır._\n`;
      return md;
    },

    mip_generate_system_health_excel: async (args, headers) => {
      const samples = Math.min(Math.max(args.samples ?? 5, 1), 10);
      const intervalMs = Math.min(Math.max(args.intervalMs ?? 800, 0), 3000);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const pods = {};
      const sampleRows = [];
      for (let i = 0; i < samples; i++) {
        const res = await axios.get(`${BASE_URL}/api/backend-system-statics`, { headers });
        const rows = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
        for (const p of rows) {
          const k = p.podName ?? "unknown";
          (pods[k] ??= { cpu: [], mem: [], inflight: [] });
          const cpu = Number(p.cpuLoad), mem = Number(p.memoryLoad), inflight = Number(p.inflightExchanges);
          pods[k].cpu.push(cpu);
          pods[k].mem.push(mem);
          pods[k].inflight.push(inflight);
          sampleRows.push({ sample: i + 1, pod: k, cpu, mem, inflight });
        }
        if (i < samples - 1) await sleep(intervalMs);
      }
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const fnTs = ts.replace(/[: ]/g, "-");
      const buffer = await buildSystemHealthXlsx(pods, sampleRows, { ts, samples, intervalMs });
      const filePath = saveFile(buffer, `MIP_System_Health_${fnTs}.xlsx`);
      return `System Health Excel raporu oluşturuldu (${samples} örnek, ${Object.keys(pods).length} pod): ${filePath}`;
    },

    mip_test_connectivity: async (args, headers) => {
      const body = { host: args.host, port: args.port };
      if (args.connectorType) body.connectorType = args.connectorType;
      const res = await axios.put(`${BASE_URL}/api/test-connectivity`, body, { headers });
      return JSON.stringify(res.data?.data ? { ...res.data.data, message: res.data.message } : res.data, null, 2);
    },
};

export default { tools, handlers };
