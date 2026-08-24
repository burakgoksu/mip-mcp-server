import axios from "axios";
import { BASE_URL } from "../config.js";
import { msg, err, t } from "../i18n/index.js";

const tools = [
  // ─── OFTP2 Connections (Operations > Destinations > OFTP2) ─────────────────────
  // OFTP2 dosya transfer bağlantıları. Endpoint: /api/oftp-connections.
  // NOT: create/update ZORUNLU olarak bir partner certificate (id) ve own keystore
  // (id) ister — sistemde keystore yoksa oluşturulamaz.
  {
    name: "mip_list_oftp2_connections",
    description:
      "Returns the OFTP2 connection list (oftp2Name, own/partner SSID/SFID, expectedVirtualFileName, fileEncoding, flags, cert/keystore names). Passwords are hidden. Paginated.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: search within name/own SSID/partner SSID/virtual file name" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Records per page (default 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_oftp2_connection",
    description:
      "Creates a new OFTP2 connection. partnerCertificateId (mip_list/upload_certificate) and ownKeyStoreId (keystore) are REQUIRED. SSID/SFID max 25, passwords max 8, expectedVirtualFileName max 26 characters (regex supported).",
    inputSchema: {
      type: "object",
      properties: {
        oftp2Name: { type: "string", description: "Connection name (unique)" },
        oftp2OwnSSID: { type: "string", description: "Own SSID (max 25)" },
        oftp2OwnSFID: { type: "string", description: "Own SFID (max 25)" },
        oftp2OwnPassword: { type: "string", description: "Own Password (max 8)" },
        oftp2PartnerSSID: { type: "string", description: "Partner SSID (max 25)" },
        oftp2PartnerSFID: { type: "string", description: "Partner SFID (max 25)" },
        oftp2PartnerPassword: { type: "string", description: "Partner Password (max 8)" },
        expectedVirtualFileName: { type: "string", description: "Expected virtual file name (max 26, regex supported)" },
        partnerCertificateId: { type: "number", description: "Partner certificate ID (REQUIRED)" },
        ownKeyStoreId: { type: "number", description: "Own keystore ID (REQUIRED)" },
        fileEncoding: { type: "string", description: "File encoding (default 'UTF-8')" },
        isCompressed: { type: "boolean", description: "Compression (default false)" },
        isSecureAuth: { type: "boolean", description: "Secure Auth (default false)" },
        isSigned: { type: "boolean", description: "Signed (default false)" },
        isVerifySignature: { type: "boolean", description: "Verify signature (default false)" },
      },
      required: [
        "oftp2Name",
        "oftp2OwnSSID",
        "oftp2OwnSFID",
        "oftp2OwnPassword",
        "oftp2PartnerSSID",
        "oftp2PartnerSFID",
        "oftp2PartnerPassword",
        "expectedVirtualFileName",
        "partnerCertificateId",
        "ownKeyStoreId",
      ],
    },
  },
  {
    name: "mip_update_oftp2_connection",
    description:
      "Updates an existing OFTP2 connection by id. The given fields are merged over the current record; passwords are kept if omitted.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the OFTP2 connection to update" },
        oftp2Name: { type: "string", description: "New name (optional)" },
        oftp2OwnSSID: { type: "string", description: "New own SSID (optional)" },
        oftp2OwnSFID: { type: "string", description: "New own SFID (optional)" },
        oftp2OwnPassword: { type: "string", description: "New own password (optional)" },
        oftp2PartnerSSID: { type: "string", description: "New partner SSID (optional)" },
        oftp2PartnerSFID: { type: "string", description: "New partner SFID (optional)" },
        oftp2PartnerPassword: { type: "string", description: "New partner password (optional)" },
        expectedVirtualFileName: { type: "string", description: "New virtual file name (optional)" },
        partnerCertificateId: { type: "number", description: "New partner certificate ID (optional)" },
        ownKeyStoreId: { type: "number", description: "New own keystore ID (optional)" },
        fileEncoding: { type: "string", description: "New encoding (optional)" },
        isCompressed: { type: "boolean", description: "Compression (optional)" },
        isSecureAuth: { type: "boolean", description: "Secure Auth (optional)" },
        isSigned: { type: "boolean", description: "Signed (optional)" },
        isVerifySignature: { type: "boolean", description: "Verify signature (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_oftp2_connection",
    description: "Deletes a specific OFTP2 connection by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "ID of the OFTP2 connection to delete" } },
      required: ["id"],
    },
  },
];

