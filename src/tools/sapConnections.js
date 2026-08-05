// ─── SAP Connections (Operations > Sap-Connections) ───────────────────────────
// Yeni sürümde 3 SAP bağlantı tipi. NOT: eski mip_*_rfc_destination (RFC sekmesi,
// /api/rfc-destinations) AYRI durur ve bu modülde DEĞİŞTİRİLMEZ.
//   SOA         → /api/soa-connections
//   XI Proxy    → PO Connections /api/po-connections, Systems /api/xi-systems
import axios from "axios";
import { BASE_URL } from "../config.js";

const SCHEME = { type: "string", enum: ["http", "https"], description: "http veya https" };
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
  { name: "mip_list_soa_connections", description: "SOA (SAP) bağlantı listesini döner: name, scheme, host, port, systemClient, wsilPath, credentialId, connectionStatus, lastTestAt, isEnabled. Sayfalıdır.", inputSchema: { type: "object", properties: { filter: { type: "string", description: "Opsiyonel arama" }, page: { type: "number" }, size: { type: "number" } }, required: [] } },
  { name: "mip_create_soa_connection", description: "Yeni SOA (SAP web service) bağlantısı oluşturur. credentialId, bağlantının kullanacağı MIP credential ID'sidir.", inputSchema: { type: "object", properties: { name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, systemClient: { type: "string", description: "SAP client (ör. '100')" }, wsilPath: { type: "string", description: "WSIL path (ör. /sap/bc/srt/wsil)" }, credentialId: { type: "number", description: "MIP credential ID" } }, required: ["name", "host", "port"] } },
  { name: "mip_update_soa_connection", description: "SOA bağlantısını id ile günceller (verilen alanlar merge edilir).", inputSchema: { type: "object", properties: { id: { type: "number" }, name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, systemClient: { type: "string" }, wsilPath: { type: "string" }, credentialId: { type: "number" } }, required: ["id"] } },
  { name: "mip_delete_soa_connection", description: "SOA bağlantısını id ile siler.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
  { name: "mip_set_soa_connection_enabled", description: "SOA bağlantısını etkinleştirir/pasifleştirir.", inputSchema: { type: "object", properties: { id: { type: "number" }, isEnabled: { type: "boolean" } }, required: ["id", "isEnabled"] } },

  // ── XI Proxy: PO Connections ──
  { name: "mip_list_po_connections", description: "XI Proxy > PO Connections listesini döner: name, scheme, host, port, esrPath, credentialId, connectionStatus, isEnabled.", inputSchema: { type: "object", properties: { filter: { type: "string" }, page: { type: "number" }, size: { type: "number" } }, required: [] } },
  { name: "mip_create_po_connection", description: "Yeni PO (Process Orchestration) bağlantısı oluşturur. esrPath ESR repository yoludur (ör. /rep).", inputSchema: { type: "object", properties: { name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, esrPath: { type: "string", description: "ESR path (ör. /rep)" }, credentialId: { type: "number", description: "MIP credential ID (BASIC)" } }, required: ["name", "host", "port"] } },
  { name: "mip_update_po_connection", description: "PO bağlantısını id ile günceller (merge).", inputSchema: { type: "object", properties: { id: { type: "number" }, name: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, esrPath: { type: "string" }, credentialId: { type: "number" } }, required: ["id"] } },
  { name: "mip_delete_po_connection", description: "PO bağlantısını id ile siler.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
  { name: "mip_set_po_connection_enabled", description: "PO bağlantısını etkinleştirir/pasifleştirir.", inputSchema: { type: "object", properties: { id: { type: "number" }, isEnabled: { type: "boolean" } }, required: ["id", "isEnabled"] } },

  // ── XI Proxy: Systems ──
  { name: "mip_list_xi_systems", description: "XI Proxy > Systems listesini döner: name, businessSystem, businessParty, scheme, host, port, enginePath.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "mip_create_xi_system", description: "Yeni XI System (business system) oluşturur. enginePath integration engine yoludur.", inputSchema: { type: "object", properties: { name: { type: "string" }, businessSystem: { type: "string", description: "İş sistemi adı (ör. BS_SAP_S4H)" }, businessParty: { type: "string", description: "İş partneri (opsiyonel)" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, enginePath: { type: "string", description: "Integration engine path" }, credentialId: { type: "number", description: "MIP credential ID (opsiyonel)" } }, required: ["name", "host", "port"] } },
  { name: "mip_update_xi_system", description: "XI System'i id ile günceller (merge).", inputSchema: { type: "object", properties: { id: { type: "number" }, name: { type: "string" }, businessSystem: { type: "string" }, businessParty: { type: "string" }, scheme: SCHEME, host: { type: "string" }, port: { type: "number" }, enginePath: { type: "string" }, credentialId: { type: "number" } }, required: ["id"] } },
  { name: "mip_delete_xi_system", description: "XI System'i id ile siler.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
  { name: "mip_test_xi_system", description: "XI System bağlantısını test eder (POST /{id}/test-connection). Sonuç bağlantı durumunu döner.", inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } },
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
