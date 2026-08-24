// ─── License (Operations > License Settings) — YALNIZCA OKUMA (GET) ────────────
// GÜVENLIK: License için SADECE salt-okunur GET. save/write ASLA.
import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  {
    name: "mip_get_license_detail",
    description:
      "License Settings (READ-ONLY): returns the license detail — customerName, licenseType, status, startDate/endDate, licenseKey, enabledModules, contactMails etc. (Sensitive licenseKeyData is masked server-side.) GET only; changes nothing.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_check_license",
    description:
      "License Settings (READ-ONLY): returns license validity — valid (bool), startDate, endDate, features. GET only.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

const handlers = {
  mip_get_license_detail: async (args, headers) => {
    const res = await axios.get(`${BASE_URL}/api/license/detail`, { headers });
    return JSON.stringify(res.data, null, 2);
  },

  mip_check_license: async (args, headers) => {
    const res = await axios.get(`${BASE_URL}/api/license/check`, { headers });
    return JSON.stringify(res.data, null, 2);
  },
};

export default { tools, handlers };
