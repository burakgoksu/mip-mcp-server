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
    description: "Lists the SOAP services already imported into MIP under a SOA connection (GET /api/soa-connections/{id}/services). connectionId = SOA connection ID (from mip_list_soa_connections).",
    inputSchema: { type: "object", properties: { connectionId: { type: "number", description: "SOA connection ID" } }, required: ["connectionId"] },
  },
  {
    name: "mip_list_available_soa_services",
    description: "Discovers SOA services on the SAP system that are available to import (not yet fetched) (GET /api/soa-connections/{id}/available-services). Connects to SAP live, so it can be slow.",
    inputSchema: { type: "object", properties: { connectionId: { type: "number", description: "SOA connection ID" } }, required: ["connectionId"] },
  },
  {
    name: "mip_import_soa_services",
    description: "Imports SOA services from SAP into MIP (POST /api/soa-connections/{id}/import-services). If services is omitted, all available ones are imported; if given, only the listed service names.",
    inputSchema: { type: "object", properties: { connectionId: { type: "number", description: "SOA connection ID" }, services: { type: "array", items: { type: "string" }, description: "Service names to import — imports all of them if left empty" } }, required: ["connectionId"] },
  },
  {
    name: "mip_get_soa_service_wsdl",
    description: "Returns the WSDL of an imported SOA service (GET /api/soa-services/{id}/wsdl). refresh=true re-fetches it from SAP. id = SOA service ID (from mip_list_soa_services).",
    inputSchema: { type: "object", properties: { id: { type: "number", description: "SOA service ID" }, refresh: { type: "boolean", description: "Re-fetch from SAP (default false)" } }, required: ["id"] },
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
