import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── Alerts (Integrations > Alerts) ───────────────────────────────────────────
  // Alert CRUD: /api/alerts. SMTP ayarları: /api/alerts/mail-config.
  {
    name: "mip_list_alerts",
    description:
      "Returns the e-mail alert list. Each alert: alertName, alertMailList (recipients), postingFrequency (cron) + postingFrequencyDesc (human-readable), alertBodyType, integrationFlows. Paginated. filter searches alertName.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: text occurring in the alert name" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_alert",
    description:
      "Creates a new e-mail alert. Sends mail to the alertMailList addresses at the postingFrequency (cron) time for the given flows. The template is optional: if useTemplate=true, alertTemplate (inline HTML/text content) and alertBodyType are required. Note: SMTP must be configured first via mip_save_alert_mail_config for mail to be sent.",
    inputSchema: {
      type: "object",
      properties: {
        alertName: { type: "string", description: "Alert name (unique)" },
        alertMailList: {
          type: "string",
          description: "Recipient e-mail address(es) (comma-separated)",
        },
        postingFrequency: {
          type: "string",
          description: "Send schedule, a cron expression (e.g. '0 0 8 * * ?' = every day at 08:00)",
        },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "List of flow IDs the alert covers (at least 1). E.g. ['F_CALCULATOR_EGITIM']",
        },
        useTemplate: {
          type: "boolean",
          description: "Whether to use a custom template (default false). If true, alertTemplate + alertBodyType are required.",
        },
        alertTemplate: {
          type: "string",
          description: "Template content (inline HTML/text). Required when useTemplate=true.",
        },
        alertBodyType: {
          type: "string",
          enum: ["HTML", "JSON", "CSV", "XML", "TEXT"],
          description: "Template type. Required when useTemplate=true.",
        },
      },
      required: ["alertName", "alertMailList", "postingFrequency", "flowIds"],
    },
  },
  {
    name: "mip_update_alert",
    description:
      "Updates an existing alert. id (alertId) is required; the given fields are merged over the current record (the rest are preserved).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "alertId to update (from mip_list_alerts)" },
        alertName: { type: "string", description: "New name (optional)" },
        alertMailList: { type: "string", description: "New recipient list (optional)" },
        postingFrequency: { type: "string", description: "New cron schedule (optional)" },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "New flow ID list (optional; replaces the current list if given)",
        },
        useTemplate: { type: "boolean", description: "Template on/off (optional)" },
        alertTemplate: { type: "string", description: "New template content (optional)" },
        alertBodyType: {
          type: "string",
          enum: ["HTML", "JSON", "CSV", "XML", "TEXT"],
          description: "New template type (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_alert",
    description: "Deletes a specific alert.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "alertId to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_get_alert_mail_config",
    description: "Returns the SMTP settings configured for alert e-mails (empty if none).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_save_alert_mail_config",
    description:
      "Saves/updates the SMTP settings for alert e-mails. credentialId is required unless authentication is NONE (the MIP credential holding the SMTP user/password).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Sender e-mail address (e.g. alerts@example.com)" },
        address: { type: "string", description: "SMTP server address (e.g. smtp.gmail.com)" },
        port: { type: "number", description: "SMTP port (default 587)" },
        connectionTimeout: { type: "number", description: "Connection timeout in ms (default 15000)" },
        readTimeout: { type: "number", description: "Read timeout in ms (default 60000)" },
        writeTimeout: { type: "number", description: "Write timeout in ms (default 60000)" },
        authentication: {
          type: "string",
          enum: ["NONE", "LOGIN", "PLAIN", "CRAM_MD5", "XOAUTH2"],
          description: "Authentication method (default LOGIN)",
        },
        credentialId: {
          type: "string",
          description: "MIP credential ID holding the SMTP credentials (required unless authentication is NONE)",
        },
        encryption: {
          type: "string",
          enum: ["NONE", "SMTPS", "STARTTLS"],
          description: "Encryption (default STARTTLS)",
        },
      },
      required: ["from", "address"],
    },
  },
  {
    name: "mip_delete_alert_mail_config",
    description: "Deletes the configured SMTP alert settings.",
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