const handlers = {
    // ─── OFTP2 Connections (/api/oftp-connections) ──────────────────────────────
    // Create/update: cert+keystore ID zorunlu. payload flat alanlar +
    // oftp2PartnerCertificateId + oftp2OwnKeyStoreId.
    mip_list_oftp2_connections: async (args, headers) => {
      const params = { paginationPage: (args.page ?? 1) - 1, paginationSize: args.size ?? 200 };
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: ["oftp2Name", "oftp2OwnSSID", "oftp2PartnerSSID", "expectedVirtualFileName"].map((k) => ({
            filterKey: k,
            operation: "cn",
            value: args.filter,
          })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/oftp-connections`, { headers, params });
      const items = res.data?.content ?? (Array.isArray(res.data) ? res.data : []);
      const safe = items.map(({ oftp2OwnPassword, oftp2PartnerPassword, ...rest }) => rest);
      return JSON.stringify(res.data?.content ? { ...res.data, content: safe } : safe, null, 2);
    },

    mip_create_oftp2_connection: async (args, headers) => {
      const body = {
        oftp2Name: args.oftp2Name,
        oftp2OwnSSID: args.oftp2OwnSSID,
        oftp2OwnSFID: args.oftp2OwnSFID,
        oftp2OwnPassword: args.oftp2OwnPassword,
        oftp2PartnerSSID: args.oftp2PartnerSSID,
        oftp2PartnerSFID: args.oftp2PartnerSFID,
        oftp2PartnerPassword: args.oftp2PartnerPassword,
        expectedVirtualFileName: args.expectedVirtualFileName,
        fileEncoding: args.fileEncoding ?? "UTF-8",
        isCompressed: args.isCompressed ?? false,
        isSecureAuth: args.isSecureAuth ?? false,
        isSigned: args.isSigned ?? false,
        isVerifySignature: args.isVerifySignature ?? false,
        oftp2PartnerCertificateId: args.partnerCertificateId,
        oftp2OwnKeyStoreId: args.ownKeyStoreId,
      };
      const res = await axios.post(`${BASE_URL}/api/oftp-connections`, body, { headers });
      return msg.created("OFTP2 connection", res.data);
    },

    mip_update_oftp2_connection: async (args, headers) => {
      const { id } = args;
      const cur = await axios.get(`${BASE_URL}/api/oftp-connections`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const existing = items.find((o) => o.id === id);
      if (!existing) throw err.notFound("OFTP2 connection", id);
      const body = {
        oftp2Name: args.oftp2Name ?? existing.oftp2Name,
        oftp2OwnSSID: args.oftp2OwnSSID ?? existing.oftp2OwnSSID,
        oftp2OwnSFID: args.oftp2OwnSFID ?? existing.oftp2OwnSFID,
        oftp2PartnerSSID: args.oftp2PartnerSSID ?? existing.oftp2PartnerSSID,
        oftp2PartnerSFID: args.oftp2PartnerSFID ?? existing.oftp2PartnerSFID,
        expectedVirtualFileName: args.expectedVirtualFileName ?? existing.expectedVirtualFileName,
        fileEncoding: args.fileEncoding ?? existing.fileEncoding ?? "UTF-8",
        isCompressed: args.isCompressed ?? existing.isCompressed ?? false,
        isSecureAuth: args.isSecureAuth ?? existing.isSecureAuth ?? false,
        isSigned: args.isSigned ?? existing.isSigned ?? false,
        isVerifySignature: args.isVerifySignature ?? existing.isVerifySignature ?? false,
        oftp2PartnerCertificateId: args.partnerCertificateId ?? existing.oftp2PartnerCertificateId,
        oftp2OwnKeyStoreId: args.ownKeyStoreId ?? existing.oftp2OwnKeyStoreId,
      };
      // parolalar liste yanıtında yok; yalnızca verilirse gönder (verilmezse mevcut korunur).
      if (args.oftp2OwnPassword !== undefined) body.oftp2OwnPassword = args.oftp2OwnPassword;
      if (args.oftp2PartnerPassword !== undefined) body.oftp2PartnerPassword = args.oftp2PartnerPassword;
      const res = await axios.put(`${BASE_URL}/api/oftp-connections/${id}`, body, { headers });
      return msg.updated("OFTP2 connection", res.data);
    },

    mip_delete_oftp2_connection: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/oftp-connections/${args.id}`, { headers });
      return msg.deletedRef("OFTP2 connection", `id ${args.id}`, res.data);
    },
};

export default { tools, handlers };
