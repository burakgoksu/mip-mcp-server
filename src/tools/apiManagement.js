// ─── API Management (APISIX gateway) ──────────────────────────────────────────
// MIP'in API Gateway'i (APISIX tabanlı). Üç sekme:
//   Routes    → /api/api-management/routes    (yayınlanan API route'ları + upstream + plugin)
//   Consumer  → /api/api-management/consumers (gateway tüketicileri + basic/jwt kimlik)
//   Rejected  → /api/api-management/rejected-requests (reddedilen istek logları, sayfalı)
// Liste yanıtları { list:[{key,value}] } biçiminde; value gerçek kaydı taşır.
import axios from "axios";
import { BASE_URL } from "../config.js";

const API = `${BASE_URL}/api/api-management`;
const values = (d) => (Array.isArray(d?.list) ? d.list.map((x) => x.value ?? x) : d);

// Dostça kısayolları (rateLimit/ipWhitelist/allowedConsumers/openIdConnect/basicAuth)
// APISIX plugin objesine çevir. Ham `plugins` en son merge edilir → aynı anahtarda ileri ayar override eder.
function buildPlugins(args) {
  const p = {};
  if (args.rateLimit?.count) p["limit-count"] = { count: args.rateLimit.count, time_window: args.rateLimit.window ?? 60, rejected_code: args.rateLimit.rejectedCode ?? 429 };
  if (args.ipWhitelist?.length) p["ip-restriction"] = { message: args.ipMessage || "Access denied", whitelist: args.ipWhitelist };
  if (args.allowedConsumers?.length) p["consumer-restriction"] = { whitelist: args.allowedConsumers, type: "consumer_name", rejected_code: 403 };
  if (args.openIdConnect) p["openid-connect"] = args.openIdConnect;
  if (args.basicAuth) p["basic-auth"] = {};
  return { ...p, ...(args.plugins || {}) };
}

// UI: Host+Weight satırlarını APISIX nodes objesine ({ "host:port": weight }) çevir.
function buildRoute(args) {
  const nodes = {};
  for (const nd of args.nodes || []) if (nd.host) nodes[nd.host] = Number(nd.weight ?? 1);
  const body = { id: args.id, name: args.name, uri: args.uri, upstream: { type: args.upstreamType || "roundrobin", nodes }, plugins: buildPlugins(args) };
  if (args.methods?.length) body.methods = args.methods;
  return body;
}

// Consumer + opsiyonel kimlik (BASIC/JWT) gövdesi.
function buildConsumer(args) {
  const body = { username: args.username, plugins: args.plugins || {} };
  if (args.credentialType === "BASIC" && args.password) {
    body.credentials = [{ id: args.username, plugins: { "basic-auth": { username: args.username, password: args.password } } }];
  } else if (args.credentialType === "JWT") {
    const jwt = { key: args.jwtKey || args.username };
    if (args.jwtAlgorithm) jwt.algorithm = args.jwtAlgorithm;
    if (args.jwtSecret) jwt.secret = args.jwtSecret;
    body.credentials = [{ id: args.jwtKey || args.username, plugins: { "jwt-auth": jwt } }];
  }
  return body;
}

const NODE_ITEM = { type: "object", properties: { host: { type: "string", description: "Upstream host:port (ör. 'mip-backend:9000')" }, weight: { type: "number", description: "Ağırlık (varsayılan 1)" } }, required: ["host"] };

