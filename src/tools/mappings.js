import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import { saveFile, extractFilename } from "../util.js";

const tools = [
  // ── Flow Mapping ──
  {
    name: "mip_export_flow_mappings",
    description: "Exports the given flow mapping IDs.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "number" },
          description: "List of flow mapping IDs to export",
        },
      },
      required: ["ids"],
    },
  },
  {
    name: "mip_import_flow_mappings",
    description: "Imports flow mappings from a zip file into the given flow.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Target flow ID" },
        filePath: { type: "string", description: "Full path of the zip file to import" },
      },
      required: ["flowId", "filePath"],
    },
  },
  // ── Flow Mapping Sample ──
  {
    name: "mip_upload_flow_mapping_sample",
    description: "Uploads a new flow mapping sample file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full path of the file to upload" },
        name: { type: "string", description: "Sample name" },
        flowMappingId: { type: "number", description: "Flow mapping ID to associate it with" },
      },
      required: ["filePath", "name", "flowMappingId"],
    },
  },
  {
    name: "mip_reupload_flow_mapping_sample",
    description: "Updates an existing flow mapping sample file.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the sample to update" },
        filePath: { type: "string", description: "Full path of the new file" },
        name: { type: "string", description: "New sample name (optional)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_download_flow_mapping_sample",
    description: "Downloads a specific flow mapping sample file.",
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
