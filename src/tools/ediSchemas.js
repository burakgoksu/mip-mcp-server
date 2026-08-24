// ─── EDI Schemas (Operations > Edi-Schemas) ───────────────────────────────────
// EDIFACT/X12 vb. için XSD/XSLT şema dosyaları. Endpoint: /api/edi-schemas.
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import { BASE_URL } from "../config.js";
import { saveFile, extractFilename } from "../util.js";
import { msg, err, t } from "../i18n/index.js";

const EDI_TYPES = ["EDIFACT", "EANCOM", "ANSI_X12", "ODETTE", "VDA", "TRADACOMS"];

const tools = [
  {
    name: "mip_list_edi_schemas",
    description:
      "Returns the EDI Schema list. Each record: resourceName, ediType, resourceType (xsd/xslt), dataFormat, version. Paginated; filter searches the name.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: text occurring in the name" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 25)" },
      },
      required: [],
    },
  },
  {
    name: "mip_upload_edi_schema",
    description:
      "Uploads a new EDI schema file (.xsd/.xslt). ediType: EDIFACT/EANCOM/ANSI_X12/ODETTE/VDA/TRADACOMS. resourceType is xsd or xslt. dataFormat is usually XML.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full path of the file to upload (.xsd/.xslt)" },
        resourceName: { type: "string", description: "Resource name (e.g. ORDERSD96A.xsd)" },
        ediType: { type: "string", enum: EDI_TYPES, description: "EDI standard" },
        resourceType: { type: "string", enum: ["xsd", "xslt"], description: "Resource type (default xsd)" },
        dataFormat: { type: "string", description: "Data format (default XML)" },
        version: { type: "string", description: "Version (optional)" },
      },
      required: ["filePath", "resourceName", "ediType"],
    },
  },
  {
    name: "mip_reupload_edi_schema",
    description: "Updates an existing EDI schema by id (new file + metadata).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the EDI schema to update" },
        filePath: { type: "string", description: "Full path of the new file" },
        resourceName: { type: "string", description: "Resource name" },
        ediType: { type: "string", enum: EDI_TYPES, description: "EDI standard" },
        resourceType: { type: "string", enum: ["xsd", "xslt"], description: "Resource type" },
        dataFormat: { type: "string", description: "Data format" },
        version: { type: "string", description: "Version (optional)" },
      },
      required: ["id", "filePath", "resourceName", "ediType"],
    },
  },
  {
    name: "mip_delete_edi_schema",
    description: "Deletes a specific EDI schema by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "ID of the EDI schema to delete" } },
      required: ["id"],
    },
  },
  {
    name: "mip_download_edi_schema",
    description: "Downloads a specific EDI schema file and saves it to MIP_DOWNLOAD_DIR.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "ID of the EDI schema to download" } },
      required: ["id"],
    },
  },
];

// Ortak: multipart body (file + data JSON).
function buildForm(args) {
  if (!fs.existsSync(args.filePath)) throw err.fileNotFound(args.filePath);
  const form = new FormData();
  form.append("file", fs.createReadStream(args.filePath));
  form.append(
    "data",
    JSON.stringify({
      resourceName: args.resourceName,
      resourceType: args.resourceType ?? "xsd",
      ediType: args.ediType,
      dataFormat: args.dataFormat ?? "XML",
      version: args.version ?? "",
    })
  );
  return form;
}

const handlers = {
  mip_list_edi_schemas: async (args, headers) => {
    const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 25 };
    if (args.filter) params.filter = args.filter;
    const res = await axios.get(`${BASE_URL}/api/edi-schemas`, { headers, params });
    return JSON.stringify(res.data, null, 2);
  },

  mip_upload_edi_schema: async (args, headers) => {
    const form = buildForm(args);
    const res = await axios.put(`${BASE_URL}/api/edi-schemas/upload`, form, {
      headers: { ...headers, ...form.getHeaders() },
    });
    return msg.uploadedRef("EDI schema", args.resourceName, res.data);
  },

  mip_reupload_edi_schema: async (args, headers) => {
    const form = buildForm(args);
    const res = await axios.put(`${BASE_URL}/api/edi-schemas/${args.id}/upload`, form, {
      headers: { ...headers, ...form.getHeaders() },
    });
    return msg.updatedRef("EDI schema", `id ${args.id}`, res.data);
  },

  mip_delete_edi_schema: async (args, headers) => {
    const res = await axios.delete(`${BASE_URL}/api/edi-schemas/${args.id}`, { headers });
    return msg.deletedRef("EDI schema", `id ${args.id}`, res.data);
  },

  mip_download_edi_schema: async (args, headers) => {
    const res = await axios.get(`${BASE_URL}/api/edi-schemas/${args.id}/download`, {
      headers,
      responseType: "arraybuffer",
    });
    const filename = extractFilename(res.headers, `edi_schema_${args.id}.xsd`);
    const filePath = saveFile(Buffer.from(res.data), filename);
    return msg.downloaded("EDI schema", filePath);
  },
};

export default { tools, handlers };
