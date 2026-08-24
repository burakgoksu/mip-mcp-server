// ─── Config (env variables) ───────────────────────────────────────────────────
import path from "path";
import os from "os";
import { t } from "./i18n/index.js";

// Sondaki slash'i temizle ki `${BASE_URL}/api/...` çift-slash üretmesin
// (ör. env "http://host/" verilmişse).
export const BASE_URL = (process.env.MIP_BASE_URL || "").replace(/\/+$/, "");
export const MIP_USERNAME = process.env.MIP_USERNAME;
export const MIP_PASSWORD = process.env.MIP_PASSWORD;
export const DOWNLOAD_DIR = process.env.MIP_DOWNLOAD_DIR || path.join(os.homedir(), "mip-downloads");
// System-health / alert-configuration servisi ayrı bir path prefix'te (frontend:
// VITE_MAIN_SYSTEM_HEALTH_URL). ONPREM'de "/healthcheck-service"; env ile override edilebilir.
export const HEALTH_BASE = `${BASE_URL}${process.env.MIP_HEALTH_PATH || "/healthcheck-service"}`;

if (!BASE_URL || !MIP_USERNAME || !MIP_PASSWORD) {
  process.stderr.write(
    t("startup.missingEnv", null,
      "Error: the MIP_BASE_URL, MIP_USERNAME and MIP_PASSWORD environment variables must be defined in settings.json.\n")
  );
  process.exit(1);
}
