// ─── SAP Connections (Operations > Sap-Connections) ───────────────────────────
// Yeni sürümde 3 SAP bağlantı tipi. NOT: eski mip_*_rfc_destination (RFC sekmesi,
// /api/rfc-destinations) AYRI durur ve bu modülde DEĞİŞTİRİLMEZ.
//   SOA         → /api/soa-connections
//   XI Proxy    → PO Connections /api/po-connections, Systems /api/xi-systems
import axios from "axios";
import { BASE_URL } from "../config.js";

const SCHEME = { type: "string", enum: ["http", "https"], description: "http or https" };
// Verilen anahtarlardan (undefined olmayan) body kur.
const pick = (args, keys) => Object.fromEntries(keys.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]));

const SOA_FIELDS = ["name", "scheme", "host", "port", "systemClient", "wsilPath", "credentialId"];
const PO_FIELDS = ["name", "scheme", "host", "port", "esrPath", "credentialId"];
const XI_FIELDS = ["name", "businessSystem", "businessParty", "scheme", "host", "port", "enginePath", "credentialId"];

// Ortak CRUD üretici (list/create/update-merge/delete). enable/test ayrıca eklenir.
function crud({ base, listShape }) {
  const listArray = listShape === "array";
  const getItems = async (headers) => {
    const r = await axios.get(`${BASE_URL}${base}`, { headers, params: listArray ? {} : { paginationPage: 0, paginationSize: 500 } });
    return listArray ? (Array.isArray(r.data) ? r.data : []) : (r.data?.content ?? []);
  };
  return { getItems };
}

const soa = crud({ base: "/api/soa-connections", listShape: "content" });
const po = crud({ base: "/api/po-connections", listShape: "content" });
const xi = crud({ base: "/api/xi-systems", listShape: "array" });

