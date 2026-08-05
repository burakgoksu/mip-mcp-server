import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import { saveFile, extractFilename } from "../util.js";

const tools = [
  // ── Key Store ──
  {
    name: "mip_upload_key_store",
    description: "Yeni bir key store (.jks) dosyası yükler.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Key store dosyasının tam yolu" },
        entryName: { type: "string", description: "Key store entry adı" },
        entryType: {
          type: "string",
          description: "Entry tipi: PRIVATE_KEY veya CERTIFICATE",
        },
        passphrase: { type: "string", description: "Key store şifresi" },
      },
      required: ["filePath", "entryName", "entryType", "passphrase"],
    },
  },
  {
    name: "mip_reupload_key_store",
    description: "Mevcut bir key store'u günceller.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek key store ID" },
        filePath: { type: "string", description: "Yeni key store dosyasının tam yolu" },
        entryName: { type: "string", description: "Key store entry adı" },
        entryType: { type: "string", description: "Entry tipi: PRIVATE_KEY veya CERTIFICATE" },
        passphrase: { type: "string", description: "Mevcut şifre" },
        newPassphrase: { type: "string", description: "Yeni şifre (opsiyonel)" },
      },
      required: ["id", "filePath", "entryName", "entryType", "passphrase"],
    },
  },
  {
    name: "mip_download_key_store",
    description: "Belirli bir key store'u indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Key store ID" },
        passphrase: { type: "string", description: "Key store şifresi" },
      },
      required: ["id", "passphrase"],
    },
  },
  // ── Certificate ──
  {
    name: "mip_upload_certificate",
    description: "Yeni bir sertifika (.crt / .pem) dosyası yükler.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Sertifika dosyasının tam yolu" },
        name: { type: "string", description: "Sertifika adı" },
      },
      required: ["filePath", "name"],
    },
  },
  {
    name: "mip_reupload_certificate",
    description: "Mevcut bir sertifikayı günceller.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek sertifika ID" },
        filePath: { type: "string", description: "Yeni sertifika dosyasının tam yolu" },
        name: { type: "string", description: "Yeni sertifika adı (opsiyonel)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_download_certificate",
    description: "Belirli bir sertifikayı indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sertifika ID" },
      },
      required: ["id"],
    },
  },
];

const handlers = {
    // ── Key Store ────────────────────────────────────────────────────────────
    mip_upload_key_store: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
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
      return `Key store yüklendi: ${JSON.stringify(res.data)}`;
    },

    mip_reupload_key_store: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
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
      return `Key store güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_download_key_store: async (args, headers) => {
      const res = await axios.post(
        `${BASE_URL}/api/key-stores/${args.id}/download`,
        { passphrase: args.passphrase },
        { headers: { ...headers, "Content-Type": "application/json" }, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `keystore_${args.id}.jks`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Key store indirildi: ${filePath}`;
    },
    // ── Certificate ──────────────────────────────────────────────────────────
    mip_upload_certificate: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      form.append("data", JSON.stringify({ name: args.name }));
      const res = await axios.post(`${BASE_URL}/api/certificates/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Sertifika yüklendi: ${JSON.stringify(res.data)}`;
    },

    mip_reupload_certificate: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      if (args.name) {
        form.append("data", JSON.stringify({ name: args.name }));
      }
      const res = await axios.put(`${BASE_URL}/api/certificates/${args.id}/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Sertifika güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_download_certificate: async (args, headers) => {
      const res = await axios.get(
        `${BASE_URL}/api/certificates/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `certificate_${args.id}.crt`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Sertifika indirildi: ${filePath}`;
    },
};

export default { tools, handlers };
