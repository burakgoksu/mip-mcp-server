import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ─── JDBC Destinations (Operations > Destinations > JDBC) ──────────────────────
  // JDBC connector'ları için veritabanı hedefleri. Endpoint: /api/databases.
  {
    name: "mip_list_jdbc_destinations",
    description:
      "Returns the JDBC destination (database) list. Each record: databaseName, databaseDriver, databaseUrl, databaseUsername. The password is hidden for security. Paginated.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Optional: text occurring in the name/driver/user/url" },
        page: { type: "number", description: "Page (1-based, default 1)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 200)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_jdbc_destination",
    description:
      "Creates a new JDBC destination. userName/password are required for ALL drivers (including mongodb). jdbcUrl is the connection string.",
    inputSchema: {
      type: "object",
      properties: {
        databaseName: { type: "string", description: "Destination name (unique)" },
        driver: {
          type: "string",
          enum: [
            "org.postgresql.Driver",
            "com.mysql.jdbc.Driver",
            "com.microsoft.sqlserver.jdbc.SQLServerDriver",
            "oracle.jdbc.OracleDriver",
            "mongodb",
          ],
          description: "JDBC driver (PostgreSQL/MySQL/MSSQL/Oracle/MongoDB)",
        },
        jdbcUrl: {
          type: "string",
          description: "Connection string, e.g. jdbc:postgresql://host:port/db?currentSchema=dbo",
        },
        userName: { type: "string", description: "User name (required for all drivers)" },
        password: { type: "string", description: "Password (required for all drivers)" },
      },
      required: ["databaseName", "driver", "jdbcUrl", "userName", "password"],
    },
  },
  {
    name: "mip_update_jdbc_destination",
    description:
      "Updates an existing JDBC destination by id. The given fields are merged over the current record (the password is kept if omitted).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the destination to update (from mip_list_jdbc_destinations)" },
        databaseName: { type: "string", description: "New name (optional)" },
        driver: {
          type: "string",
          enum: [
            "org.postgresql.Driver",
            "com.mysql.jdbc.Driver",
            "com.microsoft.sqlserver.jdbc.SQLServerDriver",
            "oracle.jdbc.OracleDriver",
            "mongodb",
          ],
          description: "New driver (optional)",
        },
        jdbcUrl: { type: "string", description: "New connection string (optional)" },
        userName: { type: "string", description: "New user name (optional)" },
        password: { type: "string", description: "New password (optional; the existing one is kept if omitted)" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_delete_jdbc_destination",
    description: "Deletes a specific JDBC destination by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "ID of the destination to delete" },
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
