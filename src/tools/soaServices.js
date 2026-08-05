// ─── SOA Services (Operations > Sap-Connections > SOA > Services) ─────────────
// Bir SOA (SAP web service) bağlantısı altındaki SOAP servislerini listele,
// SAP'ta import edilebilir olanları keşfet, MIP'e import et ve WSDL'lerini al.
// Servisler /api/soa-connections/{id}/... altında; WSDL /api/soa-services/{id}/wsdl.
import axios from "axios";
import { BASE_URL } from "../config.js";

const asArray = (d) => (Array.isArray(d) ? d : d?.content ?? d ?? []);

const tools = [
  {
    name: "mip_list_soa_services",
    description: "Bir SOA bağlantısına MIP'e import edilmiş SOAP servislerini listeler (GET /api/soa-connections/{id}/services). connectionId = SOA connection ID (mip_list_soa_connections).",
    inputSchema: { type: "object", properties: { connectionId: { type: "number", description: "SOA connection ID" } }, required: ["connectionId"] },
  },
  {
    name: "mip_list_available_soa_services",
    description: "SAP sisteminde import edilebilir (henüz alınmamış) SOA servislerini keşfeder (GET /api/soa-connections/{id}/available-services). Canlı olarak SAP'a bağlanır, yavaş olabilir.",
    inputSchema: { type: "object", properties: { connectionId: { type: "number", description: "SOA connection ID" } }, required: ["connectionId"] },
  },
  {
    name: "mip_import_soa_services",
    description: "SOA servislerini SAP'tan MIP'e import eder (POST /api/soa-connections/{id}/import-services). services verilmezse mevcut tümü, verilirse yalnız seçilen servis adları import edilir.",
    inputSchema: { type: "object", properties: { connectionId: { type: "number", description: "SOA connection ID" }, services: { type: "array", items: { type: "string" }, description: "İçe aktarılacak servis adları — boş bırakılırsa hepsi" } }, required: ["connectionId"] },
  },
  {
    name: "mip_get_soa_service_wsdl",
    description: "Import edilmiş bir SOA servisinin WSDL'ini döner (GET /api/soa-services/{id}/wsdl). refresh=true ile SAP'tan tazelenir. id = SOA servis ID (mip_list_soa_services).",
    inputSchema: { type: "object", properties: { id: { type: "number", description: "SOA servis ID" }, refresh: { type: "boolean", description: "SAP'tan yeniden çek (varsayılan false)" } }, required: ["id"] },
  },
];

const handlers = {
  mip_list_soa_services: async (args, headers) =>
    JSON.stringify(asArray((await axios.get(`${BASE_URL}/api/soa-connections/${args.connectionId}/services`, { headers })).data), null, 2),

  mip_list_available_soa_services: async (args, headers) =>
    JSON.stringify(asArray((await axios.get(`${BASE_URL}/api/soa-connections/${args.connectionId}/available-services`, { headers })).data), null, 2),

  mip_import_soa_services: async (args, headers) => {
    const url = `${BASE_URL}/api/soa-connections/${args.connectionId}/import-services`;
    const body = args.services?.length ? { services: args.services } : undefined;
    return `SOA servis import: ${JSON.stringify((await axios.post(url, body, { headers })).data)}`;
  },

  mip_get_soa_service_wsdl: async (args, headers) => {
    const url = `${BASE_URL}/api/soa-services/${args.id}/wsdl${args.refresh ? "?refresh=true" : ""}`;
    const res = await axios.get(url, { headers });
    return typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
  },
};

export default { tools, handlers };
