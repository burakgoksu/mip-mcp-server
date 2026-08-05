// ─── EDI Schemas (Operations > Edi-Schemas) ───────────────────────────────────
// EDIFACT/X12 vb. için XSD/XSLT şema dosyaları. Endpoint: /api/edi-schemas.
import axios from "axios";
import fs from "fs";
import FormData from "form-data";
import { BASE_URL } from "../config.js";
import { saveFile, extractFilename } from "../util.js";

const EDI_TYPES = ["EDIFACT", "EANCOM", "ANSI_X12", "ODETTE", "VDA", "TRADACOMS"];

const tools = [
  {
    name: "mip_list_edi_schemas",
    description:
      "EDI Schema listesini döner. Her kayıt: resourceName, ediType, resourceType (xsd/xslt), dataFormat, version. Sayfalıdır; filter isimde arar.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: ad içinde geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 25)" },
      },
      required: [],
    },
  },
  {
    name: "mip_upload_edi_schema",
    description:
      "Yeni bir EDI schema dosyası (.xsd/.xslt) yükler. ediType: EDIFACT/EANCOM/ANSI_X12/ODETTE/VDA/TRADACOMS. resourceType xsd veya xslt. dataFormat genelde XML.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Yüklenecek dosyanın tam yolu (.xsd/.xslt)" },
        resourceName: { type: "string", description: "Kaynak adı (ör. ORDERSD96A.xsd)" },
        ediType: { type: "string", enum: EDI_TYPES, description: "EDI standardı" },
        resourceType: { type: "string", enum: ["xsd", "xslt"], description: "Kaynak tipi (varsayılan xsd)" },
        dataFormat: { type: "string", description: "Veri formatı (varsayılan XML)" },
        version: { type: "string", description: "Sürüm (opsiyonel)" },
      },
      required: ["filePath", "resourceName", "ediType"],
    },
  },
  {
    name: "mip_reupload_edi_schema",
    description: "Mevcut bir EDI schema'yı id ile günceller (yeni dosya + meta).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Güncellenecek EDI schema ID" },
        filePath: { type: "string", description: "Yeni dosyanın tam yolu" },
        resourceName: { type: "string", description: "Kaynak adı" },
        ediType: { type: "string", enum: EDI_TYPES, description: "EDI standardı" },
        resourceType: { type: "string", enum: ["xsd", "xslt"], description: "Kaynak tipi" },
        dataFormat: { type: "string", description: "Veri formatı" },
        version: { type: "string", description: "Sürüm (opsiyonel)" },
      },
      required: ["id", "filePath", "resourceName", "ediType"],
    },
  },
  {
    name: "mip_delete_edi_schema",
    description: "Belirli bir EDI schema'yı id ile siler.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Silinecek EDI schema ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_download_edi_schema",
    description: "Belirli bir EDI schema dosyasını indirir ve MIP_DOWNLOAD_DIR'e kaydeder.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "İndirilecek EDI schema ID" } },
      required: ["id"],
    },
  },
];

// Ortak: multipart body (file + data JSON).
function buildForm(args) {
  if (!fs.existsSync(args.filePath)) throw new Error(`Dosya bulunamadı: ${args.filePath}`);
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
    return `EDI schema yüklendi (${args.resourceName}): ${JSON.stringify(res.data)}`;
  },

  mip_reupload_edi_schema: async (args, headers) => {
    const form = buildForm(args);
    const res = await axios.put(`${BASE_URL}/api/edi-schemas/${args.id}/upload`, form, {
      headers: { ...headers, ...form.getHeaders() },
    });
    return `EDI schema güncellendi (id ${args.id}): ${JSON.stringify(res.data)}`;
  },

  mip_delete_edi_schema: async (args, headers) => {
    const res = await axios.delete(`${BASE_URL}/api/edi-schemas/${args.id}`, { headers });
    return `EDI schema silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
  },

  mip_download_edi_schema: async (args, headers) => {
    const res = await axios.get(`${BASE_URL}/api/edi-schemas/${args.id}/download`, {
      headers,
      responseType: "arraybuffer",
    });
    const filename = extractFilename(res.headers, `edi_schema_${args.id}.xsd`);
    const filePath = saveFile(Buffer.from(res.data), filename);
    return `EDI schema indirildi: ${filePath}`;
  },
};

export default { tools, handlers };