// Route'a plugin eklemek için dostça kısayollar (UI'daki 5 toggle) + ham escape-hatch.
const PLUGIN_PROPS = {
  rateLimit: { type: "object", description: "Rate Limiting kısayolu (limit-count).", properties: { count: { type: "number", description: "İzin verilen istek sayısı" }, window: { type: "number", description: "Pencere, saniye (varsayılan 60)" }, rejectedCode: { type: "number", description: "Limit aşılınca HTTP kodu (varsayılan 429)" } }, required: ["count"] },
  ipWhitelist: { type: "array", items: { type: "string" }, description: "IP White List kısayolu (ip-restriction): izinli IP/CIDR (ör. ['192.168.0.0/24'])." },
  ipMessage: { type: "string", description: "IP reddinde dönecek mesaj (varsayılan 'Access denied')." },
  allowedConsumers: { type: "array", items: { type: "string" }, description: "Consumer Restriction kısayolu: yalnız bu consumer adları erişebilir." },
  openIdConnect: { type: "object", description: "OpenID Connect kısayolu (openid-connect).", properties: { discovery: { type: "string" }, client_id: { type: "string" }, client_secret: { type: "string" } }, required: ["discovery", "client_id", "client_secret"] },
  basicAuth: { type: "boolean", description: "Basic Auth plugin'ini aç (basic-auth): consumer'ların basic-auth kimliğini zorunlu kılar." },
  plugins: { type: "object", description: "İleri kullanım: ham APISIX plugin objesi. Kısayollarla merge edilir; aynı anahtarda bunu ezer." },
};

const tools = [
  // ── Routes ──
  {
    name: "mip_list_api_routes",
    description: "API Management > Routes: gateway'de yayınlanan API route'larını listeler (id, name, uri, methods, upstream nodes, plugins, endpointAddress, status). GET /api/api-management/routes.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_create_api_route",
    description:
      "Yeni API route oluşturur (POST /api/api-management/routes). uri gateway'de dinlenecek yol (ör. /http/my-api); nodes en az bir upstream host:port. Plugin eklemek için dostça kısayollar kullan: rateLimit, ipWhitelist, allowedConsumers, openIdConnect, basicAuth (UI'daki 5 toggle). Gerekirse plugins ile ham APISIX objesi de verilebilir. Gateway proxy-rewrite/http-logger'ı kendi ekler.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Route ID (benzersiz)" },
        name: { type: "string", description: "Route adı" },
        uri: { type: "string", description: "Gateway yolu (ör. /http/my-api)" },
        methods: { type: "array", items: { type: "string" }, description: "HTTP metotları (ör. ['GET','POST']) — boşsa tümü" },
        nodes: { type: "array", items: NODE_ITEM, description: "Upstream düğümleri (host:port + weight)" },
        upstreamType: { type: "string", description: "Load-balance tipi (varsayılan 'roundrobin')" },
        ...PLUGIN_PROPS,
      },
      required: ["id", "name", "uri", "nodes"],
    },
  },
  {
    name: "mip_update_api_route",
    description: "Bir API route'unu günceller (PUT /api/api-management/routes/{id}). Gönderilen alanlarla route yeniden yazılır (name, uri, methods, nodes) — plugin'ler de kısayollar (rateLimit/ipWhitelist/allowedConsumers/openIdConnect/basicAuth) veya ham plugins ile yeniden verilir. Not: route tümüyle yeniden yazılır, o yüzden korunmasını istediğin plugin'leri de tekrar gönder.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek Route ID" },
        name: { type: "string" },
        uri: { type: "string" },
        methods: { type: "array", items: { type: "string" } },
        nodes: { type: "array", items: NODE_ITEM },
        upstreamType: { type: "string" },
        ...PLUGIN_PROPS,
      },
      required: ["id", "name", "uri", "nodes"],
    },
  },
  {
    name: "mip_delete_api_route",
    description: "Bir API route'unu siler (DELETE /api/api-management/routes/{id}).",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Route ID" } }, required: ["id"] },
  },

  // ── Consumers ──
  {
    name: "mip_list_api_consumers",
    description: "API Management > Consumer: gateway tüketicilerini listeler (username + plugins/kimlik). GET /api/api-management/consumers.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_create_api_consumer",
    description: "Yeni gateway consumer'ı oluşturur (POST /api/api-management/consumers). Opsiyonel kimlik: credentialType BASIC (password) ya da JWT (jwtKey/jwtSecret/jwtAlgorithm).",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Consumer adı (benzersiz)" },
        credentialType: { type: "string", enum: ["BASIC", "JWT"], description: "Opsiyonel kimlik tipi" },
        password: { type: "string", description: "BASIC için şifre" },
        jwtKey: { type: "string", description: "JWT için key (varsayılan username)" },
        jwtSecret: { type: "string", description: "JWT için secret" },
        jwtAlgorithm: { type: "string", description: "JWT algoritması (ör. HS256)" },
        plugins: { type: "object", description: "Ham plugin objesi (opsiyonel, ileri kullanım)" },
      },
      required: ["username"],
    },
  },
  {
    name: "mip_update_api_consumer",
    description: "Bir consumer'ın plugin'lerini günceller (PUT /api/api-management/consumers/{username}). plugins ham APISIX plugin objesidir.",
    inputSchema: { type: "object", properties: { username: { type: "string" }, plugins: { type: "object", description: "Ham plugin objesi" } }, required: ["username"] },
  },
  {
    name: "mip_delete_api_consumer",
    description: "Bir gateway consumer'ını siler (DELETE /api/api-management/consumers/{username}).",
    inputSchema: { type: "object", properties: { username: { type: "string" } }, required: ["username"] },
  },

  // ── Rejected Requests ──
  {
    name: "mip_search_rejected_requests",
    description: "API Management > Rejected Requests: gateway tarafından reddedilen istekleri arar (GET /api/api-management/rejected-requests, sayfalı). Tarih verilmezse son 24 saat. clientIp/requestUri/statusCode/consumerName ile filtrelenir.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Başlangıç (ISO 8601) — varsayılan 24 saat önce" },
        to: { type: "string", description: "Bitiş (ISO 8601) — varsayılan şimdi" },
        clientIp: { type: "string", description: "İstemci IP filtresi" },
        requestUri: { type: "string", description: "URI filtresi" },
        statusCode: { type: "string", description: "HTTP durum kodu (ör. '403')" },
        consumerName: { type: "string", description: "Consumer adı filtresi" },
        page: { type: "number", description: "Sayfa (0'dan başlar)" },
        size: { type: "number", description: "Sayfa başına kayıt (varsayılan 50)" },
      },
      required: [],
    },
  },
];

