import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ── Credentials ──
  {
    name: "mip_list_credentials",
    description: "MIP'teki tüm user credential'ları listeler.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "İsme göre filtrele (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_credential",
    description: `MIP'e yeni bir user credential tanımlar. Desteklenen tipler:
- BASIC: username/password (REST, SFTP, FTP, Mail vb.)
- OAUTH_2: OAuth2 token tabanlı (grant type: CLIENT_CREDENTIALS | PASSWORD_CREDENTIALS | AUTHORIZATION_CODE)
- AZURE: Azure AD client credentials
- AWS: AWS access key/secret
- GOOGLE_PUBSUB: Google servis hesabı JSON key

BASIC:   { credentialName, credentialType:"BASIC", basicAuthUsername, password }
OAUTH_2 client_credentials: { credentialName, credentialType:"OAUTH_2", oAuth2GrantType:"CLIENT_CREDENTIALS", oAuth2TokenUrl, oAuth2ClientId, oAuth2ClientSecret, oAuth2SendAs:"Body"|"Header" }
OAUTH_2 password: { ...+ username, password }
AZURE:   { credentialName, credentialType:"AZURE", azureTenantId, azureClientId, azureClientSecret }
AWS:     { credentialName, credentialType:"AWS", awsAccessKey, awsSecretKey, awsRegion }
GOOGLE:  { credentialName, credentialType:"GOOGLE_PUBSUB", googleServiceAccountJson }`,
    inputSchema: {
      type: "object",
      properties: {
        credentialName:          { type: "string",  description: "Benzersiz credential adı (flow'larda referans olarak kullanılır)" },
        credentialType:          { type: "string",  description: "BASIC | OAUTH_2 | AZURE | AWS | GOOGLE_PUBSUB" },
        basicAuthUsername:       { type: "string",  description: "BASIC/OAUTH_2: kullanıcı adı" },
        password:                { type: "string",  description: "BASIC/OAUTH_2(PASSWORD): şifre" },
        oAuth2GrantType:         { type: "string",  description: "OAUTH_2: CLIENT_CREDENTIALS | PASSWORD_CREDENTIALS | AUTHORIZATION_CODE" },
        oAuth2TokenUrl:          { type: "string",  description: "OAUTH_2: token endpoint URL" },
        oAuth2ClientId:          { type: "string",  description: "OAUTH_2: client ID" },
        oAuth2ClientSecret:      { type: "string",  description: "OAUTH_2: client secret" },
        oAuth2SendAs:            { type: "string",  description: "OAUTH_2: Body | Header (varsayılan: Body)" },
        oAuth2Scope:             { type: "string",  description: "OAUTH_2: scope (opsiyonel)" },
        oAuth2CheckAddBasicAuth: { type: "boolean", description: "OAUTH_2: Basic Auth da eklensin mi (varsayılan: false)" },
        username:                { type: "string",  description: "OAUTH_2 PASSWORD_CREDENTIALS: kaynak sistem kullanıcı adı" },
        azureTenantId:           { type: "string",  description: "AZURE: tenant ID" },
        azureClientId:           { type: "string",  description: "AZURE: client ID" },
        azureClientSecret:       { type: "string",  description: "AZURE: client secret" },
        awsAccessKey:            { type: "string",  description: "AWS: access key ID" },
        awsSecretKey:            { type: "string",  description: "AWS: secret access key" },
        awsRegion:               { type: "string",  description: "AWS: region (örn: eu-central-1)" },
        googleServiceAccountJson:{ type: "string",  description: "GOOGLE_PUBSUB: servis hesabı JSON içeriği" },
      },
      required: ["credentialName", "credentialType"],
    },
  },
  {
    name: "mip_update_credential",
    description: "Mevcut bir credential'ı günceller. credentialName değiştirilemez.",
    inputSchema: {
      type: "object",
      properties: {
        credentialName:       { type: "string", description: "Güncellenecek credential adı" },
        basicAuthUsername:    { type: "string", description: "BASIC: yeni kullanıcı adı" },
        password:             { type: "string", description: "BASIC/OAUTH_2: yeni şifre" },
        oAuth2TokenUrl:       { type: "string", description: "OAUTH_2: yeni token URL" },
        oAuth2ClientId:       { type: "string", description: "OAUTH_2: yeni client ID" },
        oAuth2ClientSecret:   { type: "string", description: "OAUTH_2: yeni client secret" },
        oAuth2Scope:          { type: "string", description: "OAUTH_2: yeni scope" },
        azureTenantId:        { type: "string", description: "AZURE: yeni tenant ID" },
        azureClientId:        { type: "string", description: "AZURE: yeni client ID" },
        azureClientSecret:    { type: "string", description: "AZURE: yeni client secret" },
        awsAccessKey:         { type: "string", description: "AWS: yeni access key" },
        awsSecretKey:         { type: "string", description: "AWS: yeni secret key" },
      },
      required: ["credentialName"],
    },
  },
  {
    name: "mip_delete_credential",
    description: "Bir credential'ı siler. Herhangi bir flow tarafından kullanılıyorsa silinemez.",
    inputSchema: {
      type: "object",
      properties: {
        credentialName: { type: "string", description: "Silinecek credential adı" },
      },
      required: ["credentialName"],
    },
  },
];

const handlers = {
    // ── Credentials ──────────────────────────────────────────────────────────
    mip_list_credentials: async (args, headers) => {
      const params = { paginationSize: 200 };
      if (args.filter) params.filter = args.filter;
      const res = await axios.get(`${BASE_URL}/api/user-credentials`, { headers, params });
      const items = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
      const safe = items.map(({ password, clientSecret, privateKey, basicAuthPassword, oAuth2ClientSecret, azureClientSecret, awsSecretKey, googleServiceAccountJson, ...rest }) => rest);
      return JSON.stringify(safe, null, 2);
    },

    mip_create_credential: async (args, headers) => {
      const body = { oAuth2CheckAddBasicAuth: false, ...args };
      const res = await axios.post(`${BASE_URL}/api/user-credentials`, body, { headers });
      return `Credential oluşturuldu: ${JSON.stringify(res.data)}`;
    },

    mip_update_credential: async (args, headers) => {
      const { credentialName, ...updates } = args;
      const res = await axios.put(`${BASE_URL}/api/user-credentials/${credentialName}`, updates, { headers });
      return `Credential güncellendi: ${JSON.stringify(res.data)}`;
    },

    mip_delete_credential: async (args, headers) => {
      const res = await axios.delete(`${BASE_URL}/api/user-credentials/${args.credentialName}`, { headers });
      return `Credential silindi: ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
