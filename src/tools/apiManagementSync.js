// ─── API Management ↔ Service Users Sync ──────────────────────────────────────
// MIP service user'larını (ve basic-auth / JWT kimliklerini) API Gateway'e consumer
// olarak senkronize eder. Bu, gateway'de tanımlı bir consumer'ın MIP backend
// tarafından da tanınmasını sağlar (standalone consumer 'Invalid user
// authorization' alır — çünkü backend principal'ı gerçek bir service user'a
// bağlar). Uçlar: /api/api-management/sync/*.
import axios from "axios";
import { BASE_URL } from "../config.js";

const SYNC = `${BASE_URL}/api/api-management/sync`;
const ONCONFLICT = { type: "string", enum: ["ERROR", "SKIP"], description: "If a gateway consumer/credential of the same name exists: ERROR=fail (default), SKIP=skip" };

const tools = [
  {
    name: "mip_sync_service_user_to_gateway",
    description:
      "Synchronizes a MIP service user to the API Gateway as a consumer (POST /api/api-management/sync/service-users/{id}). This lets the consumer be used with consumer-restriction on routes AND makes the MIP backend recognize the principal (avoiding 'Invalid user authorization'). includeCredentials=true (default) copies the service user's basic-auth credentials to the gateway consumer — required to call through the gateway with basic-auth.",
    inputSchema: {
      type: "object",
      properties: {
        serviceUserId: { type: "number", description: "MIP service user ID (mip_list_service_users / mip_list_pure_service_users)" },
        includeCredentials: { type: "boolean", description: "Also copy the service user's basic-auth credentials (default true)" },
        consumerUsername: { type: "string", description: "Consumer name on the gateway (default: the service user's name)" },
        onConflict: ONCONFLICT,
      },
      required: ["serviceUserId"],
    },
  },
  {
    name: "mip_unsync_service_user_from_gateway",
    description: "Removes a service user's gateway consumer synchronization (DELETE /api/api-management/sync/service-users/{id}). NOTE: if the user was synced with includeCredentials, the credentials are on the gateway too; the default strategy=ERROR then fails with 'Unlink credentials first' — use strategy=CASCADE to remove both the user and the credentials.",
    inputSchema: {
      type: "object",
      properties: {
        serviceUserId: { type: "number", description: "MIP service user ID" },
        strategy: { type: "string", enum: ["ERROR", "CASCADE", "RETAIN_CREDENTIALS"], description: "ERROR=fail if credentials exist (default); CASCADE=remove the credentials too; RETAIN_CREDENTIALS=leave the credentials on the gateway" },
      },
      required: ["serviceUserId"],
    },
  },
  {
    name: "mip_list_service_user_basic_auth_credentials",
    description: "Lists a service user's basic-auth credentials (GET /api/service-users/{id}/basic-authentication-credentials). The credentialIds returned here can be synced individually with mip_sync_basic_auth_credential_to_gateway.",
    inputSchema: { type: "object", properties: { serviceUserId: { type: "number", description: "MIP service user ID" } }, required: ["serviceUserId"] },
  },
  {
    name: "mip_sync_basic_auth_credential_to_gateway",
    description: "Synchronizes one specific basic-auth credential of a service user to the gateway as a consumer credential (POST /api/api-management/sync/basic-authentication-credentials/{credentialId}). Use this to sync a single credential instead of the whole user.",
    inputSchema: {
      type: "object",
      properties: {
        credentialId: { type: "number", description: "Basic-auth credential ID (mip_list_service_user_basic_auth_credentials)" },
        consumerUsername: { type: "string", description: "Target gateway consumer name (optional)" },
        onConflict: ONCONFLICT,
      },
      required: ["credentialId"],
    },
  },
  {
    name: "mip_unsync_basic_auth_credential_from_gateway",
    description: "Removes a basic-auth credential's gateway synchronization (DELETE /api/api-management/sync/basic-authentication-credentials/{credentialId}).",
    inputSchema: { type: "object", properties: { credentialId: { type: "number", description: "Basic-auth credential ID" } }, required: ["credentialId"] },
  },
  {
    name: "mip_list_service_user_jwt_credentials",
    description: "Lists a service user's JWT credentials (GET /api/service-users/{id}/jwt-authentication-credentials). The credentialIds can be synced individually with mip_sync_jwt_credential_to_gateway.",
    inputSchema: { type: "object", properties: { serviceUserId: { type: "number", description: "MIP service user ID" } }, required: ["serviceUserId"] },
  },
  {
    name: "mip_sync_jwt_credential_to_gateway",
    description: "Synchronizes one specific JWT credential of a service user to the gateway as a consumer credential (POST /api/api-management/sync/jwt-authentication-credentials/{credentialId}).",
    inputSchema: {
      type: "object",
      properties: {
        credentialId: { type: "number", description: "JWT credential ID (mip_list_service_user_jwt_credentials)" },
        consumerUsername: { type: "string", description: "Target gateway consumer name (optional)" },
        onConflict: ONCONFLICT,
      },
      required: ["credentialId"],
    },
  },
  {
    name: "mip_unsync_jwt_credential_from_gateway",
    description: "Removes a JWT credential's gateway synchronization (DELETE /api/api-management/sync/jwt-authentication-credentials/{credentialId}).",
    inputSchema: { type: "object", properties: { credentialId: { type: "number", description: "JWT credential ID" } }, required: ["credentialId"] },
  },
];

