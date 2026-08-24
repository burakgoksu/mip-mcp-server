import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Alerts (Integrations > Alerts) ───────────────────────────────────────────
  // Alert CRUD: /api/alerts. SMTP ayarları: /api/alerts/mail-config.
  {
    name: "mip_list_alerts",
    description:
      "E-posta alert listesini döner. Her alert: alertName, alertMailList (alıcılar), postingFrequency (cron) + postingFrequencyDesc (okunur açıklama), alertBodyType, integrationFlows. Sayfalıdır. filter alertName üzerinde arar.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: alert adında geçen metin" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_alert",
    description:
      "Yeni e-posta alert'i oluşturur. Belirtilen flow'lar için postingFrequency (cron) zamanında alertMailList adreslerine mail gönderir. Template isteğe bağlıdır: useTemplate=true ise alertTemplate (inline HTML/metin içerik) ve alertBodyType zorunludur. Not: mail gönderimi için önce mip_save_alert_mail_config ile SMTP ayarlanmalıdır.",
    inputSchema: {
      type: "object",
      properties: {
        alertName: { type: "string", description: "Alert adı (benzersiz)" },
        alertMailList: {
          type: "string",
          description: "Alıcı e-posta adres(ler)i (virgülle ayrılabilir)",
        },
        postingFrequency: {
          type: "string",
          description: "Gönderim zamanlaması, cron ifadesi (ör. '0 0 8 * * ?' = her gün 08:00)",
        },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "Alert'in kapsadığı flow ID listesi (en az 1). Ör. ['F_CALCULATOR_EGITIM']",
        },
        useTemplate: {
          type: "boolean",
          description: "Özel şablon kullanılsın mı (varsayılan false). true ise alertTemplate + alertBodyType zorunlu.",
        },
        alertTemplate: {
          type: "string",
          description: "Şablon içeriği (inline HTML/metin). useTemplate=true ise zorunlu.",
        },
        alertBodyType: {
          type: "string",
          enum: ["HTML", "JSON", "CSV", "XML", "TEXT"],
          description: "Şablon tipi. useTemplate=true ise zorunlu.",
        },
      },
      required: ["alertName", "alertMailList", "postingFrequency", "flowIds"],
    },
  },
  {
    name: "mip_update_alert",
    description:
      "Mevcut bir alert'i günceller. id (alertId) zorunlu; verilen alanlar mevcut kaydın üstüne merge edilir (diğerleri korunur).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek alertId (mip_list_alerts ile alınır)" },
        alertName: { type: "string", description: "New name (optional)" },
        alertMailList: { type: "string", description: "Yeni alıcı listesi (opsiyonel)" },
        postingFrequency: { type: "string", description: "Yeni cron zamanlaması (opsiyonel)" },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "Yeni flow ID listesi (opsiyonel; verilirse mevcut listenin yerini alır)",
        },
        useTemplate: { type: "boolean", description: "Şablon açık/kapalı (opsiyonel)" },
        alertTemplate: { type: "string", description: "Yeni şablon içeriği (opsiyonel)" },
        alertBodyType: {
          type: "string",
          enum: ["HTML", "JSON", "CSV", "XML", "TEXT"],
          description: "Yeni şablon tipi (opsiyonel)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_alert",
    description: "Belirli bir alert'i siler.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Silinecek alertId" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_get_alert_mail_config",
    description: "Alert e-postaları için tanımlı SMTP ayarını döner (yoksa boş).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_save_alert_mail_config",
    description:
      "Alert e-postaları için SMTP ayarını kaydeder/günceller. authentication NONE değilse credentialId zorunludur (SMTP kullanıcı/parolasını tutan MIP credential).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Gönderen e-posta adresi (ör. alerts@example.com)" },
        address: { type: "string", description: "SMTP sunucu adresi (ör. smtp.gmail.com)" },
        port: { type: "number", description: "SMTP portu (varsayılan 587)" },
        connectionTimeout: { type: "number", description: "Bağlantı zaman aşımı ms (varsayılan 15000)" },
        readTimeout: { type: "number", description: "Okuma zaman aşımı ms (varsayılan 60000)" },
        writeTimeout: { type: "number", description: "Yazma zaman aşımı ms (varsayılan 60000)" },
        authentication: {
          type: "string",
          enum: ["NONE", "LOGIN", "PLAIN", "CRAM_MD5", "XOAUTH2"],
          description: "Kimlik doğrulama yöntemi (varsayılan LOGIN)",
        },
        credentialId: {
          type: "string",
          description: "SMTP kimlik bilgisini tutan MIP credential ID (authentication NONE değilse zorunlu)",
        },
        encryption: {
          type: "string",
          enum: ["NONE", "SMTPS", "STARTTLS"],
          description: "Şifreleme (varsayılan STARTTLS)",
        },
      },
      required: ["from", "address"],
    },
  },
  {
    name: "mip_delete_alert_mail_config",
    description: "Tanımlı SMTP alert ayarını siler.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

const handlers = {
    // ─── Alerts ─────────────────────────────────────────────────────────────────
    mip_list_alerts: async (args, headers) => {
      const params = {
        paginationPage: (args.page ?? 1) - 1,
        paginationSize: args.size ?? 200,
      };
      if (args.filter) {
        // Alert araması yalnızca alertName üzerinde "contains" yapar (bkz. SPA).
        const criteria = {
          dataOption: "any",
          searchCriteriaList: [{ filterKey: "alertName", operation: "cn", value: args.filter }],
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/alerts`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_create_alert: async (args, headers) => {
      const useTemplate = args.useTemplate ?? false;
      // MIP alertTemplate alanında literal satır sonu kabul etmez ("Cannot be blank"
      // hatası verir); HTML boşluğa duyarsız olduğundan newline'ları boşluğa çeviririz.
      const normTemplate = (t) => (t ?? "").replace(/\r?\n/g, " ");
      const body = {
        alertName: args.alertName,
        alertMailList: args.alertMailList,
        postingFrequency: args.postingFrequency,
        flowIds: args.flowIds,
        isTemplateEnabled: useTemplate,
        alertTemplate: useTemplate ? normTemplate(args.alertTemplate) : "",
        alertBodyType: useTemplate ? (args.alertBodyType ?? "") : "",
      };
      if (useTemplate && (!args.alertTemplate || !args.alertBodyType)) {
        throw new Error("useTemplate=true iken alertTemplate ve alertBodyType zorunludur.");
      }
      const res = await axios.post(`${BASE_URL}/api/alerts`, body, { headers });
      return `Alert oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_alert: async (args, headers) => {
      const { id } = args;
      // MIP PUT tam objeyi bekler; mevcut kaydı bul, üstüne verilen alanları merge et.
      const cur = await axios.get(`${BASE_URL}/api/alerts`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const existing = (cur.data?.content ?? []).find((a) => String(a.alertId) === String(id));
      if (!existing) throw new Error(`Alert bulunamadı: id ${id}`);
      const useTemplate = args.useTemplate ?? existing.isTemplateEnabled ?? false;
      const existingFlowIds = (existing.integrationFlows ?? []).map((f) => f.flowId);
      // MIP alertTemplate literal satır sonu kabul etmez; newline'ları boşluğa çevir.
      const normTemplate = (t) => (t ?? "").replace(/\r?\n/g, " ");
      const body = {
        alertName: args.alertName ?? existing.alertName,
        alertMailList: args.alertMailList ?? existing.alertMailList,
        postingFrequency: args.postingFrequency ?? existing.postingFrequency,
        flowIds: args.flowIds ?? existingFlowIds,
        isTemplateEnabled: useTemplate,
        alertTemplate: useTemplate ? normTemplate(args.alertTemplate ?? existing.alertTemplate) : "",
        alertBodyType: useTemplate ? (args.alertBodyType ?? existing.alertBodyType ?? "") : "",
      };
      const res = await axios.put(`${BASE_URL}/api/alerts/${id}`, body, { headers });
      return `Alert güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_alert: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/alerts/${args.id}`, { headers });
      return `Alert silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    },

    mip_get_alert_mail_config: async (args, headers) => {
      const res = await axios.get(`${BASE_URL}/api/alerts/mail-config`, { headers });
      return res.data ? JSON.stringify(res.data, null, 2) : "SMTP ayarı tanımlı değil.";
    },

    mip_save_alert_mail_config: async (args, headers) => {
      const body = {
        from: args.from,
        address: args.address,
        port: args.port ?? 587,
        connectionTimeout: args.connectionTimeout ?? 15000,
        readTimeout: args.readTimeout ?? 60000,
        writeTimeout: args.writeTimeout ?? 60000,
        authentication: args.authentication ?? "LOGIN",
        credentialId: args.credentialId ?? "",
        encryption: args.encryption ?? "STARTTLS",
      };
      if (body.authentication !== "NONE" && !body.credentialId) {
        throw new Error("authentication NONE değilse credentialId zorunludur.");
      }
      const res = await axios.post(`${BASE_URL}/api/alerts/mail-config`, body, { headers });
      return `SMTP ayarı kaydedildi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_alert_mail_config: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/alerts/mail-config`, { headers });
      return `SMTP ayarı silindi: ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
