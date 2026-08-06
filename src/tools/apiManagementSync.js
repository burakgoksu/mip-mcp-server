// ─── API Management ↔ Service Users Sync ──────────────────────────────────────
// MIP service user'larını (ve basic-auth kimliklerini) API Gateway'e consumer
// olarak senkronize eder. Bu, gateway'de tanımlı bir consumer'ın MIP backend
// tarafından da tanınmasını sağlar (standalone consumer 'Invalid user
// authorization' alır — çünkü backend principal'ı gerçek bir service user'a
// bağlar). Uçlar: /api/api-management/sync/*.
import axios from "axios";
import { BASE_URL } from "../config.js";

const SYNC = `${BASE_URL}/api/api-management/sync`;
const ONCONFLICT = { type: "string", enum: ["ERROR", "SKIP"], description: "Aynı isimde gateway consumer/credential varsa: ERROR=hata (varsayılan), SKIP=atla" };

const tools = [
  {
    name: "mip_sync_service_user_to_gateway",
    description:
      "Bir MIP service user'ını API Gateway'e consumer olarak senkronize eder (POST /api/api-management/sync/service-users/{id}). Böylece consumer, route'larda consumer-restriction ile kullanılabilir VE MIP backend principal'ı tanır ('Invalid user authorization' önlenir). includeCredentials=true (varsayılan) service user'ın basic-auth kimliğini gateway consumer'ına kopyalar — gateway'de basic-auth ile çağırabilmek için gerekir.",
    inputSchema: {
      type: "object",
      properties: {
        serviceUserId: { type: "number", description: "MIP service user ID (mip_list_service_users / mip_list_pure_service_users)" },
        includeCredentials: { type: "boolean", description: "Service user'ın basic-auth kimliğini de kopyala (varsayılan true)" },
        consumerUsername: { type: "string", description: "Gateway'deki consumer adı (varsayılan: service user adı)" },
        onConflict: ONCONFLICT,
      },
      required: ["serviceUserId"],
    },
  },
  {
    name: "mip_unsync_service_user_from_gateway",
    description: "Bir service user'ın gateway consumer senkronizasyonunu kaldırır (DELETE /api/api-management/sync/service-users/{id}). NOT: kullanıcı includeCredentials ile sync edildiyse credential'lar da gateway'de olur; varsayılan strategy=ERROR bu durumda 'Unlink credentials first' hatası verir — hem kullanıcıyı hem credential'ları kaldırmak için strategy=CASCADE kullan.",
    inputSchema: {
      type: "object",
      properties: {
        serviceUserId: { type: "number", description: "MIP service user ID" },
        strategy: { type: "string", enum: ["ERROR", "CASCADE", "RETAIN_CREDENTIALS"], description: "ERROR=credential varsa hata (varsayılan); CASCADE=credential'ları da kaldır; RETAIN_CREDENTIALS=credential'ları gateway'de bırak" },
      },
      required: ["serviceUserId"],
    },
  },
  {
    name: "mip_list_service_user_basic_auth_credentials",
    description: "Bir service user'ın basic-auth kimliklerini (credential) listeler (GET /api/service-users/{id}/basic-authentication-credentials). Buradaki credentialId'leri mip_sync_basic_auth_credential_to_gateway ile tek tek senkronlayabilirsin.",
    inputSchema: { type: "object", properties: { serviceUserId: { type: "number", description: "MIP service user ID" } }, required: ["serviceUserId"] },
  },
  {
    name: "mip_sync_basic_auth_credential_to_gateway",
    description: "Bir service user'ın belirli bir basic-auth kimliğini gateway'e consumer credential'ı olarak senkronize eder (POST /api/api-management/sync/basic-authentication-credentials/{credentialId}). Tüm kullanıcı yerine sadece bir kimliği sync etmek için.",
    inputSchema: {
      type: "object",
      properties: {
        credentialId: { type: "number", description: "Basic-auth credential ID (mip_list_service_user_basic_auth_credentials)" },
        consumerUsername: { type: "string", description: "Hedef gateway consumer adı (opsiyonel)" },
        onConflict: ONCONFLICT,
      },
      required: ["credentialId"],
    },
  },
  {
    name: "mip_unsync_basic_auth_credential_from_gateway",
    description: "Bir basic-auth kimliğinin gateway senkronizasyonunu kaldırır (DELETE /api/api-management/sync/basic-authentication-credentials/{credentialId}).",
    inputSchema: { type: "object", properties: { credentialId: { type: "number", description: "Basic-auth credential ID" } }, required: ["credentialId"] },
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
};

export default { tools, handlers };
