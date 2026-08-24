import axios from "axios";
import { BASE_URL } from "../config.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  // ── Service Users ──
  {
    name: "mip_list_service_users",
    description: "Lists MIP service users. These are the users used to access the MIP UI or the exposed services.",
    inputSchema: {
      type: "object",
      properties: {
        page:   { type: "number", description: "Page number (0-based, default: 0)" },
        size:   { type: "number", description: "Page size (default: 50)" },
        search: { type: "string", description: "Filter by user name or e-mail (optional)" },
      },
      required: [],
    },
  },
  {
    name: "mip_list_pure_service_users",
    description: "(v1.16+) Lists 'pure' service users holding only the SERVICE-USER role — the 'Service Users' section in the new UI (GET /api/service-users/pure). Returns 404 on older versions that lack this endpoint; use mip_list_service_users there instead.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "User name/e-mail filter (optional)" },
        page:   { type: "number", description: "Page (1-based, default 1)" },
        size:   { type: "number", description: "Page size (default 25)" },
      },
      required: [],
    },
  },
  {
    name: "mip_list_platform_users",
    description: "(v1.16+) Lists users holding role(s) other than SERVICE-USER (developer/ui-user/monitoring/admin) — the 'MDP Integration Platform Users' section in the new UI (GET /api/service-users/with-other-roles). Returns 404 on older versions that lack this endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "User name/e-mail filter (optional)" },
        page:   { type: "number", description: "Page (1-based, default 1)" },
        size:   { type: "number", description: "Page size (default 25)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_service_user",
    description: "Creates a new MIP service user. Roles: developer, ui-user, monitoring, admin, service-user. IMPORTANT: a service user is for accessing the MIP platform itself (UI login, API calls, triggering a Start node). Do NOT use a SERVICE USER for basicAuthResourceName or oAuth2ResourceName on processHTTP/processSOAP nodes — use mip_create_credential for those.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "User name (must be unique)" },
        email:    { type: "string", description: "E-mail address" },
        password: { type: "string", description: "Password" },
        roles: {
          type: "array",
          items: { type: "string", enum: ["developer", "ui-user", "monitoring", "admin", "service-user"] },
          description: "User roles. At least one role is required."
        },
      },
      required: ["username", "email", "password", "roles"],
    },
  },
  {
    name: "mip_update_service_user",
    description: "Updates an existing MIP service user.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "User name to update" },
        email:    { type: "string", description: "New e-mail address (optional)" },
        password: { type: "string", description: "New password (optional)" },
        roles: {
          type: "array",
          items: { type: "string", enum: ["developer", "ui-user", "monitoring", "admin", "service-user"] },
          description: "New roles (optional)"
        },
      },
      required: ["username"],
    },
  },
  {
    name: "mip_delete_service_user",
    description: "Deletes a MIP service user.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "User name to delete" },
      },
      required: ["username"],
    },
  },
  {
    name: "mip_toggle_service_user_lock",
    description: "Locks or unlocks a MIP service user's account.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "User name" },
        locked:   { type: "boolean", description: "true = lock, false = unlock" },
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

    // (v1.16+) Yeni UI'nın iki ayrı listesi. page 1-based → paginationPage 0-based.
    mip_list_pure_service_users: async (args, headers) => {
      const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 25 };
      if (args.search) params.search = args.search;
      const res = await axios.get(`${BASE_URL}/api/service-users/pure`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_list_platform_users: async (args, headers) => {
      const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 25 };
      if (args.search) params.search = args.search;
      const res = await axios.get(`${BASE_URL}/api/service-users/with-other-roles`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    },

    mip_create_service_user: async (args, headers) => {
      // Sürüm uyumu: eski MIP `roles`, v1.16+ `role` bekliyor. İkisini de gönder;
      // her API kendi alanını okur, diğerini yok sayar (bilinmeyen alan görmezden gelinir).
      const res = await axios.post(`${BASE_URL}/api/service-users`, {
        username: args.username,
        email: args.email,
        password: args.password,
        role: args.roles,
        roles: args.roles,
      }, { headers });
      return msg.created("Service user", res.data);
    },

    mip_update_service_user: async (args, headers) => {
      const body = {};
      if (args.email)    body.email    = args.email;
      if (args.password) body.password = args.password;
      if (args.roles) { body.role = args.roles; body.roles = args.roles; } // role (v1.16+) + roles (eski)
      const res = await axios.put(`${BASE_URL}/api/service-users/${args.username}`, body, { headers });
      return msg.updated("Service user", res.data);
    },

    mip_delete_service_user: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/service-users/${args.username}`, { headers });
      return msg.deleted("Service user", res.data);
    },

    mip_toggle_service_user_lock: async (args, headers) => {
      const res = await axios.put(
        `${BASE_URL}/api/service-users/${args.username}/change-account-lock`,
        { locked: args.locked },
        { headers }
      );
      // Two whole message keys, never a translated fragment: an agglutinative
      // language cannot splice "locked"/"unlocked" into a sentence frame.
      return t(
        args.locked ? "serviceUsers.accountLocked" : "serviceUsers.accountUnlocked",
        { detail: JSON.stringify(res.data) },
        args.locked ? "Account locked: {detail}" : "Account unlocked: {detail}"
      );
    },
};

export default { tools, handlers };