const handlers = {
  mip_sync_service_user_to_gateway: async (args, headers) => {
    const body = { includeCredentials: args.includeCredentials ?? true };
    if (args.onConflict) body.onConflict = args.onConflict;
    if (args.consumerUsername) body.consumerUsername = args.consumerUsername;
    const res = await axios.post(`${SYNC}/service-users/${args.serviceUserId}`, body, { headers });
    return `Service user gateway'e sync edildi (id ${args.serviceUserId}): ${JSON.stringify(res.data)}`;
  },

  mip_unsync_service_user_from_gateway: async (args, headers) => {
    const q = args.strategy ? `?strategy=${encodeURIComponent(args.strategy)}` : "";
    const res = await axios.delete(`${SYNC}/service-users/${args.serviceUserId}${q}`, { headers });
    return `Service user sync kaldırıldı (id ${args.serviceUserId}): ${JSON.stringify(res.data)}`;
  },

  mip_list_service_user_basic_auth_credentials: async (args, headers) =>
    JSON.stringify((await axios.get(`${BASE_URL}/api/service-users/${args.serviceUserId}/basic-authentication-credentials`, { headers })).data, null, 2),

  mip_sync_basic_auth_credential_to_gateway: async (args, headers) => {
    const body = {};
    if (args.onConflict) body.onConflict = args.onConflict;
    if (args.consumerUsername) body.consumerUsername = args.consumerUsername;
    const res = await axios.post(`${SYNC}/basic-authentication-credentials/${args.credentialId}`, Object.keys(body).length ? body : undefined, { headers });
    return `Basic-auth credential gateway'e sync edildi (id ${args.credentialId}): ${JSON.stringify(res.data)}`;
  },

  mip_unsync_basic_auth_credential_from_gateway: async (args, headers) =>
    `Basic-auth credential sync kaldırıldı (id ${args.credentialId}): ${JSON.stringify((await axios.delete(`${SYNC}/basic-authentication-credentials/${args.credentialId}`, { headers })).data)}`,

  mip_list_service_user_jwt_credentials: async (args, headers) =>
    JSON.stringify((await axios.get(`${BASE_URL}/api/service-users/${args.serviceUserId}/jwt-authentication-credentials`, { headers })).data, null, 2),

  mip_sync_jwt_credential_to_gateway: async (args, headers) => {
    const body = {};
    if (args.onConflict) body.onConflict = args.onConflict;
    if (args.consumerUsername) body.consumerUsername = args.consumerUsername;
    const res = await axios.post(`${SYNC}/jwt-authentication-credentials/${args.credentialId}`, Object.keys(body).length ? body : undefined, { headers });
    return `JWT credential gateway'e sync edildi (id ${args.credentialId}): ${JSON.stringify(res.data)}`;
  },

  mip_unsync_jwt_credential_from_gateway: async (args, headers) =>
    `JWT credential sync kaldırıldı (id ${args.credentialId}): ${JSON.stringify((await axios.delete(`${SYNC}/jwt-authentication-credentials/${args.credentialId}`, { headers })).data)}`,
};

export default { tools, handlers };
