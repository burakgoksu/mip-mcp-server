// ─── RFC Explorer (Operations > Sap-Connections > RFC Explorer) ───────────────
// Bir SAP sisteminde RFC/BAPI fonksiyonlarını keşfet (browse) ve arayüzlerini
// (parametre/tablo/yapı) incele. Bağlantı: ya kayıtlı bir RFC destination
// (destinationId) ya da satır-içi SAP bilgileri. SAP endpoint'leri gövdeyi
// { data: ... } zarfıyla döner. NOT: mip_*_rfc_destination tool'larından ayrıdır.
import axios from "axios";
import { BASE_URL } from "../config.js";

// Bağlantı gövdesi: kayıtlı RFC destination (destinationId) VEYA satır-içi SAP bilgisi.
const INLINE = ["ashost", "sysnr", "client", "user", "password", "lang"];
function connBody(args) {
  if (args.destinationId != null) return { destinationId: args.destinationId };
  const c = Object.fromEntries(INLINE.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]));
  if (!c.ashost || !c.sysnr || !c.client || !c.user || !c.password) {
    throw new Error("SAP bağlantısı için ya destinationId ya da ashost+sysnr+client+user+password verilmeli.");
  }
  return c;
}
// SAP uçları { data: ... } zarfı kullanır; içini çıkar.
const unwrap = (d) => (d && typeof d === "object" && "data" in d ? d.data : d);

const CONN_PROPS = {
  destinationId: { type: "number", description: "Saved RFC destination ID (Destinations > RFC; mip_list_rfc_destinations). Preferred over passing inline credentials." },
  ashost: { type: "string", description: "SAP application server host (when destinationId is not given)" },
  sysnr: { type: "string", description: "SAP system number (e.g. '00')" },
  client: { type: "string", description: "SAP client (e.g. '100')" },
  user: { type: "string", description: "SAP user name" },
  password: { type: "string", description: "SAP password" },
  lang: { type: "string", description: "Session language (e.g. 'EN') — optional" },
};

const tools = [
  {
    name: "mip_test_sap_connection",
    description:
      "Tests a SAP RFC connection (POST /api/sap-connections/test-connection). Use either destinationId (a saved RFC destination) OR inline ashost/sysnr/client/user/password. Harmless handshake; returns connected true/false.",
    inputSchema: { type: "object", properties: { ...CONN_PROPS }, required: [] },
  },
  {
    name: "mip_browse_rfcs",
    description:
      "RFC Explorer: searches RFC/BAPI functions on a SAP system (POST /api/sap-connections/browse-rfcs). namePattern is a SAP wildcard mask; '*' is REQUIRED as the wildcard — 'STFC*' or '*BAPI_USER*' match, but 'STFC' without a wildcard returns nothing. Minimum 2 characters. Matching functions are returned as {name, group}.",
    inputSchema: { type: "object", properties: { ...CONN_PROPS, namePattern: { type: "string", description: "SAP RFC name mask, '*' is the wildcard (e.g. 'STFC*', 'BAPI_USER*', '*STFC*'). A search without a wildcard returns empty." } }, required: ["namePattern"] },
  },
  {
    name: "mip_get_rfc_interface",
    description:
      "Returns the interface of an RFC/BAPI function (POST /api/sap-connections/rfc-interface): import/export/changing parameters, tables and structure fields. functionName is the full function name (e.g. 'STFC_CONNECTION').",
    inputSchema: { type: "object", properties: { ...CONN_PROPS, functionName: { type: "string", description: "Full RFC function name (e.g. STFC_CONNECTION)" } }, required: ["functionName"] },
  },
  {
    name: "mip_list_imported_sap_objects",
    description: "Lists the SAP objects previously imported into MIP for an RFC destination (GET /api/imported-sap-objects?connectionId=).",
    inputSchema: { type: "object", properties: { connectionId: { type: "number", description: "RFC destination ID" } }, required: ["connectionId"] },
  },
];

const handlers = {
  mip_test_sap_connection: async (args, headers) =>
    JSON.stringify((await axios.post(`${BASE_URL}/api/sap-connections/test-connection`, connBody(args), { headers })).data, null, 2),

  mip_browse_rfcs: async (args, headers) => {
    if (!args.namePattern || args.namePattern.trim().length < 2) throw new Error("namePattern en az 2 karakter olmalı.");
    const body = { ...connBody(args), namePattern: args.namePattern.trim() };
    const res = await axios.post(`${BASE_URL}/api/sap-connections/browse-rfcs`, body, { headers });
    const d = unwrap(res.data);
    return JSON.stringify(d?.functions ?? d, null, 2);
  },

  mip_get_rfc_interface: async (args, headers) => {
    const body = { ...connBody(args), functionName: args.functionName };
    const res = await axios.post(`${BASE_URL}/api/sap-connections/rfc-interface`, body, { headers });
    return JSON.stringify(unwrap(res.data), null, 2);
  },

  mip_list_imported_sap_objects: async (args, headers) =>
    JSON.stringify((await axios.get(`${BASE_URL}/api/imported-sap-objects?connectionId=${encodeURIComponent(args.connectionId)}`, { headers })).data, null, 2),
};

export default { tools, handlers };
