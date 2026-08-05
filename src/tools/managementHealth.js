import axios from "axios";
import { BASE_URL } from "../config.js";
import { saveFile } from "../util.js";
import { buildSystemHealthXlsx } from "../xlsx.js";

const tools = [
  // ─── Management: System Health & Test Connectivity ────────────────────────────
  {
    name: "mip_get_system_health",
    description:
      "System Health: MIP backend pod'larının anlık kaynak kullanımını döner — her pod için podName, cpuLoad (0-1 oran), memoryLoad (MB), inflightExchanges (işlenen mesaj sayısı). Salt-okunur.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_generate_system_health_report",
    description:
      "System Health verisinden detaylı bir rapor üretir. Anlık snapshot'ı birkaç kez örnekleyip (samples) her pod için CPU% ve bellek (MB) min/ort/maks + inflight değerlerini hesaplar, eşiklere göre değerlendirme (OK/UYARI) ile Markdown rapor döner. Not: bu instance'ta geçmiş (historical) veri yok; rapor kısa bir örnekleme penceresine dayanır.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Örnekleme sayısı (varsayılan 4, max 10)" },
        intervalMs: { type: "number", description: "Örnekler arası bekleme ms (varsayılan 800, max 3000)" },
      },
      required: [],
    },
  },
  {
    name: "mip_generate_system_health_excel",
    description:
      "System Health verisinden STANDART formatlı bir EXCEL (.xlsx) raporu üretir ve MIP_DOWNLOAD_DIR'e kaydeder. Sabit 2 sayfa: 'Ozet' (pod başına CPU%/bellek/inflight min-ort-maks + Durum) ve 'Ornekler' (ham örnekler). Şablon her çağrıda birebir aynıdır; yalnızca değerler değişir.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Örnekleme sayısı (varsayılan 5, max 10)" },
        intervalMs: { type: "number", description: "Örnekler arası bekleme ms (varsayılan 800, max 3000)" },
      },
      required: [],
    },
  },
  {
    name: "mip_test_connectivity",
    description:
      "Test Connectivity: MIP backend'inden verilen host:port hedefine bağlantı testi yapar (TCP/HTTP handshake, non-destructive). Sonuç: status (SUCCESS/UNREACHABLE), resultCode, duration, responsePayload.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Hedef host (IP veya alan adı)" },
        port: { type: "number", description: "Hedef port" },
        connectorType: { type: "string", description: "Opsiyonel bağlantı tipi (ör. TCP/HTTP)" },
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
