// ─── License (Operations > License Settings) — YALNIZCA OKUMA (GET) ────────────
// GÜVENLIK: License için SADECE salt-okunur GET. save/write ASLA.
import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  {
    name: "mip_get_license_detail",
    description:
      "License Settings (SALT-OKUNUR): lisans detayını döner — customerName, licenseType, status, startDate/endDate, licenseKey, enabledModules, contactMails vb. (Hassas licenseKeyData sunucu tarafından maskelenir.) Yalnızca GET; hiçbir değişiklik yapmaz.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_check_license",
    description:
      "License Settings (SALT-OKUNUR): lisans geçerlilik durumunu döner — valid (bool), startDate, endDate, features. Yalnızca GET.",
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
