import axios from "axios";
import { BASE_URL } from "../config.js";

const tools = [
  // ── Credentials ──
  {
    name: "mip_list_credentials",
    description: "Lists every user credential in MIP.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filter by name (optional)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_credential",
    description: `Defines a new user credential in MIP. Supported types:
- BASIC: username/password (REST, SFTP, FTP, Mail etc.)
- OAUTH_2: OAuth2 token based (grant type: CLIENT_CREDENTIALS | PASSWORD_CREDENTIALS | AUTHORIZATION_CODE)
- AZURE: Azure AD client credentials
- AWS: AWS access key/secret
- GOOGLE_PUBSUB: Google service account JSON key

BASIC:   { credentialName, credentialType:"BASIC", basicAuthUsername, password }
OAUTH_2 client_credentials: { credentialName, credentialType:"OAUTH_2", oAuth2GrantType:"CLIENT_CREDENTIALS", oAuth2TokenUrl, oAuth2ClientId, oAuth2ClientSecret, oAuth2SendAs:"Body"|"Header" }
OAUTH_2 password: { ...+ username, password }
AZURE:   { credentialName, credentialType:"AZURE", azureTenantId, azureClientId, azureClientSecret }
AWS:     { credentialName, credentialType:"AWS", awsAccessKey, awsSecretKey, awsRegion }
GOOGLE:  { credentialName, credentialType:"GOOGLE_PUBSUB", googleServiceAccountJson }`,
    inputSchema: {
      type: "object",
      properties: {
        credentialName:          { type: "string",  description: "Unique credential name (referenced from flows)" },
        credentialType:          { type: "string",  description: "BASIC | OAUTH_2 | AZURE | AWS | GOOGLE_PUBSUB" },
        basicAuthUsername:       { type: "string",  description: "BASIC/OAUTH_2: user name" },
        password:                { type: "string",  description: "BASIC/OAUTH_2(PASSWORD): password" },
        oAuth2GrantType:         { type: "string",  description: "OAUTH_2: CLIENT_CREDENTIALS | PASSWORD_CREDENTIALS | AUTHORIZATION_CODE" },
        oAuth2TokenUrl:          { type: "string",  description: "OAUTH_2: token endpoint URL" },
        oAuth2ClientId:          { type: "string",  description: "OAUTH_2: client ID" },
        oAuth2ClientSecret:      { type: "string",  description: "OAUTH_2: client secret" },
        oAuth2SendAs:            { type: "string",  description: "OAUTH_2: Body | Header (default: Body)" },
        oAuth2Scope:             { type: "string",  description: "OAUTH_2: scope (optional)" },
        oAuth2CheckAddBasicAuth: { type: "boolean", description: "OAUTH_2: also add Basic Auth (default: false)" },
        username:                { type: "string",  description: "OAUTH_2 PASSWORD_CREDENTIALS: source system user name" },
        azureTenantId:           { type: "string",  description: "AZURE: tenant ID" },
        azureClientId:           { type: "string",  description: "AZURE: client ID" },
        azureClientSecret:       { type: "string",  description: "AZURE: client secret" },
        awsAccessKey:            { type: "string",  description: "AWS: access key ID" },
        awsSecretKey:            { type: "string",  description: "AWS: secret access key" },
        awsRegion:               { type: "string",  description: "AWS: region (e.g. eu-central-1)" },
        googleServiceAccountJson:{ type: "string",  description: "GOOGLE_PUBSUB: service account JSON content" },
      },
      required: ["credentialName", "credentialType"],
    },
  },
  {
    name: "mip_update_credential",
    description: "Updates an existing credential. credentialName cannot be changed.",
    inputSchema: {
      type: "object",
      properties: {
        credentialName:       { type: "string", description: "Name of the credential to update" },
        basicAuthUsername:    { type: "string", description: "BASIC: new user name" },
        password:             { type: "string", description: "BASIC/OAUTH_2: new password" },
        oAuth2TokenUrl:       { type: "string", description: "OAUTH_2: new token URL" },
        oAuth2ClientId:       { type: "string", description: "OAUTH_2: new client ID" },
        oAuth2ClientSecret:   { type: "string", description: "OAUTH_2: new client secret" },
        oAuth2Scope:          { type: "string", description: "OAUTH_2: new scope" },
        azureTenantId:        { type: "string", description: "AZURE: new tenant ID" },
        azureClientId:        { type: "string", description: "AZURE: new client ID" },
        azureClientSecret:    { type: "string", description: "AZURE: new client secret" },
        awsAccessKey:         { type: "string", description: "AWS: new access key" },
        awsSecretKey:         { type: "string", description: "AWS: new secret key" },
      },
      required: ["credentialName"],
    },
  },
  {
    name: "mip_delete_credential",
    description: "Deletes a credential. It cannot be deleted while any flow is using it.",
    inputSchema: {
      type: "object",
      properties: {
        credentialName: { type: "string", description: "Name of the credential to delete" },
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
