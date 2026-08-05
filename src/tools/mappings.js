import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import { saveFile, extractFilename } from "../util.js";

const tools = [
  // ── Flow Mapping ──
  {
    name: "mip_export_flow_mappings",
    description: "Belirtilen flow mapping ID'lerini export eder.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "number" },
          description: "Export edilecek flow mapping ID listesi",
        },
      },
      required: ["ids"],
    },
  },
  {
    name: "mip_import_flow_mappings",
    description: "Zip dosyasından flow mapping'leri belirtilen flow'a import eder.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Hedef flow ID" },
        filePath: { type: "string", description: "Import edilecek zip dosyasının tam yolu" },
      },
      required: ["flowId", "filePath"],
    },
  },
  // ── Flow Mapping Sample ──
  {
    name: "mip_upload_flow_mapping_sample",
    description: "Yeni bir flow mapping sample dosyası yükler.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Yüklenecek dosyanın tam yolu" },
        name: { type: "string", description: "Sample adı" },
        flowMappingId: { type: "number", description: "İlişkilendirilecek flow mapping ID" },
      },
      required: ["filePath", "name", "flowMappingId"],
    },
  },
  {
    name: "mip_reupload_flow_mapping_sample",
    description: "Mevcut bir flow mapping sample dosyasını günceller.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek sample ID" },
        filePath: { type: "string", description: "Yeni dosyanın tam yolu" },
        name: { type: "string", description: "Yeni sample adı (opsiyonel)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_download_flow_mapping_sample",
    description: "Belirli bir flow mapping sample dosyasını indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sample ID" },
      },
      required: ["id"],
    },
  },
];

const handlers = {
    // ── Flow Mapping ─────────────────────────────────────────────────────────
    mip_export_flow_mappings: async (args, headers) => {
      const res = await axios.post(
        `${BASE_URL}/api/flow-mappings/export`,
        { ids: args.ids },
        {
          headers: { ...headers, "Content-Type": "application/json" },
          responseType: "arraybuffer",
        }
      );
      const filename = extractFilename(res.headers, `exported-flow-mappings.zip`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Flow mapping'ler export edildi: ${filePath}`;
    },

    mip_import_flow_mappings: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      const res = await axios.post(
        `${BASE_URL}/api/flows/${args.flowId}/flow-mappings/import`,
        form,
        { headers: { ...headers, ...form.getHeaders() } }
      );
      return `Flow mapping import tamamlandı: ${JSON.stringify(res.data)}`;
    },
    // ── Flow Mapping Sample ──────────────────────────────────────────────────
    mip_upload_flow_mapping_sample: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      form.append("data", JSON.stringify({ name: args.name, flowMappingId: args.flowMappingId }));
      const res = await axios.post(`${BASE_URL}/api/flow-mapping-samples/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Flow mapping sample yüklendi: ${JSON.stringify(res.data)}`;
    },

    mip_reupload_flow_mapping_sample: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      if (args.name) {
        form.append("data", JSON.stringify({ name: args.name }));
      }
      const res = await axios.put(
        `${BASE_URL}/api/flow-mapping-samples/${args.id}/upload`,
        form,
        { headers: { ...headers, ...form.getHeaders() } }
      );
      return `Flow mapping sample güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_download_flow_mapping_sample: async (args, headers) => {
      const res = await axios.get(
        `${BASE_URL}/api/flow-mapping-samples/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `flow_mapping_sample_${args.id}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Flow mapping sample indirildi: ${filePath}`;
    },
};

export default { tools, handlers };
