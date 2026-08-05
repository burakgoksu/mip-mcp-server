import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ── Service Users ──
  {
    name: "mip_list_service_users",
    description: "MIP'teki service user'ları listeler. MIP UI veya açılan servislere erişmek için kullanılan kullanıcılar.",
    inputSchema: {
      type: "object",
      properties: {
        page:   { type: "number", description: "Sayfa numarası (0'dan başlar, varsayılan: 0)" },
        size:   { type: "number", description: "Sayfa boyutu (varsayılan: 50)" },
        search: { type: "string", description: "Kullanıcı adı veya e-posta ile filtrele (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_service_user",
    description: "Yeni bir MIP service user'ı oluşturur. Roller: developer, ui-user, monitoring, admin, service-user. ÖNEMLİ: Service user MIP platformuna erişmek için kullanılır (UI girişi, API çağrısı, Start node'unu tetiklemek). processHTTP/processSOAP node'larındaki basicAuthResourceName veya oAuth2ResourceName için SERVICE USER KULLANILMAZ — onlar için mip_create_credential kullanılır.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Kullanıcı adı (benzersiz olmalı)" },
        email:    { type: "string", description: "E-posta adresi" },
        password: { type: "string", description: "Şifre" },
        roles: {
          type: "array",
          items: { type: "string", enum: ["developer", "ui-user", "monitoring", "admin", "service-user"] },
          description: "Kullanıcı rolleri. En az bir rol gereklidir."
        },
      },
      required: ["username", "email", "password", "roles"],
    },
  },
  {
    name: "mip_update_service_user",
    description: "Mevcut bir MIP service user'ını günceller.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Güncellenecek kullanıcı adı" },
        email:    { type: "string", description: "Yeni e-posta adresi (opsiyonel)" },
        password: { type: "string", description: "Yeni şifre (opsiyonel)" },
        roles: {
          type: "array",
          items: { type: "string", enum: ["developer", "ui-user", "monitoring", "admin", "service-user"] },
          description: "Yeni roller (opsiyonel)"
        },
      },
      required: ["username"],
    },
  },
  {
    name: "mip_delete_service_user",
    description: "Bir MIP service user'ını siler.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Silinecek kullanıcı adı" },
      },
      required: ["username"],
    },
  },
  {
    name: "mip_toggle_service_user_lock",
    description: "Bir MIP service user'ının hesabını kilitler veya kilidini açar.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Kullanıcı adı" },
        locked:   { type: "boolean", description: "true = kilitle, false = kilidi aç" },
      },
      required: ["username", "locked"],
    },
  },
];

const handlers = {
    // ── Service Users ────────────────────────────────────────────────────────
    mip_list_service_users: async (args, headers) => {
      const params = {};
      if (args.page !== undefined) params.page = args.page;
      if (args.size !== undefined) params.size = args.size;
      if (args.search) params.search = args.search;
      const res = await axios.get(`${BASE_URL}/api/service-users`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_create_service_user: async (args, headers) => {
      const res = await axios.post(`${BASE_URL}/api/service-users`, {
        username: args.username,
        email: args.email,
        password: args.password,
        roles: args.roles,
      }, { headers });
      return `Service user oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_service_user: async (args, headers) => {
      const body = {};
      if (args.email)    body.email    = args.email;
      if (args.password) body.password = args.password;
      if (args.roles)    body.roles    = args.roles;
      const res = await axios.put(`${BASE_URL}/api/service-users/${args.username}`, body, { headers });
      return `Service user güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_service_user: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/service-users/${args.username}`, { headers });
      return `Service user silindi: ${JSON.stringify(res.data)}`;
    },

    mip_toggle_service_user_lock: async (args, headers) => {
      const res = await axios.put(
        `${BASE_URL}/api/service-users/${args.username}/change-account-lock`,
        { locked: args.locked },
        { headers }
      );
      return `Hesap kilidi ${args.locked ? "aktifleştirildi" : "kaldırıldı"}: ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