const tools = [
  // ── SOA ──
  { name: "mip_list_soa_connections", description: "Returns the SOA (SAP) connection list: name, scheme, host, port, systemClient, wsilPath, credentialId, connectionStatus, lastTestAt, isEnabled. Paginated.", inputSchema: { type: "object", properties: { filter: { type: "string", description: "Optional search" }, page: { type: "number" }, size: { type: "number" } }, required: [] } },
  { name: "mip_create_soa_connection", description: "Creates a new SOA (SAP web service) connection. credentialId is the MIP credential ID the connection will use.", inputSchema: { type: "object", properties: { name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, systemClient: { type: "string", description: "SAP client (e.g. '100')" }, wsilPath: { type: "string", description: "WSIL path (e.g. /sap/bc/srt/wsil)" }, credentialId: { type: "number", description: "MIP credential ID" } }, required: ["name", "host", "port"] } },
  { name: "mip_update_soa_connection", description: "Updates a SOA connection by id (the given fields are merged).", inputSchema: { type: "object", properties: { id: { type: "number" }, name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, systemClient: { type: "string" }, wsilPath: { type: "string" }, credentialId: { type: "number" } }, required: ["id"] } },
  { name: "mip_delete_soa_connection", description: "Deletes a SOA connection by id.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
  { name: "mip_set_soa_connection_enabled", description: "Enables/disables a SOA connection.", inputSchema: { type: "object", properties: { id: { type: "number" }, isEnabled: { type: "boolean" } }, required: ["id", "isEnabled"] } },

  // ── XI Proxy: PO Connections ──
  { name: "mip_list_po_connections", description: "Returns the XI Proxy > PO Connections list: name, scheme, host, port, esrPath, credentialId, connectionStatus, isEnabled.", inputSchema: { type: "object", properties: { filter: { type: "string" }, page: { type: "number" }, size: { type: "number" } }, required: [] } },
  { name: "mip_create_po_connection", description: "Creates a new PO (Process Orchestration) connection. esrPath is the ESR repository path (e.g. /rep).", inputSchema: { type: "object", properties: { name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, esrPath: { type: "string", description: "ESR path (e.g. /rep)" }, credentialId: { type: "number", description: "MIP credential ID (BASIC)" } }, required: ["name", "host", "port"] } },
  { name: "mip_update_po_connection", description: "Updates a PO connection by id (merge).", inputSchema: { type: "object", properties: { id: { type: "number" }, name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, esrPath: { type: "string" }, credentialId: { type: "number" } }, required: ["id"] } },
  { name: "mip_delete_po_connection", description: "Deletes a PO connection by id.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
  { name: "mip_set_po_connection_enabled", description: "Enables/disables a PO connection.", inputSchema: { type: "object", properties: { id: { type: "number" }, isEnabled: { type: "boolean" } }, required: ["id", "isEnabled"] } },

  // ── XI Proxy: Systems ──
  { name: "mip_list_xi_systems", description: "Returns the XI Proxy > Systems list: name, businessSystem, businessParty, scheme, host, port, enginePath.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "mip_create_xi_system", description: "Creates a new XI System (business system). enginePath is the integration engine path.", inputSchema: { type: "object", properties: { name: { type: "string" }, businessSystem: { type: "string", description: "Business system name (e.g. BS_SAP_S4H)" }, businessParty: { type: "string", description: "Business party (optional)" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, enginePath: { type: "string", description: "Integration engine path" }, credentialId: { type: "number", description: "MIP credential ID (optional)" } }, required: ["name", "host", "port"] } },
  { name: "mip_update_xi_system", description: "Updates an XI System by id (merge).", inputSchema: { type: "object", properties: { id: { type: "number" }, name: { type: "string" }, businessSystem: { type: "string" }, businessParty: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, enginePath: { type: "string" }, credentialId: { type: "number" } }, required: ["id"] } },
  { name: "mip_delete_xi_system", description: "Deletes an XI System by id.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
  { name: "mip_test_xi_system", description: "Tests an XI System connection (POST /{id}/test-connection). The result returns the connection status.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
];

const handlers = {
  // SOA
  mip_list_soa_connections: async (args, headers) => {
    const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 25 };
    if (args.filter) params.filter = args.filter;
    return JSON.stringify((await axios.get(`${BASE_URL}/api/soa-connections`, { headers, params })).data, null, 2);
  },
  mip_create_soa_connection: async (args, headers) => `SOA bağlantısı oluşturuldu: ${JSON.stringify((await axios.post(`${BASE_URL}/api/soa-connections`, pick(args, SOA_FIELDS), { headers })).data)}`,
  mip_update_soa_connection: async (args, headers) => {
    const cur = (await soa.getItems(headers)).find((x) => x.id === args.id);
    if (!cur) throw new Error(`SOA bağlantısı bulunamadı: id ${args.id}`);
    const body = { ...pick(cur, SOA_FIELDS), ...pick(args, SOA_FIELDS) };
    return `SOA bağlantısı güncellendi: ${JSON.stringify((await axios.put(`${BASE_URL}/api/soa-connections/${args.id}`, body, { headers })).data)}`;
  },
  mip_delete_soa_connection: async (args, headers) => `SOA bağlantısı silindi (id ${args.id}): ${JSON.stringify((await axios.delete(`${BASE_URL}/api/soa-connections/${args.id}`, { headers })).data)}`,
  mip_set_soa_connection_enabled: async (args, headers) => `SOA bağlantısı ${args.isEnabled ? "etkin" : "pasif"}: ${JSON.stringify((await axios.put(`${BASE_URL}/api/soa-connections/${args.id}/set-enabled?isEnabled=${args.isEnabled}`, null, { headers })).data)}`,

  // PO
  mip_list_po_connections: async (args, headers) => {
    const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 25 };
    if (args.filter) params.filter = args.filter;
    return JSON.stringify((await axios.get(`${BASE_URL}/api/po-connections`, { headers, params })).data, null, 2);
  },
  mip_create_po_connection: async (args, headers) => `PO bağlantısı oluşturuldu: ${JSON.stringify((await axios.post(`${BASE_URL}/api/po-connections`, pick(args, PO_FIELDS), { headers })).data)}`,
  mip_update_po_connection: async (args, headers) => {
    const cur = (await po.getItems(headers)).find((x) => x.id === args.id);
    if (!cur) throw new Error(`PO bağlantısı bulunamadı: id ${args.id}`);
    const body = { ...pick(cur, PO_FIELDS), ...pick(args, PO_FIELDS) };
    return `PO bağlantısı güncellendi: ${JSON.stringify((await axios.put(`${BASE_URL}/api/po-connections/${args.id}`, body, { headers })).data)}`;
  },
  mip_delete_po_connection: async (args, headers) => `PO bağlantısı silindi (id ${args.id}): ${JSON.stringify((await axios.delete(`${BASE_URL}/api/po-connections/${args.id}`, { headers })).data)}`,
  mip_set_po_connection_enabled: async (args, headers) => `PO bağlantısı ${args.isEnabled ? "etkin" : "pasif"}: ${JSON.stringify((await axios.put(`${BASE_URL}/api/po-connections/${args.id}/set-enabled?isEnabled=${args.isEnabled}`, null, { headers })).data)}`,

  // XI Systems
  mip_list_xi_systems: async (args, headers) => JSON.stringify((await axios.get(`${BASE_URL}/api/xi-systems`, { headers })).data, null, 2),
  mip_create_xi_system: async (args, headers) => `XI System oluşturuldu: ${JSON.stringify((await axios.post(`${BASE_URL}/api/xi-systems`, pick(args, XI_FIELDS), { headers })).data)}`,
  mip_update_xi_system: async (args, headers) => {
    const cur = (await xi.getItems(headers)).find((x) => x.id === args.id);
    if (!cur) throw new Error(`XI System bulunamadı: id ${args.id}`);
    const body = { ...pick(cur, XI_FIELDS), ...pick(args, XI_FIELDS) };
    return `XI System güncellendi: ${JSON.stringify((await axios.put(`${BASE_URL}/api/xi-systems/${args.id}`, body, { headers })).data)}`;
  },
  mip_delete_xi_system: async (args, headers) => `XI System silindi (id ${args.id}): ${JSON.stringify((await axios.delete(`${BASE_URL}/api/xi-systems/${args.id}`, { headers })).data)}`,
  mip_test_xi_system: async (args, headers) => JSON.stringify((await axios.post(`${BASE_URL}/api/xi-systems/${args.id}/test-connection`, null, { headers })).data, null, 2),
};

export default { tools, handlers };
