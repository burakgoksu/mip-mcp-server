// ─── Ortak yardımcılar ────────────────────────────────────────────────────────
import fs from "fs";
import path from "path";
import { DOWNLOAD_DIR } from "./config.js";

// Global flow config değeri: geçerli JSON metni ise parse et (obje/sayı/bool),
// değilse ham string bırak. MIP UI ile aynı davranış (Value: scalar or JSON).
export function parseConfigValue(v) {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function ensureDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

export function saveFile(buffer, filename) {
  ensureDownloadDir();
  const filePath = path.join(DOWNLOAD_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function extractFilename(headers, fallback) {
  const cd = headers["content-disposition"] || "";
  const match = cd.match(/filename="?([^";\n]+)"?/);
  return match ? match[1].trim() : fallback;
}
