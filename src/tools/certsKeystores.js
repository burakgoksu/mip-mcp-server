import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import { saveFile, extractFilename } from "../util.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  // ── Key Store ──
  {
    name: "mip_upload_key_store",
    description: "Uploads a new key store (.jks) file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full path of the key store file" },
        entryName: { type: "string", description: "Key store entry name" },
        entryType: {
          type: "string",
          description: "Entry type: PRIVATE_KEY or CERTIFICATE",
        },
        passphrase: { type: "string", description: "Key store passphrase" },
      },
      required: ["filePath", "entryName", "entryType", "passphrase"],
    },
  },
  {
    name: "mip_reupload_key_store",
    description: "Updates an existing key store.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the key store to update" },
        filePath: { type: "string", description: "Full path of the new key store file" },
        entryName: { type: "string", description: "Key store entry name" },
        entryType: { type: "string", description: "Entry type: PRIVATE_KEY or CERTIFICATE" },
        passphrase: { type: "string", description: "Current passphrase" },
        newPassphrase: { type: "string", description: "New passphrase (optional)" },
      },
      required: ["id", "filePath", "entryName", "entryType", "passphrase"],
    },
  },
  {
    name: "mip_download_key_store",
    description: "Downloads a specific key store.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Key store ID" },
        passphrase: { type: "string", description: "Key store passphrase" },
      },
      required: ["id", "passphrase"],
    },
  },
  // ── Certificate ──
  {
    name: "mip_upload_certificate",
    description: "Uploads a new certificate (.crt / .pem) file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full path of the certificate file" },
        name: { type: "string", description: "Certificate name" },
      },
      required: ["filePath", "name"],
    },
  },
  {
    name: "mip_reupload_certificate",
    description: "Updates an existing certificate.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the certificate to update" },
        filePath: { type: "string", description: "Full path of the new certificate file" },
        name: { type: "string", description: "New certificate name (optional)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_download_certificate",
    description: "Downloads a specific certificate.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Certificate ID" },
      },
      required: ["id"],
    },
  },
];

const handlers = {
    // ── Key Store ────────────────────────────────────────────────────────────
    mip_upload_key_store: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw err.fileNotFound(args.filePath);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      const data = {
        entryName: args.entryName,
        entryType: args.entryType,
        passphrase: args.passphrase,
      };
      form.append("data", JSON.stringify(data));
      const res = await axios.put(`${BASE_URL}/api/key-stores/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return msg.uploaded("Key store", res.data);
    },

    mip_reupload_key_store: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw err.fileNotFound(args.filePath);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      const data = {
        entryName: args.entryName,
        entryType: args.entryType,
        passphrase: args.passphrase,
      };
      if (args.newPassphrase) data.newPassphrase = args.newPassphrase;
      form.append("data", JSON.stringify(data));
      const res = await axios.put(`${BASE_URL}/api/key-stores/${args.id}/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return msg.updated("Key store", res.data);
    },

    mip_download_key_store: async (args, headers) => {
      const res = await axios.post(
        `${BASE_URL}/api/key-stores/${args.id}/download`,
        { passphrase: args.passphrase },
        { headers: { ...headers, "Content-Type": "application/json" }, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `keystore_${args.id}.jks`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return msg.downloaded("Key store", filePath);
    },
    // ── Certificate ──────────────────────────────────────────────────────────
    mip_upload_certificate: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw err.fileNotFound(args.filePath);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      form.append("data", JSON.stringify({ name: args.name }));
      const res = await axios.post(`${BASE_URL}/api/certificates/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return msg.uploaded("Certificate", res.data);
    },

    mip_reupload_certificate: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw err.fileNotFound(args.filePath);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      if (args.name) {
        form.append("data", JSON.stringify({ name: args.name }));
      }
      const res = await axios.put(`${BASE_URL}/api/certificates/${args.id}/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return msg.updated("Certificate", res.data);
    },

    mip_download_certificate: async (args, headers) => {
      const res = await axios.get(
        `${BASE_URL}/api/certificates/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `certificate_${args.id}.crt`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return msg.downloaded("Certificate", filePath);
    },
};

export default { tools, handlers };
