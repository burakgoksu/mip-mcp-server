import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── OFTP2 Connections (Operations > Destinations > OFTP2) ─────────────────────
  // OFTP2 dosya transfer bağlantıları. Endpoint: /api/oftp-connections.
  // NOT: create/update ZORUNLU olarak bir partner certificate (id) ve own keystore
  // (id) ister — sistemde keystore yoksa oluşturulamaz.
  {
    name: "mip_list_oftp2_connections",
    description:
      "OFTP2 bağlantı listesini döner (oftp2Name, own/partner SSID/SFID, expectedVirtualFileName, fileEncoding, bayraklar, cert/keystore adları). Parolalar gizlidir. Sayfalıdır.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: ad/own SSID/partner SSID/virtual file name içinde arama" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_oftp2_connection",
    description:
      "Yeni bir OFTP2 bağlantısı oluşturur. partnerCertificateId (mip_list/upload_certificate) ve ownKeyStoreId (keystore) ZORUNLUDUR. SSID/SFID max 25, parolalar max 8, expectedVirtualFileName max 26 karakter (regex desteklenir).",
    inputSchema: {
      type: "object",
      properties: {
        oftp2Name: { type: "string", description: "Bağlantı adı (benzersiz)" },
        oftp2OwnSSID: { type: "string", description: "Own SSID (max 25)" },
        oftp2OwnSFID: { type: "string", description: "Own SFID (max 25)" },
        oftp2OwnPassword: { type: "string", description: "Own Password (max 8)" },
        oftp2PartnerSSID: { type: "string", description: "Partner SSID (max 25)" },
        oftp2PartnerSFID: { type: "string", description: "Partner SFID (max 25)" },
        oftp2PartnerPassword: { type: "string", description: "Partner Password (max 8)" },
        expectedVirtualFileName: { type: "string", description: "Beklenen sanal dosya adı (max 26, regex destekli)" },
        partnerCertificateId: { type: "number", description: "Partner sertifika ID (ZORUNLU)" },
        ownKeyStoreId: { type: "number", description: "Own keystore ID (ZORUNLU)" },
        fileEncoding: { type: "string", description: "Dosya kodlaması (varsayılan 'UTF-8')" },
        isCompressed: { type: "boolean", description: "Sıkıştırma (varsayılan false)" },
        isSecureAuth: { type: "boolean", description: "Secure Auth (varsayılan false)" },
        isSigned: { type: "boolean", description: "İmzalı (varsayılan false)" },
        isVerifySignature: { type: "boolean", description: "İmza doğrulama (varsayılan false)" },
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
      "Mevcut bir OFTP2 bağlantısını id ile günceller. Verilen alanlar mevcut kaydın üstüne merge edilir; parolalar verilmezse mevcut korunur.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Güncellenecek OFTP2 bağlantı ID" },
        oftp2Name: { type: "string", description: "Yeni ad (opsiyonel)" },
        oftp2OwnSSID: { type: "string", description: "Yeni own SSID (opsiyonel)" },
        oftp2OwnSFID: { type: "string", description: "Yeni own SFID (opsiyonel)" },
        oftp2OwnPassword: { type: "string", description: "Yeni own password (opsiyonel)" },
        oftp2PartnerSSID: { type: "string", description: "Yeni partner SSID (opsiyonel)" },
        oftp2PartnerSFID: { type: "string", description: "Yeni partner SFID (opsiyonel)" },
        oftp2PartnerPassword: { type: "string", description: "Yeni partner password (opsiyonel)" },
        expectedVirtualFileName: { type: "string", description: "Yeni sanal dosya adı (opsiyonel)" },
        partnerCertificateId: { type: "number", description: "Yeni partner sertifika ID (opsiyonel)" },
        ownKeyStoreId: { type: "number", description: "Yeni own keystore ID (opsiyonel)" },
        fileEncoding: { type: "string", description: "Yeni kodlama (opsiyonel)" },
        isCompressed: { type: "boolean", description: "Sıkıştırma (opsiyonel)" },
        isSecureAuth: { type: "boolean", description: "Secure Auth (opsiyonel)" },
        isSigned: { type: "boolean", description: "İmzalı (opsiyonel)" },
        isVerifySignature: { type: "boolean", description: "İmza doğrulama (opsiyonel)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_oftp2_connection",
    description: "Belirli bir OFTP2 bağlantısını id ile siler.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Silinecek OFTP2 bağlantı ID" } },
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
      return `OFTP2 bağlantısı oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_oftp2_connection: async (args, headers) => {
      const { id } = args;
      const cur = await axios.get(`${BASE_URL}/api/oftp-connections`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const existing = items.find((o) => o.id === id);
      if (!existing) throw new Error(`OFTP2 bağlantısı bulunamadı: id ${id}`);
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
      return `OFTP2 bağlantısı güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_oftp2_connection: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/oftp-connections/${args.id}`, { headers });
      return `OFTP2 bağlantısı silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
