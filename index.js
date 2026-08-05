#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

// ─── Paylaşılan modüller (config/auth/util) ───────────────────────────────────
import { BASE_URL, DOWNLOAD_DIR, HEALTH_BASE } from "./src/config.js";
import { getToken, authHeaders } from "./src/auth.js";
import { parseConfigValue, ensureDownloadDir, saveFile, extractFilename } from "./src/util.js";

// ─── Ağır modüller (xlsx / wsdl / flow-schema KB) ─────────────────────────────
import { buildSystemHealthXlsx, buildMonitoringReportXlsx } from "./src/xlsx.js";
import { ensureElementFormDefaultQualified, generateWsdl } from "./src/wsdl.js";
import { MIP_FLOW_SCHEMA, validateFlow } from "./src/kb/flowSchema.js";
// Modüler tool kayıtları (domain'ler taşındıkça dolar). Geçiş boyunca aşağıdaki
// LEGACY_TOOLS + switch ile birlikte çalışır.
import { tools as registryTools, handlers as HANDLERS } from "./src/registry.js";
// ─── Tool Definitions (henüz modüle taşınmamış olanlar) ───────────────────────
const LEGACY_TOOLS = [
  // ── Monitoring ──
  {
    name: "mip_download_logs",
    description: "MIP monitoring loglarını indirir. Flow bazlı successful/error/delivering sayılarını döner.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
        type: {
          type: "string",
          description: "Log tipleri, virgülle ayrılmış: SUCCESS,ERROR,DELIVERING",
          default: "SUCCESS,ERROR,DELIVERING",
        },
        paginationPage: { type: "number", description: "Sayfa numarası (opsiyonel)" },
        paginationSize: { type: "number", description: "Sayfa boyutu (opsiyonel)" },
        paginationSort: { type: "string", description: "Sıralama (opsiyonel, örn: 'desc,flowId')" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_get_flow_message_logs",
    description:
      "Bir flow'un MESAJ-BAZLI loglarını zaman damgasıyla döner (monitoring ekranında flow'a tıklayınca açılan liste). " +
      "Her kayıt: messageId, status, startDate/endDate (milisaniye hassasiyetli timestamp), ERROR kayıtlarında ayrıca nodeId/errorMessage. " +
      "Saat-bazlı hacim/yoğunluk analizi için bunu kullanın — mip_download_logs yalnızca toplam sayı verir, zaman bilgisi içermez. " +
      "ÖNEMLİ: 'type' TEK değer kabul eder (SUCCESS | ERROR | DELIVERING); virgüllü/çoklu verince boş (204) döner. Tüm statüler için ayrı ayrı çağırıp birleştirin. " +
      "startDate/endDate gün seviyesinde filtreler; saatlik kırılım için dönen kayıtların startDate alanından lokal olarak bucket'layın.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Flow ID (örn: F_SAP_TO_ICE_EDONUSUM)" },
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
        type: {
          type: "string",
          description: "Tek statü değeri",
          enum: ["SUCCESS", "ERROR", "DELIVERING"],
          default: "SUCCESS",
        },
        paginationPage: { type: "number", description: "Sayfa numarası (0 tabanlı, opsiyonel)" },
        paginationSize: { type: "number", description: "Sayfa boyutu (opsiyonel, örn: 1000)" },
        paginationSort: { type: "string", description: "Sıralama (opsiyonel, örn: 'asc,startDate')" },
        filter: { type: "string", description: "Metin filtresi (opsiyonel)" },
      },
      required: ["flowId", "startDate", "endDate"],
    },
  },
  {
    name: "mip_get_message_counts",
    description:
      "Zaman bucket'larına göre toplam başarılı/hatalı mesaj sayısını döner (dashboard mesaj grafiği). " +
      "timeType ile granülarite seçilir: DAY, WEEK, MONTH veya YEAR. SAATLİK (HOUR) DESTEKLENMEZ — saatlik kırılım için mip_get_flow_message_logs kullanın. " +
      "Not: startDate/endDate parametresi yoktur; paginationSize kadar en güncel bucket döner.",
    inputSchema: {
      type: "object",
      properties: {
        timeType: {
          type: "string",
          description: "Bucket granülaritesi",
          enum: ["DAY", "WEEK", "MONTH", "YEAR"],
          default: "DAY",
        },
        paginationSize: { type: "number", description: "Döndürülecek bucket sayısı (opsiyonel, örn: 60)" },
      },
      required: ["timeType"],
    },
  },
  {
    name: "mip_get_message_completion_times",
    description:
      "Monitoring > Performance-Monitoring ekranının verisi: tarih aralığında flow başına mesaj sayısını ve işlem (completion) süresini döner. " +
      "Performans/yavaş flow analizi için kullanışlıdır (zaman damgası içermez). filter ile flowId/flowName/messageCount içinde arama yapılabilir.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi 'YYYY-MM-DD' veya 'YYYY-MM-DD HH:mm'" },
        endDate: { type: "string", description: "Bitiş tarihi 'YYYY-MM-DD' veya 'YYYY-MM-DD HH:mm'" },
        filter: { type: "string", description: "Opsiyonel: flowId/flowName/messageCount içinde geçen metin" },
        page: { type: "number", description: "Sayfa (1'den başlar, varsayılan 1)" },
        paginationSize: { type: "number", description: "Sayfa boyutu (opsiyonel)" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_generate_monitoring_report",
    description:
      "Belirtilen tarih (ve opsiyonel saat) aralığındaki monitoring mesajlarını çekip çok sayfalı bir EXCEL (.xlsx) raporu üretir ve MIP_DOWNLOAD_DIR'e kaydeder. " +
      "Sayfalar: Özet, Saat (saat-bazlı dağılım + en sakin/yoğun saat), Gün x Saat ısı haritası, Flow x Saat ısı haritası, Günlük Toplam, Flow Özet. " +
      "Bakım/güncelleme için en sakin saati bulmak ya da hacim analizi için kullanılır. Saat damgaları MIP sistem saatiyle (ham) işlenir, saat kayması düzeltmesi UYGULANMAZ. " +
      "Not: startTime/endTime verilirse her gün içinde yalnızca o saat penceresindeki mesajlar sayılır.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
        startTime: { type: "string", description: "Günlük saat penceresi başlangıcı (HH:MM, opsiyonel)" },
        endTime: { type: "string", description: "Günlük saat penceresi bitişi (HH:MM, opsiyonel)" },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "Yalnızca bu flow'ları dahil et (opsiyonel; boş = aralıkta aktif tüm flow'lar)",
        },
        statuses: {
          type: "array",
          items: { type: "string", enum: ["SUCCESS", "ERROR", "DELIVERING"] },
          description: "Dahil edilecek statüler (opsiyonel; varsayılan: hepsi)",
        },
        fileName: { type: "string", description: "Çıktı dosya adı (opsiyonel; .xlsx eklenir)" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "mip_download_payload",
    description: "Belirli bir messageId'ye ait payload'ı indirir ve dosyaya kaydeder.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Message ID" },
        isPayloadOut: { type: "boolean", description: "true = payload out, false = payload in" },
      },
      required: ["messageId", "isPayloadOut"],
    },
  },
  {
    name: "mip_download_log_details_payload",
    description: "Log detaylarına ait payload'ı messageId ve nodeId ile indirir.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Message ID" },
        nodeId: { type: "string", description: "Node ID" },
        isPayloadOut: { type: "boolean", description: "true = payload out, false = payload in" },
      },
      required: ["messageId", "nodeId", "isPayloadOut"],
    },
  },
  {
    name: "mip_download_attachment_by_id",
    description: "Belirli bir attachment ID'si ile attachment indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Attachment ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "mip_download_all_attachments",
    description: "messageId ve nodeId'ye ait tüm attachment'ları zip olarak indirir.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "Message ID" },
        nodeId: { type: "string", description: "Node ID" },
      },
      required: ["messageId", "nodeId"],
    },
  },
  {
    name: "mip_get_system_logs",
    description: "Sistem log dosyasını tarih aralığına göre indirir.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
      },
      required: ["startDate", "endDate"],
    },
  },

  // ── Integration Flow ──
  {
    name: "mip_export_packages_and_flows",
    description: "Belirtilen package ve flow ID'lerini zip olarak export eder.",
    inputSchema: {
      type: "object",
      properties: {
        packageIds: {
          type: "array",
          items: { type: "string" },
          description: "Export edilecek package ID listesi (null = tüm package'lar)",
        },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "Export edilecek flow ID listesi (boş = tüm flow'lar)",
        },
      },
      required: [],
    },
  },
  {
    name: "mip_import_packages_and_flows",
    description: "Daha önce export edilmiş bir zip dosyasından package ve flow'ları import eder.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Import edilecek zip dosyasının tam yolu" },
      },
      required: ["filePath"],
    },
  },

  // ── Flow Mapping ──
  {
    name: "mip_export_flow_mappings",
    description: "Belirtilen flow mapping ID'lerini export eder.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "number" },
          description: "Export edilecek flow mapping ID listesi",
        },
      },
      required: ["ids"],
    },
  },
  {
    name: "mip_import_flow_mappings",
    description: "Zip dosyasından flow mapping'leri belirtilen flow'a import eder.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Hedef flow ID" },
        filePath: { type: "string", description: "Import edilecek zip dosyasının tam yolu" },
      },
      required: ["flowId", "filePath"],
    },
  },

  // ── Flow Mapping Sample ──
  {
    name: "mip_upload_flow_mapping_sample",
    description: "Yeni bir flow mapping sample dosyası yükler.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Yüklenecek dosyanın tam yolu" },
        name: { type: "string", description: "Sample adı" },
        flowMappingId: { type: "number", description: "İlişkilendirilecek flow mapping ID" },
      },
      required: ["filePath", "name", "flowMappingId"],
    },
  },
  {
    name: "mip_reupload_flow_mapping_sample",
    description: "Mevcut bir flow mapping sample dosyasını günceller.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek sample ID" },
        filePath: { type: "string", description: "Yeni dosyanın tam yolu" },
        name: { type: "string", description: "Yeni sample adı (opsiyonel)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_download_flow_mapping_sample",
    description: "Belirli bir flow mapping sample dosyasını indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sample ID" },
      },
      required: ["id"],
    },
  },

  // ── Key Store ──
  {
    name: "mip_upload_key_store",
    description: "Yeni bir key store (.jks) dosyası yükler.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Key store dosyasının tam yolu" },
        entryName: { type: "string", description: "Key store entry adı" },
        entryType: {
          type: "string",
          description: "Entry tipi: PRIVATE_KEY veya CERTIFICATE",
        },
        passphrase: { type: "string", description: "Key store şifresi" },
      },
      required: ["filePath", "entryName", "entryType", "passphrase"],
    },
  },
  {
    name: "mip_reupload_key_store",
    description: "Mevcut bir key store'u günceller.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek key store ID" },
        filePath: { type: "string", description: "Yeni key store dosyasının tam yolu" },
        entryName: { type: "string", description: "Key store entry adı" },
        entryType: { type: "string", description: "Entry tipi: PRIVATE_KEY veya CERTIFICATE" },
        passphrase: { type: "string", description: "Mevcut şifre" },
        newPassphrase: { type: "string", description: "Yeni şifre (opsiyonel)" },
      },
      required: ["id", "filePath", "entryName", "entryType", "passphrase"],
    },
  },
  {
    name: "mip_download_key_store",
    description: "Belirli bir key store'u indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Key store ID" },
        passphrase: { type: "string", description: "Key store şifresi" },
      },
      required: ["id", "passphrase"],
    },
  },

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

  // ── Service Users ──
  {
    name: "mip_list_service_users",
    description: "MIP'teki service user'ları listeler. MIP UI veya açılan servislere erişmek için kullanılan kullanıcılar.",
    inputSchema: {
      type: "object",
      properties: {
        page:   { type: "number", description: "Sayfa numarası (0'dan başlar, varsayılan: 0)" },
        size:   { type: "number", description: "Sayfa boyutu (varsayılan: 50)" },
        search: { type: "string", description: "Kullanıcı adı veya e-posta ile filtrele (opsiyonel)" },
      },
      required: [],
    },
  },
  {
    name: "mip_create_service_user",
    description: "Yeni bir MIP service user'ı oluşturur. Roller: developer, ui-user, monitoring, admin, service-user. ÖNEMLİ: Service user MIP platformuna erişmek için kullanılır (UI girişi, API çağrısı, Start node'unu tetiklemek). processHTTP/processSOAP node'larındaki basicAuthResourceName veya oAuth2ResourceName için SERVICE USER KULLANILMAZ — onlar için mip_create_credential kullanılır.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Kullanıcı adı (benzersiz olmalı)" },
        email:    { type: "string", description: "E-posta adresi" },
        password: { type: "string", description: "Şifre" },
        roles: {
          type: "array",
          items: { type: "string", enum: ["developer", "ui-user", "monitoring", "admin", "service-user"] },
          description: "Kullanıcı rolleri. En az bir rol gereklidir."
        },
      },
      required: ["username", "email", "password", "roles"],
    },
  },
  {
    name: "mip_update_service_user",
    description: "Mevcut bir MIP service user'ını günceller.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Güncellenecek kullanıcı adı" },
        email:    { type: "string", description: "Yeni e-posta adresi (opsiyonel)" },
        password: { type: "string", description: "Yeni şifre (opsiyonel)" },
        roles: {
          type: "array",
          items: { type: "string", enum: ["developer", "ui-user", "monitoring", "admin", "service-user"] },
          description: "Yeni roller (opsiyonel)"
        },
      },
      required: ["username"],
    },
  },
  {
    name: "mip_delete_service_user",
    description: "Bir MIP service user'ını siler.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Silinecek kullanıcı adı" },
      },
      required: ["username"],
    },
  },
  {
    name: "mip_toggle_service_user_lock",
    description: "Bir MIP service user'ının hesabını kilitler veya kilidini açar.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string", description: "Kullanıcı adı" },
        locked:   { type: "boolean", description: "true = kilitle, false = kilidi aç" },
      },
      required: ["username", "locked"],
    },
  },

  // ── Deploy / Undeploy / Log Level ──
  {
    name: "mip_deploy_flow",
    description: "Belirtilen flow'u deploy eder. Import sonrası otomatik çalışmaz — sadece açıkça çağrıldığında deploy yapar.",
    inputSchema: {
      type: "object",
      properties: {
        flowId:  { type: "string", description: "Deploy edilecek flow ID (örn: F_WEATHER_MCP)" },
        version: { type: "number", description: "Deploy edilecek versiyon numarası. Belirtilmezse mevcut son versiyon otomatik alınır." },
      },
      required: ["flowId"],
    },
  },

  {
    name: "mip_undeploy_flow",
    description: "Belirtilen flow'u undeploy eder (durdurur).",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Undeploy edilecek flow ID" },
      },
      required: ["flowId"],
    },
  },
  {
    name: "mip_set_flow_log_level",
    description: "Deploy edilmiş bir flow'un log seviyesini değiştirir. Seviye: 1=Only I/O Payload (varsayılan), 2=All Steps",
    inputSchema: {
      type: "object",
      properties: {
        flowId:   { type: "string", description: "Log seviyesi değiştirilecek flow ID" },
        logLevel: { type: "number", description: "Log seviyesi: 1=Only I/O Payload (varsayılan), 2=All Steps" },
      },
      required: ["flowId", "logLevel"],
    },
  },

  // ── Flow Schema & Builder ──
  {
    name: "mip_get_flow_schema",
    description: "MIP flow, node, resource ve package şema bilgisini döner. Yeni flow oluşturmadan önce bu tool çağrılmalıdır. 310+ gerçek flow (Kervan Prod dahil) analiz edilerek olusturulmus kapsamli sema ve template kutuphanesi. KARMASIK flow (birden fazla condition, error subflow, split) yapmadan once mutlaka 'flowTemplates' ve 'edgeSchema' bolumlerini oku.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "Belirli bir bolum getir. Gecerli degerler: 'flowStructure' | 'nodeSchema' | 'edgeSchema' | 'nodeTypes' | 'expressionLanguage' | 'flowTemplates' | 'validation' | 'importantNotes' | 'all' (varsayilan: 'all'). Condition/edge wiring icin: 'edgeSchema' + 'flowTemplates'. Deploy hatalarini onlemek icin: 'validation'.",
          default: "all"
        }
      },
      required: []
    }
  },
  {
    name: "mip_create_and_import_flow",
    description: `Verilen flow JSON tanımını doğrulayıp MIP'e import eder. flowData otomatik serialize edilir.

DOGRULAMA (v1.0.9): Import ONCESI flow otomatik dogrulanir. Deploy'da patlayan hatalar yakalanir: eksik/yanlis condition dal edge'i (conditionId<->edgeId eslesmesi), eksik veya coklu default dal, yetim edge, tekrar eden node id, processStart eksikligi, error subflow parentNode baglantisi. Hata varsa import YAPILMAZ ve duzeltme mesaji doner. Dogru yapi icin once mip_get_flow_schema('flowTemplates') cagir — hazir tam ornekler (conditionFlow, twoConditionsFlow, errorSubflowFragment) verir.

ÖN-KOŞUL — Flow icinde processStart node'u connectorType:"SOAP" ise:
1) ONCE WSDL hazır olmalı. Yoksa once mip_generate_wsdl ile uret (uploadAfter:true + flowId vererek aynı çağrıda yükleyebilirsin), ya da var olan bir WSDL dosyasi icin mip_upload_wsdl kullan.
2) WSDL'in MIP'te elementFormDefault="qualified" ile yuklendiginden emin ol (mip_generate_wsdl baked-in verir, mip_upload_wsdl auto-fix yapar, mip_upload_resource yapmaz).
3) SOAP Start node'unun connectorData (StartState) icindeki UC alani WSDL ile eslestir:
   - soapWSDLResource:  "<MIP'te yukledigin resourceName, orn: EchoService.wsdl>"
   - soapWSDLBinding:   "<serviceName>Binding"   (mip_generate_wsdl uretiminde bu format)
   - soapWSDLOperation: "<operation adi, orn: Echo>"
Bu alanlar bos veya uyumsuz ise SOAP Start adapter calismaz.

Diger node tipleri icin kural yok — SOAP Start (Sender) ozel.`,
    inputSchema: {
      type: "object",
      properties: {
        flow: {
          type: "object",
          description: "Oluşturulacak flow tanımı. flowId, flowName, flowPackageId, flowData (array) alanları zorunlu."
        },
        skipValidation: {
          type: "boolean",
          description: "true verilirse import oncesi flow dogrulamasi (condition/edge/default kontrolu) atlanir. Varsayilan false — normalde ATLAMA."
        }
      },
      required: ["flow"]
    }
  },

  // ── Resource (Groovy / XSLT / vb.) ──
  {
    name: "mip_upload_resource",
    description: "MIP'e Groovy script (.groovy), XSLT (.xsl/.xslt), XSD (.xsd) veya WSDL (.wsdl) resource dosyaları yükler. processScript / processXSLTMapping / processStart (SOAP) node'larında kullanılır. WSDL yüklerken elementFormDefault='qualified' zorunludur — hand-crafted WSDL'ler için mip_upload_wsdl tercih edilmeli (otomatik doğrular ve enjekte eder).",
    inputSchema: {
      type: "object",
      properties: {
        filePath:     { type: "string", description: "Yüklenecek dosyanın tam yolu (.groovy / .xsl / .xslt / .xsd / .wsdl)" },
        flowId:       { type: "string", description: "Resource'un bağlanacağı flow ID (örn: F_WEATHER_MCP)" },
        resourceName: { type: "string", description: "MIP'te görünecek resource adı (örn: weather_process.groovy, EchoService.wsdl)" },
        resourceType: { type: "string", description: "Resource tipi: 'groovy' | 'xsl' | 'xslt' | 'xsd' | 'wsdl'" },
      },
      required: ["filePath", "flowId", "resourceName", "resourceType"],
    },
  },
  {
    name: "mip_reupload_resource",
    description: "MIP'teki mevcut bir Groovy veya XSLT resource dosyasını günceller.",
    inputSchema: {
      type: "object",
      properties: {
        id:           { type: "number", description: "Güncellenecek resource ID" },
        filePath:     { type: "string", description: "Yeni dosyanın tam yolu" },
        resourceName: { type: "string", description: "Yeni resource adı (opsiyonel)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_list_resources",
    description: "MIP'teki tüm resource'ları listeler. Groovy / XSLT / XSD / WSDL dosyalarını görmek için kullanılır.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Belirli bir flow'a ait resource'ları filtrele (opsiyonel)" },
      },
      required: [],
    },
  },

  // ── WSDL (SOAP Sender icin) ──
  {
    name: "mip_generate_wsdl",
    description: `MIP-uyumlu bir WSDL dosyasi uretir ve diske kaydeder. Olusturulan WSDL'de elementFormDefault="qualified" otomatik olarak baked-in gelir (MIP'in zorunlu kosulu).
Tipik kullanim: SOAP Start (Sender) adapter icin yeni bir endpoint kontratı olusturmak. Uretilen dosya MIP_DOWNLOAD_DIR altina kaydedilir; istege bagli olarak ayni cagrida flow'a yuklenebilir (uploadAfter:true).
Operation tanimlari: her operation icin request/response field listesi verilmelidir. Field type degeri xsd: prefix'siz yazilirsa otomatik xsd: ekleniyor (string, int, long, decimal, boolean, dateTime, date, base64Binary).`,
    inputSchema: {
      type: "object",
      properties: {
        serviceName:     { type: "string", description: "WSDL service adi (orn: EchoService). Binding/PortType/Service isimleri bundan turetilir." },
        targetNamespace: { type: "string", description: "WSDL targetNamespace (orn: http://mdpgroup.com/mip/echo)" },
        serviceAddress:  { type: "string", description: "soap:address location degeri (opsiyonel, varsayilan: http://localhost/soap/<serviceName>)" },
        operations: {
          type: "array",
          description: "Operation listesi. Her operation: { name, soapAction?, request:{fields:[{name,type,minOccurs?,maxOccurs?}]}, response:{fields:[...]} }",
          items: {
            type: "object",
            properties: {
              name:       { type: "string", description: "Operation adi (orn: Echo, GetOrder)" },
              soapAction: { type: "string", description: "SOAPAction header (opsiyonel, varsayilan: <targetNamespace>/<name>)" },
              request:  { type: "object", description: "Request element tanimi: { fields: [{name, type, minOccurs?, maxOccurs?}] }" },
              response: { type: "object", description: "Response element tanimi: { fields: [{name, type, minOccurs?, maxOccurs?}] }" },
            },
            required: ["name"],
          },
        },
        resourceName: { type: "string", description: "MIP'te gorunecek dosya adi. Varsayilan: <serviceName>.wsdl" },
        outputPath:   { type: "string", description: "Kayit edilecek tam dosya yolu (opsiyonel, varsayilan MIP_DOWNLOAD_DIR/<resourceName>)" },
        uploadAfter:  { type: "boolean", description: "true ise WSDL ureteldikten sonra dogrudan flowId'ye yuklenir (varsayilan: false)" },
        flowId:       { type: "string", description: "uploadAfter=true ise yukleme yapilacak flow ID" },
      },
      required: ["serviceName", "targetNamespace", "operations"],
    },
  },
  {
    name: "mip_upload_wsdl",
    description: `Bir WSDL dosyasini MIP'e SOAP Start (Sender) resource'u olarak yukler. Yukleme oncesinde dosya icindeki tum <xs:schema> / <xsd:schema> elementlerinde elementFormDefault="qualified" oldugunu dogrular; eksikse otomatik enjekte eder, "unqualified" ise "qualified" ile degistirir. Duzeltilmis dosya MIP_DOWNLOAD_DIR altina yazildiktan sonra MIP'e gonderilir. mip_upload_resource'a gore farki: WSDL-ozel dogrulama ve auto-fix yapar.`,
    inputSchema: {
      type: "object",
      properties: {
        filePath:     { type: "string", description: "Yuklenecek WSDL dosyasinin tam yolu" },
        flowId:       { type: "string", description: "Resource'un baglanacagi flow ID (orn: F_SOAP_INBOUND)" },
        resourceName: { type: "string", description: "MIP'te gorunecek dosya adi (orn: EchoService.wsdl). Verilmezse dosya adi kullanilir." },
      },
      required: ["filePath", "flowId"],
    },
  },

  // ── Certificate ──
  {
    name: "mip_upload_certificate",
    description: "Yeni bir sertifika (.crt / .pem) dosyası yükler.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Sertifika dosyasının tam yolu" },
        name: { type: "string", description: "Sertifika adı" },
      },
      required: ["filePath", "name"],
    },
  },
  {
    name: "mip_reupload_certificate",
    description: "Mevcut bir sertifikayı günceller.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Güncellenecek sertifika ID" },
        filePath: { type: "string", description: "Yeni sertifika dosyasının tam yolu" },
        name: { type: "string", description: "Yeni sertifika adı (opsiyonel)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_download_certificate",
    description: "Belirli bir sertifikayı indirir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sertifika ID" },
      },
      required: ["id"],
    },
  },

  // ─── Editors (Operations > Editors) ───────────────────────────────────────────
  {
    name: "mip_execute_groovy_script",
    description:
      "Groovy Editor: bir Groovy script'ini verilen input body + header + property'lere karşı çalıştırır ve sonucu (output, headers, properties) döner. " +
      "ÖNEMLI: script bir `executeMessage` metodu tanımlamalı ve parametre tipi `com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO` OLMALI (varsayılan şablondaki Exchange tipi runtime'da ÇALIŞMAZ), metod bu message'ı geri döndürmeli. " +
      "DTO metotları: getBody()/setBody(x), getHeaders()/setHeader(name,value), getProperties()/setProperty(name,value). " +
      "Örnek: `def executeMessage(com.mdp.middleware.processor.connector.mappings.ScriptExchangeDTO message) { message.setBody(message.getBody().toString().toUpperCase()); return message }`",
    inputSchema: {
      type: "object",
      properties: {
        groovyScript: { type: "string", description: "Çalıştırılacak Groovy script (executeMessage(ScriptExchangeDTO) tanımlamalı, message döndürmeli)" },
        input: { type: "string", description: "Input message body (opsiyonel)" },
        headers: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Input header'ları [{name,value}] (opsiyonel)",
        },
        properties: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, value: { type: "string" } },
            required: ["name", "value"],
          },
          description: "Input exchange property'leri [{name,value}] (opsiyonel)",
        },
      },
      required: ["groovyScript"],
    },
  },
  {
    name: "mip_execute_xslt_transform",
    description:
      "XSLT Editor: verilen XML girdisine bir XSLT stylesheet uygular ve dönüşüm sonucunu (output, xsltVersion, outputMethod, status, errors) döner.",
    inputSchema: {
      type: "object",
      properties: {
        inputXml: { type: "string", description: "Dönüştürülecek XML girdi" },
        xsltCode: { type: "string", description: "XSLT stylesheet (tam <xsl:stylesheet> belgesi)" },
      },
      required: ["inputXml", "xsltCode"],
    },
  },

  // ─── Management: System Health & Test Connectivity ────────────────────────────
  {
    name: "mip_get_system_health",
    description:
      "System Health: MIP backend pod'larının anlık kaynak kullanımını döner — her pod için podName, cpuLoad (0-1 oran), memoryLoad (MB), inflightExchanges (işlenen mesaj sayısı). Salt-okunur.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_generate_system_health_report",
    description:
      "System Health verisinden detaylı bir rapor üretir. Anlık snapshot'ı birkaç kez örnekleyip (samples) her pod için CPU% ve bellek (MB) min/ort/maks + inflight değerlerini hesaplar, eşiklere göre değerlendirme (OK/UYARI) ile Markdown rapor döner. Not: bu instance'ta geçmiş (historical) veri yok; rapor kısa bir örnekleme penceresine dayanır.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Örnekleme sayısı (varsayılan 4, max 10)" },
        intervalMs: { type: "number", description: "Örnekler arası bekleme ms (varsayılan 800, max 3000)" },
      },
      required: [],
    },
  },
  {
    name: "mip_generate_system_health_excel",
    description:
      "System Health verisinden STANDART formatlı bir EXCEL (.xlsx) raporu üretir ve MIP_DOWNLOAD_DIR'e kaydeder. Sabit 2 sayfa: 'Ozet' (pod başına CPU%/bellek/inflight min-ort-maks + Durum) ve 'Ornekler' (ham örnekler). Şablon her çağrıda birebir aynıdır; yalnızca değerler değişir.",
    inputSchema: {
      type: "object",
      properties: {
        samples: { type: "number", description: "Örnekleme sayısı (varsayılan 5, max 10)" },
        intervalMs: { type: "number", description: "Örnekler arası bekleme ms (varsayılan 800, max 3000)" },
      },
      required: [],
    },
  },
  {
    name: "mip_test_connectivity",
    description:
      "Test Connectivity: MIP backend'inden verilen host:port hedefine bağlantı testi yapar (TCP/HTTP handshake, non-destructive). Sonuç: status (SUCCESS/UNREACHABLE), resultCode, duration, responsePayload.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", description: "Hedef host (IP veya alan adı)" },
        port: { type: "number", description: "Hedef port" },
        connectorType: { type: "string", description: "Opsiyonel bağlantı tipi (ör. TCP/HTTP)" },
      },
      required: ["host", "port"],
    },
  },

  // ─── Alert Configurations (Operations > Alert Configurations) ─────────────────
  // System-health uyarı yapılandırması: mail alıcıları, bileşen eşik kuralları,
  // cron sıklıkları. /healthcheck-service servisi üzerinden.
  {
    name: "mip_list_alert_config_emails",
    description: "Alert Configurations > Alert Mail Receivers: uyarı maillerinin gönderileceği e-posta adreslerini listeler ([{id,email}]).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_add_alert_config_email",
    description: "Alert Configurations: uyarı mail alıcısı ekler.",
    inputSchema: {
      type: "object",
      properties: { email: { type: "string", description: "Eklenecek e-posta adresi" } },
      required: ["email"],
    },
  },
  {
    name: "mip_remove_alert_config_email",
    description: "Alert Configurations: uyarı mail alıcısını id ile kaldırır (mip_list_alert_config_emails ile alınır).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number", description: "Silinecek mail alıcısı ID" } },
      required: ["id"],
    },
  },
  {
    name: "mip_get_alert_rules",
    description:
      "Alert Configurations > Alert Rules: her bileşen için eşik kurallarını döner (componentKey, displayName, cpuThresholdPercent, ramThresholdPercent, diskThresholdPercent, responseTimeThresholdMs, dbSizeThresholdGb, connectionPoolThresholdPercent).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_update_alert_rules",
    description:
      "Alert Configurations: bir veya daha fazla bileşenin eşik kuralını günceller. rules dizisindeki her öğe componentKey ile eşleşen mevcut kuralın üstüne merge edilir (verilmeyen eşikler korunur). Sadece değiştireceğin bileşenleri ver.",
    inputSchema: {
      type: "object",
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              componentKey: { type: "string", description: "Bileşen anahtarı (ör. backend-http, elasticsearch-db, activemq, postgres-db, redis, system, frontend-http)" },
              cpuThresholdPercent: { type: "number", description: "CPU eşiği % (opsiyonel)" },
              ramThresholdPercent: { type: "number", description: "RAM eşiği % (opsiyonel)" },
              diskThresholdPercent: { type: "number", description: "Disk eşiği % (opsiyonel)" },
              responseTimeThresholdMs: { type: "number", description: "Yanıt süresi eşiği ms (opsiyonel)" },
              dbSizeThresholdGb: { type: "number", description: "DB boyut eşiği GB (opsiyonel)" },
              connectionPoolThresholdPercent: { type: "number", description: "Bağlantı havuzu eşiği % (opsiyonel)" },
            },
            required: ["componentKey"],
          },
          description: "Güncellenecek kurallar",
        },
      },
      required: ["rules"],
    },
  },
  {
    name: "mip_get_cron_frequency",
    description: "Alert Configurations > Cron Frequency: her bileşenin health-check cron sıklığını döner ([{componentName, cronValue}]).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mip_update_cron_frequency",
    description:
      "Alert Configurations: bir veya daha fazla bileşenin health-check cron sıklığını günceller. crons dizisindeki her öğe componentName ile eşleşeni günceller (diğerleri korunur).",
    inputSchema: {
      type: "object",
      properties: {
        crons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              componentName: { type: "string", description: "Bileşen adı (ör. backend-http, postgres-db, redis, system, activemq, elasticsearch-db, frontend-http)" },
              cronValue: { type: "string", description: "Cron ifadesi (ör. '0 */30 * * * *')" },
            },
            required: ["componentName", "cronValue"],
          },
          description: "Güncellenecek cron'lar",
        },
      },
      required: ["crons"],
    },
  },

];