const handlers = {
  mip_list_api_routes: async (args, headers) => JSON.stringify(values((await axios.get(`${API}/routes`, { headers })).data), null, 2),
  mip_create_api_route: async (args, headers) => `Route oluşturuldu: ${JSON.stringify((await axios.post(`${API}/routes`, buildRoute(args), { headers })).data)}`,
  mip_update_api_route: async (args, headers) => `Route güncellendi (${args.id}): ${JSON.stringify((await axios.put(`${API}/routes/${encodeURIComponent(args.id)}`, buildRoute(args), { headers })).data)}`,
  mip_delete_api_route: async (args, headers) => `Route silindi (${args.id}): ${JSON.stringify((await axios.delete(`${API}/routes/${encodeURIComponent(args.id)}`, { headers })).data)}`,

  mip_list_api_consumers: async (args, headers) => JSON.stringify(values((await axios.get(`${API}/consumers`, { headers })).data), null, 2),
  mip_create_api_consumer: async (args, headers) => `Consumer oluşturuldu: ${JSON.stringify((await axios.post(`${API}/consumers`, buildConsumer(args), { headers })).data)}`,
  mip_update_api_consumer: async (args, headers) => `Consumer güncellendi (${args.username}): ${JSON.stringify((await axios.put(`${API}/consumers/${encodeURIComponent(args.username)}`, { username: args.username, plugins: args.plugins || {} }, { headers })).data)}`,
  mip_delete_api_consumer: async (args, headers) => `Consumer silindi (${args.username}): ${JSON.stringify((await axios.delete(`${API}/consumers/${encodeURIComponent(args.username)}`, { headers })).data)}`,

  mip_search_rejected_requests: async (args, headers) => {
    const p = {
      from: args.from || new Date(Date.now() - 86400000).toISOString(),
      to: args.to || new Date().toISOString(),
      page: args.page ?? 0,
      size: args.size ?? 50,
    };
    for (const k of ["clientIp", "requestUri", "statusCode", "consumerName"]) if (args[k]) p[k] = args[k];
    return JSON.stringify((await axios.get(`${API}/rejected-requests`, { headers, params: p })).data, null, 2);
  },
};

export default { tools, handlers };
