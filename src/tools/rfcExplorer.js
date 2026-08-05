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
  destinationId: { type: "number", description: "Kayıtlı RFC destination ID (Destinations > RFC; mip_list_rfc_destinations). Satır-içi bilgiler yerine bunu vermek tercih edilir." },
  ashost: { type: "string", description: "SAP application server host (destinationId yoksa)" },
  sysnr: { type: "string", description: "SAP system number (ör. '00')" },
  client: { type: "string", description: "SAP client (ör. '100')" },
  user: { type: "string", description: "SAP kullanıcı adı" },
  password: { type: "string", description: "SAP şifresi" },
  lang: { type: "string", description: "Oturum dili (ör. 'EN') — opsiyonel" },
};

const tools = [
  {
    name: "mip_test_sap_connection",
    description:
      "SAP RFC bağlantısını test eder (POST /api/sap-connections/test-connection). destinationId (kayıtlı RFC destination) VEYA satır-içi ashost/sysnr/client/user/password ile. Zararsız handshake; connected true/false döner.",
    inputSchema: { type: "object", properties: { ...CONN_PROPS }, required: [] },
  },
  {
    name: "mip_browse_rfcs",
    description:
      "RFC Explorer: bir SAP sisteminde RFC/BAPI fonksiyonlarını arar (POST /api/sap-connections/browse-rfcs). namePattern SAP joker maskesidir; '*' joker olarak GEREKLİDİR — 'STFC*' veya '*BAPI_USER*' eşleşir ama jokersiz 'STFC' hiçbir şey döndürmez. Min 2 karakter. Eşleşen fonksiyonlar {name, group} olarak döner.",
    inputSchema: { type: "object", properties: { ...CONN_PROPS, namePattern: { type: "string", description: "SAP RFC adı maskesi, '*' joker (ör. 'STFC*', 'BAPI_USER*', '*STFC*'). Jokersiz arama boş döner." } }, required: ["namePattern"] },
  },
  {
    name: "mip_get_rfc_interface",
    description:
      "Bir RFC/BAPI fonksiyonunun arayüzünü döner (POST /api/sap-connections/rfc-interface): import/export/changing parametreleri, tablolar ve yapı alanları. functionName tam fonksiyon adıdır (ör. 'STFC_CONNECTION').",
    inputSchema: { type: "object", properties: { ...CONN_PROPS, functionName: { type: "string", description: "Tam RFC fonksiyon adı (ör. STFC_CONNECTION)" } }, required: ["functionName"] },
  },
  {
    name: "mip_list_imported_sap_objects",
    description: "Bir RFC destination için MIP'e daha önce import edilmiş SAP objelerini listeler (GET /api/imported-sap-objects?connectionId=).",
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