// Modül registry'sinden gelen tool'lar + henüz taşınmamış legacy tool'lar.
const TOOLS = [...registryTools, ...LEGACY_TOOLS];

// ─── Tool Handlers ────────────────────────────────────────────────────────────
async function handleTool(name, args) {
  await getToken();
  const headers = authHeaders();

  // Modüle taşınmış tool'lar registry'den; kalanlar aşağıdaki switch'ten.
  if (HANDLERS[name]) return HANDLERS[name](args, headers);

  switch (name) {
    // ── Monitoring ──────────────────────────────────────────────────────────
    case "mip_download_logs": {
      const params = {
        startDate: args.startDate,
        endDate: args.endDate,
        type: args.type ?? "SUCCESS,ERROR,DELIVERING",
      };
      if (args.paginationPage !== undefined) params.paginationPage = args.paginationPage;
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      if (args.paginationSort !== undefined) params.paginationSort = args.paginationSort;

      const res = await axios.get(`${BASE_URL}/api/monitoring/logs`, {
        headers,
        params,
      });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_get_flow_message_logs": {
      const params = {
        startDate: args.startDate,
        endDate: args.endDate,
        type: args.type ?? "SUCCESS",
      };
      if (args.paginationPage !== undefined) params.paginationPage = args.paginationPage;
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      if (args.paginationSort !== undefined) params.paginationSort = args.paginationSort;
      if (args.filter !== undefined) params.filter = args.filter;

      const res = await axios.get(
        `${BASE_URL}/api/monitoring/flows/${encodeURIComponent(args.flowId)}/logs`,
        { headers, params }
      );
      // 204 = bu kriterlerde kayıt yok (axios bunu hata saymaz, res.data boş gelir)
      if (res.status === 204 || !res.data) {
        return JSON.stringify(
          { flowId: args.flowId, type: params.type, content: [], totalElements: 0, note: "Bu kriterlerde kayıt yok (HTTP 204)." },
          null,
          2
        );
      }
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_get_message_counts": {
      const params = { timeType: args.timeType ?? "DAY" };
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      const res = await axios.get(`${BASE_URL}/api/message-counts`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_get_message_completion_times": {
      const params = {
        startDate: args.startDate,
        endDate: args.endDate,
        paginationPage: (args.page ?? 1) - 1,
      };
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
      if (args.filter) {
        const criteria = {
          dataOption: "any",
          searchCriteriaList: ["flowId", "flowName", "messageCount"].map((k) => ({
            filterKey: k,
            operation: "cn",
            value: args.filter,
          })),
        };
        params.filter = Buffer.from(JSON.stringify(criteria)).toString("base64");
      }
      const res = await axios.get(`${BASE_URL}/api/monitoring/logs/message-completion-times`, {
        headers,
        params,
      });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_generate_monitoring_report": {
      const { startDate, endDate } = args;
      const startTime = args.startTime || null;
      const endTime = args.endTime || null;
      const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
      const tMin = startTime ? toMin(startTime) : null;
      const tMax = endTime ? toMin(endTime) : null;

      // 1) aralıktaki flow listesi + statü sayıları
      const aggRes = await axios.get(`${BASE_URL}/api/monitoring/logs`, {
        headers,
        params: { startDate, endDate, paginationSize: 500 },
      });
      let flows = (aggRes.data?.content || []).map((f) => ({ id: f.flowId, s: f.successful, e: f.error, d: f.delivering }));
      if (Array.isArray(args.flowIds) && args.flowIds.length) {
        const set = new Set(args.flowIds);
        flows = flows.filter((f) => set.has(f.id));
      }
      const wantStatuses = Array.isArray(args.statuses) && args.statuses.length
        ? args.statuses
        : ["SUCCESS", "ERROR", "DELIVERING"];

      // 2) topla
      const hour = Array.from({ length: 24 }, () => ({ s: 0, e: 0, d: 0 }));
      const byDate = {}, dateHour = {}, flowHour = {}, flowTotals = {};
      let grand = 0, pulled = 0, truncated = false;
      const PAGE = 1000, SAFETY = 2000000;

      for (const f of flows) {
        const jobs = [];
        if (f.s > 0 && wantStatuses.includes("SUCCESS")) jobs.push("SUCCESS");
        if (f.e > 0 && wantStatuses.includes("ERROR")) jobs.push("ERROR");
        if (f.d > 0 && wantStatuses.includes("DELIVERING")) jobs.push("DELIVERING");
        for (const type of jobs) {
          let page = 0, got = 0, total = null;
          try {
            while (true) {
              const r = await axios.get(
                `${BASE_URL}/api/monitoring/flows/${encodeURIComponent(f.id)}/logs`,
                {
                  headers,
                  params: { startDate, endDate, type, paginationPage: page, paginationSize: PAGE, paginationSort: "asc,startDate" },
                  validateStatus: (s) => s === 200 || s === 204,
                }
              );
              if (r.status === 204 || !r.data || !Array.isArray(r.data.content) || r.data.content.length === 0) break;
              if (total === null) total = r.data.totalElements;
              for (const m of r.data.content) {
                const ts = m.startDate;
                if (!ts || ts.length < 16) continue;
                const hh = parseInt(ts.slice(11, 13), 10);
                const mm = parseInt(ts.slice(14, 16), 10);
                if (Number.isNaN(hh)) continue;
                if (tMin != null || tMax != null) {
                  const cur = hh * 60 + (Number.isNaN(mm) ? 0 : mm);
                  if (tMin != null && cur < tMin) continue;
                  if (tMax != null && cur > tMax) continue;
                }
                const date = ts.slice(0, 10);
                const k = m.status === "SUCCESS" ? "s" : m.status === "ERROR" ? "e" : "d";
                hour[hh][k]++;
                byDate[date] = (byDate[date] || 0) + 1;
                (dateHour[date] ||= Array(24).fill(0))[hh]++;
                (flowHour[f.id] ||= Array(24).fill(0))[hh]++;
                const ft = (flowTotals[f.id] ||= { s: 0, e: 0, d: 0 }); ft[k]++;
                grand++;
              }
              got += r.data.content.length;
              pulled += r.data.content.length;
              if (pulled >= SAFETY) { truncated = true; break; }
              if (got >= (total ?? got) || r.data.last) break;
              page++;
            }
          } catch (e) {
            process.stderr.write(`uyarı: ${f.id}/${type} çekilemedi: ${e.message}\n`);
          }
          if (truncated) break;
        }
        if (truncated) break;
      }

      // 3) xlsx üret + kaydet
      const meta = {
        startDate, endDate, startTime, endTime,
        flowCount: Object.keys(flowTotals).length,
        statuses: wantStatuses, grandTotal: grand, truncated,
      };
      const buf = await buildMonitoringReportXlsx({ hour, byDate, dateHour, flowHour, flowTotals, grandTotal: grand }, meta);
      let fileName = (args.fileName || `MIP_Monitoring_Raporu_${startDate}_${endDate}`).replace(/[^\w.\-]/g, "_");
      if (!fileName.toLowerCase().endsWith(".xlsx")) fileName += ".xlsx";
      const filePath = saveFile(buf, fileName);

      const totals = hour.map((h) => h.s + h.e + h.d);
      const nz = totals.map((t, i) => [i, t]).filter((x) => x[1] > 0).sort((a, b) => a[1] - b[1]);
      const quietest = nz[0], busiest = nz[nz.length - 1];
      const lines = [
        `Excel raporu oluşturuldu: ${filePath}`,
        `Aralık: ${startDate} → ${endDate}` + (startTime || endTime ? ` (saat ${startTime || "00:00"}-${endTime || "23:59"})` : ""),
        `Toplam mesaj: ${grand} | Flow sayısı: ${meta.flowCount} | Statüler: ${wantStatuses.join(",")}`,
      ];
      if (quietest && busiest) {
        lines.push(`En sakin saat: ${String(quietest[0]).padStart(2, "0")}:00 (${quietest[1]}) | En yoğun: ${String(busiest[0]).padStart(2, "0")}:00 (${busiest[1]})`);
      }
      if (truncated) lines.push("UYARI: Güvenlik limiti (2.000.000 kayıt) aşıldı; rapor kısmi. Daha dar aralık seçin.");
      return lines.join("\n");
    }

    case "mip_download_payload": {
      const res = await axios.get(`${BASE_URL}/api/monitoring/logs/download-payload`, {
        headers,
        params: { messageId: args.messageId, isPayloadOut: args.isPayloadOut },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `payload_${args.messageId}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Payload indirildi: ${filePath}`;
    }

    case "mip_download_log_details_payload": {
      const res = await axios.get(`${BASE_URL}/api/monitoring/log-details/download-payload`, {
        headers,
        params: {
          messageId: args.messageId,
          nodeId: args.nodeId,
          isPayloadOut: args.isPayloadOut,
        },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `log_details_${args.messageId}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Log detay payload indirildi: ${filePath}`;
    }

    case "mip_download_attachment_by_id": {
      const res = await axios.get(
        `${BASE_URL}/api/monitoring/attachments/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `attachment_${args.id}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Attachment indirildi: ${filePath}`;
    }

    case "mip_download_all_attachments": {
      const res = await axios.get(`${BASE_URL}/api/monitoring/attachments/download`, {
        headers,
        params: { messageId: args.messageId, nodeId: args.nodeId },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `attachments_${args.messageId}.zip`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Attachment'lar indirildi: ${filePath}`;
    }

    case "mip_get_system_logs": {
      const res = await axios.get(`${BASE_URL}/api/monitoring/logs/system-logs-file`, {
        headers,
        params: { startDate: args.startDate, endDate: args.endDate },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `system_logs_${args.startDate}_${args.endDate}.log`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Sistem logları indirildi: ${filePath}`;
    }

    // ── Credentials ──────────────────────────────────────────────────────────
    case "mip_list_credentials": {
      const params = { paginationSize: 200 };
      if (args.filter) params.filter = args.filter;
      const res = await axios.get(`${BASE_URL}/api/user-credentials`, { headers, params });
      const items = Array.isArray(res.data) ? res.data : (res.data?.content ?? []);
      const safe = items.map(({ password, clientSecret, privateKey, basicAuthPassword, oAuth2ClientSecret, azureClientSecret, awsSecretKey, googleServiceAccountJson, ...rest }) => rest);
      return JSON.stringify(safe, null, 2);
    }

    case "mip_create_credential": {
      const body = { oAuth2CheckAddBasicAuth: false, ...args };
      const res = await axios.post(`${BASE_URL}/api/user-credentials`, body, { headers });
      return `Credential oluşturuldu: ${JSON.stringify(res.data)}`;
    }

    case "mip_update_credential": {
      const { credentialName, ...updates } = args;
      const res = await axios.put(`${BASE_URL}/api/user-credentials/${credentialName}`, updates, { headers });
      return `Credential güncellendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_delete_credential": {
      const res = await axios.delete(`${BASE_URL}/api/user-credentials/${args.credentialName}`, { headers });
      return `Credential silindi: ${JSON.stringify(res.data)}`;
    }

    // ── Service Users ────────────────────────────────────────────────────────
    case "mip_list_service_users": {
      const params = {};
      if (args.page !== undefined) params.page = args.page;
      if (args.size !== undefined) params.size = args.size;
      if (args.search) params.search = args.search;
      const res = await axios.get(`${BASE_URL}/api/service-users`, { headers, params });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_create_service_user": {
      const res = await axios.post(`${BASE_URL}/api/service-users`, {
        username: args.username,
        email: args.email,
        password: args.password,
        roles: args.roles,
      }, { headers });
      return `Service user oluşturuldu: ${JSON.stringify(res.data)}`;
    }

    case "mip_update_service_user": {
      const body = {};
      if (args.email)    body.email    = args.email;
      if (args.password) body.password = args.password;
      if (args.roles)    body.roles    = args.roles;
      const res = await axios.put(`${BASE_URL}/api/service-users/${args.username}`, body, { headers });
      return `Service user güncellendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_delete_service_user": {
      const res = await axios.delete(`${BASE_URL}/api/service-users/${args.username}`, { headers });
      return `Service user silindi: ${JSON.stringify(res.data)}`;
    }

    case "mip_toggle_service_user_lock": {
      const res = await axios.put(
        `${BASE_URL}/api/service-users/${args.username}/change-account-lock`,
        { locked: args.locked },
        { headers }
      );
      return `Hesap kilidi ${args.locked ? "aktifleştirildi" : "kaldırıldı"}: ${JSON.stringify(res.data)}`;
    }

    // ── Deploy / Undeploy / Log Level ────────────────────────────────────────
    case "mip_deploy_flow": {
      let version = args.version;
      if (!version) {
        const flowRes = await axios.get(`${BASE_URL}/api/flows/${args.flowId}`, { headers });
        version = flowRes.data.version;
      }
      const res = await axios.post(
        `${BASE_URL}/api/flows/${args.flowId}/deploy?version=${version}`,
        null,
        { headers }
      );
      return `Flow deploy edildi: ${JSON.stringify(res.data)}`;
    }

    case "mip_undeploy_flow": {
      const res = await axios.put(
        `${BASE_URL}/api/flows/${args.flowId}/undeploy`,
        null,
        { headers }
      );
      return `Flow undeploy edildi: ${JSON.stringify(res.data)}`;
    }

    case "mip_set_flow_log_level": {
      if (![1, 2].includes(args.logLevel)) {
        throw new Error("logLevel 1 (Only I/O Payload) veya 2 (All Steps) olmalıdır.");
      }
      const res = await axios.put(
        `${BASE_URL}/api/flows/${args.flowId}/update-log-level?logLevel=${args.logLevel}`,
        null,
        { headers }
      );
      return `Log seviyesi güncellendi: ${JSON.stringify(res.data)}`;
    }

    // ── Flow Schema & Builder ────────────────────────────────────────────────
    case "mip_get_flow_schema": {
      const section = args.section ?? "all";
      if (section === "all") return JSON.stringify(MIP_FLOW_SCHEMA, null, 2);
      if (MIP_FLOW_SCHEMA[section]) return JSON.stringify(MIP_FLOW_SCHEMA[section], null, 2);
      return JSON.stringify({ error: `Bilinmeyen bölüm: ${section}. Geçerli değerler: ${Object.keys(MIP_FLOW_SCHEMA).join(", ")}` });
    }

    case "mip_create_and_import_flow": {
      const flowDef = args.flow;
      if (!flowDef.flowId || !flowDef.flowName || !flowDef.flowPackageId) {
        throw new Error("flow.flowId, flow.flowName ve flow.flowPackageId zorunludur.");
      }

      // Import ONCESI dogrulama — deploy'da patlayan edge/condition hatalarini yakala.
      // args.skipValidation === true ile atlanabilir.
      if (args.skipValidation !== true) {
        const { errors, warnings } = validateFlow(flowDef.flowData);
        if (errors.length > 0) {
          throw new Error(
            "Flow dogrulama HATASI — import edilmedi (deploy'da patlamamasi icin). " +
            "Duzelt ve tekrar dene, ya da mip_get_flow_schema('flowTemplates') ile dogru yapiyi gor.\n" +
            errors.map(e => "  ✗ " + e).join("\n") +
            (warnings.length ? "\n\nUyarilar:\n" + warnings.map(w => "  ! " + w).join("\n") : "") +
            "\n\n(Kasitli olarak atlamak icin skipValidation:true ver.)"
          );
        }
        if (warnings.length > 0) {
          console.error("[mip_create_and_import_flow] Dogrulama uyarilari:\n" + warnings.map(w => "  ! " + w).join("\n"));
        }
      }

      // flowData array ise string'e serialize et
      if (Array.isArray(flowDef.flowData)) {
        flowDef.flowData = JSON.stringify(flowDef.flowData);
      }
      // Audit alanlarını temizle (MIP otomatik atar)
      delete flowDef.id;
      delete flowDef.createdDate;
      delete flowDef.createdBy;
      delete flowDef.lastModifiedDate;
      delete flowDef.lastModifiedBy;

      // Import için zip oluştur
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const ts = Date.now();
      const packageObj = [{
        packageId: flowDef.flowPackageId,
        packageName: flowDef.flowPackageId,
        packageDescription: `${flowDef.flowPackageId} paketi`
      }];
      zip.folder("flows").file(`flows.${ts}.json`, JSON.stringify([flowDef]));
      zip.folder("packages").file(`packages.${ts}.json`, JSON.stringify(packageObj));
      zip.folder("resources").file(`resources.${ts}.json`, JSON.stringify([]));

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const zipPath = path.join(DOWNLOAD_DIR, `create-flow-${flowDef.flowId}-${ts}.zip`);
      fs.writeFileSync(zipPath, zipBuffer);

      const form = new FormData();
      form.append("filename", fs.createReadStream(zipPath));
      const res = await axios.post(`${BASE_URL}/api/packages/flows/import`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Flow '${flowDef.flowId}' başarıyla oluşturuldu ve MIP'e import edildi.\nSonuç: ${JSON.stringify(res.data)}`;
    }

    // ── Integration Flow ─────────────────────────────────────────────────────
    case "mip_export_packages_and_flows": {
      const body = {
        packageIds: args.packageIds ?? [null],
        flowIds: args.flowIds ?? [],
      };
      const res = await axios.post(`${BASE_URL}/api/packages/flows/export`, body, {
        headers: { ...headers, "Content-Type": "application/json" },
        responseType: "arraybuffer",
      });
      const filename = extractFilename(res.headers, `exported-packages-and-flows.zip`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Package ve Flow'lar export edildi: ${filePath}`;
    }

    case "mip_import_packages_and_flows": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("filename", fs.createReadStream(args.filePath));
      const res = await axios.post(`${BASE_URL}/api/packages/flows/import`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Import tamamlandı: ${JSON.stringify(res.data)}`;
    }

    // ── Flow Mapping ─────────────────────────────────────────────────────────
    case "mip_export_flow_mappings": {
      const res = await axios.post(
        `${BASE_URL}/api/flow-mappings/export`,
        { ids: args.ids },
        {
          headers: { ...headers, "Content-Type": "application/json" },
          responseType: "arraybuffer",
        }
      );
      const filename = extractFilename(res.headers, `exported-flow-mappings.zip`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Flow mapping'ler export edildi: ${filePath}`;
    }

    case "mip_import_flow_mappings": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      const res = await axios.post(
        `${BASE_URL}/api/flows/${args.flowId}/flow-mappings/import`,
        form,
        { headers: { ...headers, ...form.getHeaders() } }
      );
      return `Flow mapping import tamamlandı: ${JSON.stringify(res.data)}`;
    }

    // ── Flow Mapping Sample ──────────────────────────────────────────────────
    case "mip_upload_flow_mapping_sample": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      form.append("data", JSON.stringify({ name: args.name, flowMappingId: args.flowMappingId }));
      const res = await axios.post(`${BASE_URL}/api/flow-mapping-samples/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Flow mapping sample yüklendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_reupload_flow_mapping_sample": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      if (args.name) {
        form.append("data", JSON.stringify({ name: args.name }));
      }
      const res = await axios.put(
        `${BASE_URL}/api/flow-mapping-samples/${args.id}/upload`,
        form,
        { headers: { ...headers, ...form.getHeaders() } }
      );
      return `Flow mapping sample güncellendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_download_flow_mapping_sample": {
      const res = await axios.get(
        `${BASE_URL}/api/flow-mapping-samples/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `flow_mapping_sample_${args.id}.bin`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Flow mapping sample indirildi: ${filePath}`;
    }

    // ── Key Store ────────────────────────────────────────────────────────────
    case "mip_upload_key_store": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      const data = {
        entryName: args.entryName,
        entryType: args.entryType,
        passphrase: args.passphrase,
      };
      form.append("data", JSON.stringify(data));
      const res = await axios.put(`${BASE_URL}/api/key-stores/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Key store yüklendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_reupload_key_store": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      const data = {
        entryName: args.entryName,
        entryType: args.entryType,
        passphrase: args.passphrase,
      };
      if (args.newPassphrase) data.newPassphrase = args.newPassphrase;
      form.append("data", JSON.stringify(data));
      const res = await axios.put(`${BASE_URL}/api/key-stores/${args.id}/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Key store güncellendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_download_key_store": {
      const res = await axios.post(
        `${BASE_URL}/api/key-stores/${args.id}/download`,
        { passphrase: args.passphrase },
        { headers: { ...headers, "Content-Type": "application/json" }, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `keystore_${args.id}.jks`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Key store indirildi: ${filePath}`;
    }

    // ── Resource (Groovy / XSLT) ─────────────────────────────────────────────
    case "mip_upload_resource": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      form.append("data", JSON.stringify({
        flowId: args.flowId,
        resourceName: args.resourceName,
        resourceType: args.resourceType,
      }));
      const res = await axios.post(`${BASE_URL}/api/resources/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Resource yüklendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_reupload_resource": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      if (args.resourceName) {
        form.append("data", JSON.stringify({ resourceName: args.resourceName }));
      }
      const res = await axios.put(`${BASE_URL}/api/resources/${args.id}/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Resource güncellendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_list_resources": {
      const res = await axios.get(`${BASE_URL}/api/resources`, { headers });
      let resources = res.data?.content ?? res.data;
      if (args.flowId) {
        resources = resources.filter(r => r.flowId === args.flowId);
      }
      return JSON.stringify(resources, null, 2);
    }

    // ── WSDL (SOAP Sender icin) ──────────────────────────────────────────────
    case "mip_generate_wsdl": {
      const wsdlContent = generateWsdl({
        serviceName:     args.serviceName,
        targetNamespace: args.targetNamespace,
        serviceAddress:  args.serviceAddress,
        operations:      args.operations,
      });

      const resourceName = args.resourceName ?? `${args.serviceName}.wsdl`;
      ensureDownloadDir();
      const outPath = args.outputPath ?? path.join(DOWNLOAD_DIR, resourceName);
      fs.writeFileSync(outPath, wsdlContent, "utf8");

      let summary = `WSDL uretildi (elementFormDefault="qualified" baked-in): ${outPath}`;

      if (args.uploadAfter) {
        if (!args.flowId) {
          throw new Error("uploadAfter=true ise flowId zorunlu.");
        }
        const form = new FormData();
        form.append("file", fs.createReadStream(outPath));
        form.append("data", JSON.stringify({
          flowId: args.flowId,
          resourceName,
          resourceType: "wsdl",
        }));
        const res = await axios.post(`${BASE_URL}/api/resources/upload`, form, {
          headers: { ...headers, ...form.getHeaders() },
        });
        summary += `\nMIP'e yuklendi (flowId=${args.flowId}): ${JSON.stringify(res.data)}`;
      }

      // SOAP Start node'unu kurarken kopyala-yapistir icin bind metadata
      const bindingMetadata = {
        soapWSDLResource:  resourceName,
        soapWSDLBinding:   `${args.serviceName}Binding`,
        soapWSDLOperation: args.operations[0].name,
        availableOperations: args.operations.map(o => o.name),
        portTypeName:      `${args.serviceName}PortType`,
        serviceName:       args.serviceName,
        targetNamespace:   args.targetNamespace,
      };

      return `${summary}

SOAP Start connectorData'sina yazilacak alanlar (mip_create_and_import_flow icin):
${JSON.stringify(bindingMetadata, null, 2)}

--- WSDL Icerigi ---
${wsdlContent}`;
    }

    case "mip_upload_wsdl": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadi: ${args.filePath}`);
      }
      const original = fs.readFileSync(args.filePath, "utf8");
      const { content: fixed, warnings, modified } = ensureElementFormDefaultQualified(original);

      ensureDownloadDir();
      const baseName = args.resourceName ?? path.basename(args.filePath);
      let uploadPath = args.filePath;
      if (modified) {
        uploadPath = path.join(DOWNLOAD_DIR, baseName);
        fs.writeFileSync(uploadPath, fixed, "utf8");
      }

      const form = new FormData();
      form.append("file", fs.createReadStream(uploadPath));
      form.append("data", JSON.stringify({
        flowId: args.flowId,
        resourceName: baseName,
        resourceType: "wsdl",
      }));
      const res = await axios.post(`${BASE_URL}/api/resources/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });

      const validationNote = modified
        ? `Dogrulama duzeltmeleri yapildi:\n- ${warnings.join("\n- ")}\nDuzeltilmis dosya: ${uploadPath}`
        : `Dogrulama: tum <schema> elementlerinde elementFormDefault="qualified" zaten mevcut. Duzeltme gerekmedi.`;
      return `WSDL yuklendi: ${JSON.stringify(res.data)}\n${validationNote}`;
    }

    // ── Certificate ──────────────────────────────────────────────────────────
    case "mip_upload_certificate": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      form.append("data", JSON.stringify({ name: args.name }));
      const res = await axios.post(`${BASE_URL}/api/certificates/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Sertifika yüklendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_reupload_certificate": {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("file", fs.createReadStream(args.filePath));
      if (args.name) {
        form.append("data", JSON.stringify({ name: args.name }));
      }
      const res = await axios.put(`${BASE_URL}/api/certificates/${args.id}/upload`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Sertifika güncellendi: ${JSON.stringify(res.data)}`;
    }

    case "mip_download_certificate": {
      const res = await axios.get(
        `${BASE_URL}/api/certificates/${args.id}/download`,
        { headers, responseType: "arraybuffer" }
      );
      const filename = extractFilename(res.headers, `certificate_${args.id}.crt`);
      const filePath = saveFile(Buffer.from(res.data), filename);
      return `Sertifika indirildi: ${filePath}`;
    }

    // ─── Editors ────────────────────────────────────────────────────────────────
    case "mip_execute_groovy_script": {
      const body = {
        input: args.input ?? "",
        groovyScript: args.groovyScript,
        headers: args.headers ?? [],
        properties: args.properties ?? [],
      };
      const res = await axios.post(`${BASE_URL}/api/groovy-script-execute`, body, { headers });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_execute_xslt_transform": {
      const body = { inputXml: args.inputXml, xsltCode: args.xsltCode };
      const res = await axios.post(`${BASE_URL}/api/xslt-transform-execute`, body, { headers });
      return JSON.stringify(res.data, null, 2);
    }

    // ─── Management: System Health & Test Connectivity ──────────────────────────
    case "mip_get_system_health": {
      const res = await axios.get(`${BASE_URL}/api/backend-system-statics`, { headers });
      return JSON.stringify(res.data?.data ?? res.data, null, 2);
    }

    case "mip_generate_system_health_report": {
      const samples = Math.min(Math.max(args.samples ?? 4, 1), 10);
      const intervalMs = Math.min(Math.max(args.intervalMs ?? 800, 0), 3000);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const pods = {}; // podName -> { cpu:[], mem:[], inflight:[] }
      for (let i = 0; i < samples; i++) {
        const res = await axios.get(`${BASE_URL}/api/backend-system-statics`, { headers });
        const rows = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
        for (const p of rows) {
          const k = p.podName ?? "unknown";
          (pods[k] ??= { cpu: [], mem: [], inflight: [] });
          pods[k].cpu.push(Number(p.cpuLoad));
          pods[k].mem.push(Number(p.memoryLoad));
          pods[k].inflight.push(Number(p.inflightExchanges));
        }
        if (i < samples - 1) await sleep(intervalMs);
      }
      const stat = (a) => {
        const v = a.filter((x) => Number.isFinite(x));
        if (!v.length) return { min: 0, avg: 0, max: 0 };
        return { min: Math.min(...v), avg: v.reduce((s, x) => s + x, 0) / v.length, max: Math.max(...v) };
      };
      const pct = (x) => `${(x * 100).toFixed(2)}%`;
      const mb = (x) => `${x.toFixed(0)} MB (${(x / 1024).toFixed(2)} GB)`;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      let md = `# MIP System Health Raporu\n\n`;
      md += `**Zaman:** ${ts}  |  **Örnekleme:** ${samples} örnek × ${intervalMs}ms  |  **Pod sayısı:** ${Object.keys(pods).length}\n\n`;
      for (const [name, d] of Object.entries(pods)) {
        const c = stat(d.cpu), m = stat(d.mem), f = stat(d.inflight);
        const cpuWarn = c.max > 0.8 ? " ⚠️ YÜKSEK" : c.max > 0.5 ? " ⚠️" : " ✅";
        md += `## Pod: ${name}\n\n`;
        md += `| Metrik | Min | Ortalama | Maks | Durum |\n|---|---|---|---|---|\n`;
        md += `| CPU | ${pct(c.min)} | ${pct(c.avg)} | ${pct(c.max)} |${cpuWarn} |\n`;
        md += `| Bellek | ${mb(m.min)} | ${mb(m.avg)} | ${mb(m.max)} | ${m.max / 1024 > 8 ? "⚠️" : "✅"} |\n`;
        md += `| Inflight Exchanges | ${f.min} | ${f.avg.toFixed(1)} | ${f.max} | ${f.max > 1000 ? "⚠️ yoğun" : "✅"} |\n\n`;
      }
      md += `_Not: Bu MIP instance'ında geçmiş (historical) health verisi mevcut değil; rapor yukarıdaki kısa örnekleme penceresine dayanır._\n`;
      return md;
    }

    case "mip_generate_system_health_excel": {
      const samples = Math.min(Math.max(args.samples ?? 5, 1), 10);
      const intervalMs = Math.min(Math.max(args.intervalMs ?? 800, 0), 3000);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const pods = {};
      const sampleRows = [];
      for (let i = 0; i < samples; i++) {
        const res = await axios.get(`${BASE_URL}/api/backend-system-statics`, { headers });
        const rows = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
        for (const p of rows) {
          const k = p.podName ?? "unknown";
          (pods[k] ??= { cpu: [], mem: [], inflight: [] });
          const cpu = Number(p.cpuLoad), mem = Number(p.memoryLoad), inflight = Number(p.inflightExchanges);
          pods[k].cpu.push(cpu);
          pods[k].mem.push(mem);
          pods[k].inflight.push(inflight);
          sampleRows.push({ sample: i + 1, pod: k, cpu, mem, inflight });
        }
        if (i < samples - 1) await sleep(intervalMs);
      }
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const fnTs = ts.replace(/[: ]/g, "-");
      const buffer = await buildSystemHealthXlsx(pods, sampleRows, { ts, samples, intervalMs });
      const filePath = saveFile(buffer, `MIP_System_Health_${fnTs}.xlsx`);
      return `System Health Excel raporu oluşturuldu (${samples} örnek, ${Object.keys(pods).length} pod): ${filePath}`;
    }

    case "mip_test_connectivity": {
      const body = { host: args.host, port: args.port };
      if (args.connectorType) body.connectorType = args.connectorType;
      const res = await axios.put(`${BASE_URL}/api/test-connectivity`, body, { headers });
      return JSON.stringify(res.data?.data ? { ...res.data.data, message: res.data.message } : res.data, null, 2);
    }

    // ─── Alert Configurations (/healthcheck-service) ────────────────────────────
    case "mip_list_alert_config_emails": {
      const res = await axios.get(`${HEALTH_BASE}/api/email-alerts`, { headers });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_add_alert_config_email": {
      const res = await axios.post(`${HEALTH_BASE}/api/email-alerts`, JSON.stringify({ email: args.email }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      return `Alert mail alıcısı eklendi (${args.email}): ${JSON.stringify(res.data)}`;
    }

    case "mip_remove_alert_config_email": {
      const res = await axios.delete(`${HEALTH_BASE}/api/email-alerts/${args.id}`, { headers });
      return `Alert mail alıcısı silindi (id ${args.id}): ${JSON.stringify(res.data)}`;
    }

    case "mip_get_alert_rules": {
      const res = await axios.get(`${HEALTH_BASE}/api/alert-rules`, { headers });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_update_alert_rules": {
      // Mevcut kuralları çek, verilen değişiklikleri componentKey ile merge et, TAM diziyi PUT'la.
      const cur = await axios.get(`${HEALTH_BASE}/api/alert-rules`, { headers });
      const existing = Array.isArray(cur.data) ? cur.data : [];
      const byKey = new Map(existing.map((r) => [r.componentKey, r]));
      for (const upd of args.rules) {
        const base = byKey.get(upd.componentKey);
        if (!base) throw new Error(`Bileşen bulunamadı: ${upd.componentKey}. Geçerli: ${[...byKey.keys()].join(", ")}`);
        byKey.set(upd.componentKey, { ...base, ...upd });
      }
      const merged = [...byKey.values()];
      const res = await axios.put(`${HEALTH_BASE}/api/alert-rules/multiple-component`, JSON.stringify(merged), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      return `Alert rules güncellendi (${args.rules.map((r) => r.componentKey).join(", ")}): ${JSON.stringify(res.data)}`;
    }

    case "mip_get_cron_frequency": {
      const res = await axios.get(`${HEALTH_BASE}/api/cron-frequency`, { headers });
      return JSON.stringify(res.data, null, 2);
    }

    case "mip_update_cron_frequency": {
      const cur = await axios.get(`${HEALTH_BASE}/api/cron-frequency`, { headers });
      const existing = Array.isArray(cur.data) ? cur.data : [];
      const byName = new Map(existing.map((c) => [c.componentName, c]));
      for (const upd of args.crons) {
        const base = byName.get(upd.componentName);
        if (!base) throw new Error(`Bileşen bulunamadı: ${upd.componentName}. Geçerli: ${[...byName.keys()].join(", ")}`);
        byName.set(upd.componentName, { ...base, ...upd });
      }
      const merged = [...byName.values()];
      const res = await axios.put(`${HEALTH_BASE}/api/cron-frequency/multiple-component`, JSON.stringify(merged), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
      return `Cron frequency güncellendi (${args.crons.map((c) => c.componentName).join(", ")}): ${JSON.stringify(res.data)}`;
    }

    default:
      throw new Error(`Bilinmeyen tool: ${name}`);
  }
}

// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server(
  { name: "mip-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args ?? {});
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    const message = err?.response
      ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
      : err.message;
    return {
      content: [{ type: "text", text: `Hata: ${message}` }],
      isError: true,
    };
  }
});

// Test/registry import'u server'i baslatmasin diye: yalnizca dosya DOGRUDAN
// calistirilinca (entry) stdio transport'a baglan. `export`'lar dogrulama
// harness'inin TOOLS + handleTool'a erisebilmesi icin.
export { TOOLS, handleTool };

const selfPath = fileURLToPath(import.meta.url);
const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isEntry = entryArg && (entryArg === selfPath || entryArg.toLowerCase() === selfPath.toLowerCase());
if (isEntry) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
