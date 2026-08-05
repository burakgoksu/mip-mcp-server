import axios from "axios";
import { HEALTH_BASE } from "../config.js";

const tools = [
  // ─── Alert Configurations (Operations > Alert Configurations) ─────────────────
  // System-health uyarı yapılandırması: mail alıcıları, bileşen eşik kuralları,
  // cron sıklıkları. /healthcheck-service servisi üzerinden.
  {
    name: "mip_list_alert_config_emails",
    description: "Alert Configurations > Alert Mail Receivers: uyarı maillerinin gönderileceği e-posta adreslerini listeler ([{id,email}]).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_add_alert_config_email",
    description: "Alert Configurations: uyarı mail alıcısı ekler.",
    inputSchema: {
      type: "object",
      properties: { email: { type: "string", description: "Eklenecek e-posta adresi" } },
      required: ["email"],
    },
  },
  {
    name: "mip_remove_alert_config_email",
    description: "Alert Configurations: uyarı mail alıcısını id ile kaldırır (mip_list_alert_config_emails ile alınır).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Silinecek mail alıcısı ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_get_alert_rules",
    description:
      "Alert Configurations > Alert Rules: her bileşen için eşik kurallarını döner (componentKey, displayName, cpuThresholdPercent, ramThresholdPercent, diskThresholdPercent, responseTimeThresholdMs, dbSizeThresholdGb, connectionPoolThresholdPercent).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_update_alert_rules",
    description:
      "Alert Configurations: bir veya daha fazla bileşenin eşik kuralını günceller. rules dizisindeki her öğe componentKey ile eşleşen mevcut kuralın üstüne merge edilir (verilmeyen eşikler korunur). Sadece değiştireceğin bileşenleri ver.",
    inputSchema: {
      type: "object",
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              componentKey: { type: "string", description: "Bileşen anahtarı (ör. backend-http, elasticsearch-db, activemq, postgres-db, redis, system, frontend-http)" },
              cpuThresholdPercent: { type: "number", description: "CPU eşiği % (opsiyonel)" },
              ramThresholdPercent: { type: "number", description: "RAM eşiği % (opsiyonel)" },
              diskThresholdPercent: { type: "number", description: "Disk eşiği % (opsiyonel)" },
              responseTimeThresholdMs: { type: "number", description: "Yanıt süresi eşiği ms (opsiyonel)" },
              dbSizeThresholdGb: { type: "number", description: "DB boyut eşiği GB (opsiyonel)" },
              connectionPoolThresholdPercent: { type: "number", description: "Bağlantı havuzu eşiği % (opsiyonel)" },
            },
            required: ["componentKey"],
          },
          description: "Güncellenecek kurallar",
        },
      },
      required: ["rules"],
    },
  },
  {
    name: "mip_get_cron_frequency",
    description: "Alert Configurations > Cron Frequency: her bileşenin health-check cron sıklığını döner ([{componentName, cronValue}]).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_update_cron_frequency",
    description:
      "Alert Configurations: bir veya daha fazla bileşenin health-check cron sıklığını günceller. crons dizisindeki her öğe componentName ile eşleşeni günceller (diğerleri korunur).",
    inputSchema: {
      type: "object",
      properties: {
        crons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              componentName: { type: "string", description: "Bileşen adı (ör. backend-http, postgres-db, redis, system, activemq, elasticsearch-db, frontend-http)" },
              cronValue: { type: "string", description: "Cron ifadesi (ör. '0 */30 * * * *')" },
            },
            required: ["componentName", "cronValue"],
          },
          description: "Güncellenecek cron'lar",
        },
      },
      required: ["crons"],
    },
  },
];

const handlers = {
    // ─── Alert Configurations (/healthcheck-service) ────────────────────────────
    mip_list_alert_config_emails: async (args, headers) => {
      const res = await axios.get(`${HEALTH_BASE}/api/email-alerts`, { headers });
      return JSON.stringify(res.data, null, 2);
    },

    mip_add_alert_config_email: async (args, headers) => {
      const res = await axios.post(`${HEALTH_BASE}/api/email-alerts`, JSON.stringify({ email: args.email }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      return `Alert mail alıcısı eklendi (${args.email}): ${JSON.stringify(res.data)}`;
    },

    mip_remove_alert_config_email: async (args, headers) => {
      const res = await axios.delete(`${HEALTH_BASE}/api/email-alerts/${args.id}`, { headers });
      return `Alert mail alıcısı silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    },

    mip_get_alert_rules: async (args, headers) => {
      const res = await axios.get(`${HEALTH_BASE}/api/alert-rules`, { headers });
      return JSON.stringify(res.data, null, 2);
    },

    mip_update_alert_rules: async (args, headers) => {
      // Mevcut kuralları çek, verilen değişiklikleri componentKey ile merge et, TAM diziyi PUT'la.
      const cur = await axios.get(`${HEALTH_BASE}/api/alert-rules`, { headers });
      const existing = Array.isArray(cur.data) ? cur.data : [];
      const byKey = new Map(existing.map((r) => [r.componentKey, r]));
      for (const upd of args.rules) {
        const base = byKey.get(upd.componentKey);
        if (!base) throw new Error(`Bileşen bulunamadı: ${upd.componentKey}. Geçerli: ${[...byKey.keys()].join(", ")}`);
        byKey.set(upd.componentKey, { ...base, ...upd });
      }
      const merged = [...byKey.values()];
      const res = await axios.put(`${HEALTH_BASE}/api/alert-rules/multiple-component`, JSON.stringify(merged), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      return `Alert rules güncellendi (${args.rules.map((r) => r.componentKey).join(", ")}): ${JSON.stringify(res.data)}`;
    },

    mip_get_cron_frequency: async (args, headers) => {
      const res = await axios.get(`${HEALTH_BASE}/api/cron-frequency`, { headers });
      return JSON.stringify(res.data, null, 2);
    },

    mip_update_cron_frequency: async (args, headers) => {
      const cur = await axios.get(`${HEALTH_BASE}/api/cron-frequency`, { headers });
      const existing = Array.isArray(cur.data) ? cur.data : [];
      const byName = new Map(existing.map((c) => [c.componentName, c]));
      for (const upd of args.crons) {
        const base = byName.get(upd.componentName);
        if (!base) throw new Error(`Bileşen bulunamadı: ${upd.componentName}. Geçerli: ${[...byName.keys()].join(", ")}`);
        byName.set(upd.componentName, { ...base, ...upd });
      }
      const merged = [...byName.values()];
      const res = await axios.put(`${HEALTH_BASE}/api/cron-frequency/multiple-component`, JSON.stringify(merged), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      return `Cron frequency güncellendi (${args.crons.map((c) => c.componentName).join(", ")}): ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
