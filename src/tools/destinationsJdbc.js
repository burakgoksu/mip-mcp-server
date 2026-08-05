import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── JDBC Destinations (Operations > Destinations > JDBC) ──────────────────────
  // JDBC connector'ları için veritabanı hedefleri. Endpoint: /api/databases.
  {
    name: "mip_list_jdbc_destinations",
    description:
      "JDBC destination (veritabanı) listesini döner. Her kayıt: databaseName, databaseDriver, databaseUrl, databaseUsername. Parola güvenlik için gizlenir. Sayfalıdır.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Opsiyonel: ad/sürücü/kullanıcı/url içinde geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_jdbc_destination",
    description:
      "Yeni bir JDBC destination oluşturur. userName/password TÜM sürücülerde zorunludur (mongodb dahil). jdbcUrl bağlantı stringidir.",
    inputSchema: {
      type: "object",
      properties: {
        databaseName: { type: "string", description: "Destination adı (benzersiz)" },
        driver: {
          type: "string",
          enum: [
            "org.postgresql.Driver",
            "com.mysql.jdbc.Driver",
            "com.microsoft.sqlserver.jdbc.SQLServerDriver",
            "oracle.jdbc.OracleDriver",
            "mongodb",
          ],
          description: "JDBC sürücüsü (PostgreSQL/MySQL/MSSQL/Oracle/MongoDB)",
        },
        jdbcUrl: {
          type: "string",
          description: "Bağlantı stringi, ör. jdbc:postgresql://host:port/db?currentSchema=dbo",
        },
        userName: { type: "string", description: "Kullanıcı adı (tüm sürücülerde zorunlu)" },
        password: { type: "string", description: "Parola (tüm sürücülerde zorunlu)" },
      },
      required: ["databaseName", "driver", "jdbcUrl", "userName", "password"],
    },
  },
  {
    name: "mip_update_jdbc_destination",
    description:
      "Mevcut bir JDBC destination'ı id ile günceller. Verilen alanlar mevcut kaydın üstüne merge edilir (parola verilmezse korunur).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Güncellenecek destination ID (mip_list_jdbc_destinations ile alınır)" },
        databaseName: { type: "string", description: "Yeni ad (opsiyonel)" },
        driver: {
          type: "string",
          enum: [
            "org.postgresql.Driver",
            "com.mysql.jdbc.Driver",
            "com.microsoft.sqlserver.jdbc.SQLServerDriver",
            "oracle.jdbc.OracleDriver",
            "mongodb",
          ],
          description: "Yeni sürücü (opsiyonel)",
        },
        jdbcUrl: { type: "string", description: "Yeni bağlantı stringi (opsiyonel)" },
        userName: { type: "string", description: "Yeni kullanıcı adı (opsiyonel)" },
        password: { type: "string", description: "Yeni parola (opsiyonel; verilmezse mevcut korunur)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_jdbc_destination",
    description: "Belirli bir JDBC destination'ı id ile siler.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "Silinecek destination ID" },
      },
      required: ["id"],
    },
  },
];

const handlers = {
    // ─── JDBC Destinations (/api/databases) ─────────────────────────────────────
    // Not: response alan adları request'ten farklı (databaseDriver/databaseUrl/
    // databaseUsername/databasePassword — parola base64). Request: driver/jdbcUrl/
    // userName/password.
    mip_list_jdbc_destinations: async (args, headers) => {
      const params = {
        paginationPage: (args.page ?? 1) - 1,
        paginationSize: args.size ?? 200,
      };
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: ["databaseName", "databaseDriver", "databaseUsername", "databaseUrl"].map((k) => ({
            filterKey: k,
            operation: "cn",
            value: args.filter,
          })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/databases`, { headers, params });
      const items = res.data?.content ?? (Array.isArray(res.data) ? res.data : []);
      const safe = items.map(({ databasePassword, ...rest }) => rest);
      return JSON.stringify(res.data?.content ? { ...res.data, content: safe } : safe, null, 2);
    },

    mip_create_jdbc_destination: async (args, headers) => {
      // Backend userName/password'ü TÜM sürücülerde zorunlu tutar (mongodb dahil).
      if (!args.userName || !args.password) {
        throw new Error("userName ve password zorunludur (mongodb dahil tüm sürücüler).");
      }
      const body = {
        databaseName: args.databaseName,
        driver: args.driver,
        jdbcUrl: args.jdbcUrl,
        userName: args.userName,
        password: args.password,
      };
      const res = await axios.post(`${BASE_URL}/api/databases`, body, { headers });
      return `JDBC destination oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_jdbc_destination: async (args, headers) => {
      const { id } = args;
      const cur = await axios.get(`${BASE_URL}/api/databases`, {
        headers,
        params: { paginationPage: 0, paginationSize: 500 },
      });
      const items = cur.data?.content ?? (Array.isArray(cur.data) ? cur.data : []);
      const existing = items.find((d) => d.id === id);
      if (!existing) throw new Error(`JDBC destination bulunamadı: id ${id}`);
      // response alanlarını request alanlarına map et; parola base64 -> düz metin.
      const decodePw = (v) => {
        if (!v) return "";
        try { return Buffer.from(v, "base64").toString("utf8"); } catch { return v; }
      };
      const body = {
        databaseName: args.databaseName ?? existing.databaseName,
        driver: args.driver ?? existing.databaseDriver,
        jdbcUrl: args.jdbcUrl ?? existing.databaseUrl,
        userName: args.userName ?? existing.databaseUsername,
        password: args.password ?? decodePw(existing.databasePassword),
      };
      const res = await axios.put(`${BASE_URL}/api/databases/${id}`, body, { headers });
      return `JDBC destination güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_jdbc_destination: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/databases/${args.id}`, { headers });
      return `JDBC destination silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
