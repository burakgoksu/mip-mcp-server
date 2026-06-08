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

// ─── Config (env variables) ───────────────────────────────────────────────────
const BASE_URL = process.env.MIP_BASE_URL;
const MIP_USERNAME = process.env.MIP_USERNAME;
const MIP_PASSWORD = process.env.MIP_PASSWORD;
const DOWNLOAD_DIR = process.env.MIP_DOWNLOAD_DIR || path.join(os.homedir(), "mip-downloads");

if (!BASE_URL || !MIP_USERNAME || !MIP_PASSWORD) {
  process.stderr.write(
    "Hata: MIP_BASE_URL, MIP_USERNAME ve MIP_PASSWORD env değişkenleri settings.json içinde tanımlanmalıdır.\n"
  );
  process.exit(1);
}

// ─── Token Management ─────────────────────────────────────────────────────────
let tokenState = { token: null, expiry: 0 };

async function getToken() {
  if (tokenState.token && Date.now() < tokenState.expiry - 30000) {
    return tokenState.token;
  }
  const res = await axios.post(`${BASE_URL}/api/auth/sign-in`, {
    username: MIP_USERNAME,
    password: MIP_PASSWORD,
  });
  tokenState.token = res.data.token;
  const expiresIn = res.data.expires_in ?? 3600;
  tokenState.expiry = Date.now() + expiresIn * 1000;
  return tokenState.token;
}

function authHeaders() {
  return { Authorization: `Bearer ${tokenState.token}` };
}

// ─── Helper: save binary response to file ────────────────────────────────────
function ensureDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

function saveFile(buffer, filename) {
  ensureDownloadDir();
  const filePath = path.join(DOWNLOAD_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function extractFilename(headers, fallback) {
  const cd = headers["content-disposition"] || "";
  const match = cd.match(/filename="?([^";\n]+)"?/);
  return match ? match[1].trim() : fallback;
}

// ─── MIP Flow Schema Knowledge Base ──────────────────────────────────────────
// 310 gerçek flow analiz edilerek oluşturulmuştur. 55 node tipi, tüm alanlar.
const MIP_FLOW_SCHEMA = {
  description: "MIP Integration Platform — Flow, Resource ve Package şema bilgisi. 310 gerçek flow analiz edilerek oluşturulmuştur.",

  flowStructure: {
    topLevelFields: {
      required: ["flowId", "flowName", "flowPackageId", "flowData"],
      optional: ["flowDescription", "version", "flowLocked", "flowConfiguration"],
      notes: "id, createdDate, createdBy gibi audit alanları import sırasında otomatik atanır. flowData string olarak JSON encode edilir."
    },
    flowDataFormat: "flowData alanı JSON array'i string olarak içerir. İçinde node'lar ve edge'ler birlikte bulunur. JSON.stringify() ile serialize edilmeli."
  },

  nodeSchema: {
    commonFields: {
      id: "dndnode_<timestamp> formatında unique string",
      type: "her zaman 'special'",
      sourcePosition: "genellikle 'right'",
      targetPosition: "genellikle 'left'",
      position: { x: "number (300px aralıklı önerilir)", y: "number" },
      height: 40.0,
      width: 160.0,
      processSteps: [],
      data: {
        objectType: "node tipini belirler (processStart, processHTTP, vb.)",
        label: "UI'da gösterilen isim",
        connectorData: "objectType'a özgü konfigürasyon objesi",
        processTypeIcon: "opsiyonel ikon adı"
      }
    }
  },

  edgeSchema: {
    fields: {
      id: "reactflow__edge-<sourceId>-<targetId>",
      source: "kaynak node id",
      target: "hedef node id",
      height: 0.0,
      width: 0.0,
      style: { strokeWidth: 2, height: 0, width: 0, zIndex: -1 },
      processSteps: []
    }
  },

  nodeTypes: {
    processStart: {
      description: "Her flow'un tek zorunlu giris noktasi. connectorType ile trigger tipi belirlenir.",
      required: true,
      connectorDataKey: "StartState",
      commonFields: { connectorType: "REST|SOAP|File|SFTP|JMS|JDBC|Timer|OData|OFTP2|MQTT|Mail|Direct|RabbitMQ|Solace|Kafka|Opcua|AS2|AWSSimpleQueue", isSyncEndpoint: true, concurrentConsumers: 1, addSearchterm: false, httpsEnable: false, isIdempotentActive: false, fileMaxSize: "10000" },
      byConnectorType: {
        REST: {
          restAddress: "/api/endpoint",
          restMethod: "GET|POST|PUT|DELETE|PATCH",
          restAuthenticationAllowDefaultBasicCredentials: "true=tum MIP kullanicilari Basic Auth ile cagirabilir | false=sadece belirtilen kullanicilar",
          restAuthenticationAllowExplicitUsers: "true=sadece restAuthenticationUsernames listesindeki service-user'lar cagirabilir",
          restAuthenticationUsernames: ["service-user-username-1", "service-user-username-2"],
          basicAuthResourceName: "Bu Start node'unu korumak icin degil — polling senaryolarinda kullanilan BASIC credential adi (mip_create_credential ile olusturulmus)",
          oAuth2ResourceName: "polling senaryolarinda OAUTH_2 credential adi",
          clientCertificateResourceName: "opsiyonel sertifika adi",
          headerRows: [],
          isRestPollingActive: false,
          restPollingBody: "opsiyonel",
          restPollingTime: "opsiyonel",
          restPollAuthorization: "opsiyonel",
          restKeepHeaders: true,
          restAuthenticationAllowPerUserGlobalPrimaryCredential: false,
          restAuthenticationTrustGatewayAuthentication: false,
          userRole: "",
          ftpUserName: "", ftpPassword: "", ftpHost: "", ftpPort: "",
          fileAdditionalParametersCheck: false,
          plc4xAutoReconnect: false,
          isWebdavIdempotentActive: false,
          isWebdavSkipEmptyFile: false,
          webdavPort: 0,
          authNote: "KRITIK: restAuthenticationUsernames icin SERVICE USER username kullanilir. processHTTP/processSOAP icin ise mip_create_credential ile olusturulan credential adi kullanilir — bunlar farklidir."
        },
        SOAP: {
          soapAddress: "MIP'in dis dunyaya acacagi endpoint path'i (orn: '/yigit_soap', '/eho/mip', '/F_TBS_START_SOAP'). '/' ile baslar. WSDL icindeki <soap:address location=...> DEGIL — onunla alakasiz.",
          soapWSDLResource: "MIP'e mip_upload_resource(resourceType:'wsdl') veya mip_generate_wsdl/mip_upload_wsdl ile YUKLENMIS WSDL dosyasinin adi (orn: 'calculator.wsdl', 'OrderService.wsdl'). Yuklenmis dosya adiyla birebir eslesmek zorunda.",
          soapWSDLBinding: "WSDL icindeki <wsdl:binding name=\"...\"> degerinin literal kopyasi. SABIT BIR FORMAT YOK — WSDL'i kim yazdiysa o ismi koymus. Hand-crafted/external WSDL'lerde dosyayi parse edip okumak gerekir, service name'den TURETME yapma. mip_generate_wsdl ile uretilen WSDL'de format: '<serviceName>Binding'.",
          soapWSDLOperation: "WSDL icindeki <wsdl:operation name=\"...\"> degerinin literal kopyasi. WSDL'den okunmali — SOAP Start her cagride bu operation'a route eder.",
          soapAuthenticationAllowExplicitUsers: "true=sadece soapAuthenticationUsernames listesindeki service-user'lar cagirabilir",
          soapAuthenticationAllowDefaultBasicCredentials: "true=tum MIP kullanicilari Basic Auth ile cagirabilir",
          soapAuthenticationUsernames: ["service-user-username-1"],
          authNote: "KRITIK: soapAuthenticationUsernames icin SERVICE USER username kullanilir. processSOAP node'undaki basicAuthResourceName ise mip_create_credential ile olusturulan CREDENTIAL ADIDIR.",
          wsdlNote: "ZORUNLU: soapWSDLResource ile referans verilen WSDL dosyasinda her <xs:schema> / <xsd:schema> elementinde elementFormDefault=\"qualified\" bulunmalidir. mip_generate_wsdl tool'u bu degeri otomatik baked-in olarak uretir; mip_upload_wsdl tool'u eksik veya unqualified ise yukleme oncesi otomatik duzeltir.",
          wsdlWorkflow: "SOAP Start iceren bir flow yaratmadan ONCE WSDL hazir olmalidir. Akis: 1) mip_generate_wsdl(serviceName, targetNamespace, operations, uploadAfter:true, flowId) ile uret+yukle (yeni WSDL) VEYA mip_upload_wsdl(filePath, flowId) ile var olan dosyayi yukle. 2) WSDL'in <wsdl:binding name=...> ve <wsdl:operation name=...> degerlerini oku (mip_generate_wsdl ciktisinda bindingMetadata olarak veriyor; hand-crafted dosyalarda WSDL'i parse et). 3) Bu degerleri SOAP Start StartState'e yaz: soapWSDLResource=<dosya_adi>, soapWSDLBinding=<binding ismi>, soapWSDLOperation=<operation ismi>, soapAddress='/<endpoint_path>'. 4) mip_create_and_import_flow cagir.",
          realExamples: [
            { desc: "Public Calculator WSDL (binding ismi 'CalculatorSoap' WSDL'den literal alindi)",
              state: { connectorType: "SOAP", soapAddress: "/yigit_soap_example1", soapWSDLResource: "calculator.wsdl", soapWSDLBinding: "CalculatorSoap", soapWSDLOperation: "Add", soapAuthenticationAllowDefaultBasicCredentials: true, soapAuthenticationAllowExplicitUsers: false, soapAuthenticationUsernames: [] } },
            { desc: "SAP-style WSDL (uzun ve underscore'lu binding ismi)",
              state: { connectorType: "SOAP", soapAddress: "/test123", soapWSDLResource: "SI_SAP_LIMAN_BAKIMMATIK_OUT_SYN.wsdl", soapWSDLBinding: "SI_SAP_LIMAN_BAKIMMATIK_OUT_SYNBinding", soapWSDLOperation: "SI_SAP_LIMAN_BAKIMMATIK_OUT_SYN", soapAuthenticationAllowDefaultBasicCredentials: true, soapAuthenticationAllowExplicitUsers: false, soapAuthenticationUsernames: [] } },
            { desc: "Custom service ('OrderServiceBinding' / 'CreateOrder' tipik <Service>Binding pattern)",
              state: { connectorType: "SOAP", soapAddress: "/F_TBS_START_SOAP", soapWSDLResource: "OrderService.wsdl", soapWSDLBinding: "OrderServiceBinding", soapWSDLOperation: "CreateOrder", soapAuthenticationAllowDefaultBasicCredentials: true, soapAuthenticationAllowExplicitUsers: false, soapAuthenticationUsernames: [] } }
          ]
        },
        File: { fileDirectory: "/path/to/dir", fileName: "*.xml", fileArchiveDirectory: "opsiyonel", fileCron: "0 0/1 * 1/1 * ? *", fileProcessingMode: "MOVE|DELETE", fileCharset: "UTF-8", skipEmptyFile: true },
        SFTP: { sftpHost: "sftp.example.com", sftpPort: "22", sftpUserName: "user", sftpPassword: "pass", privateKeyAlias: "opsiyonel", authenticationMethod: "username|privateKey", fileDirectory: "/remote/path", fileName: "*.csv", fileCron: "0 9 * * *" },
        Timer: { timerCron: "0 0/1 * 1/1 * ? *", directName: "opsiyonel" },
        JMS: { jmsUrl: "broker.host.com", jmsPort: "61616", jmsTopicName: "QUEUE.NAME", jmsAuthName: "credential-ref", jmsIsLocalConnection: false, jmsIsEncrypted: false, jmsIsCompressed: false, jmsIsTransferExchangeProperties: false, jmsMaxConcurrentCustomers: 1, jmsInErrorRetryInterval: "1000" },
        JDBC: { jdbcUrl: "jdbc:sqlserver://host:1433;database=DB", jdbcQuery: "SELECT * FROM table", jdbcCron: "0 0/5 * * * ?", jdbcReturnType: "xml|json" },
        Mail: { imapAddress: "imap.office365.com", mailCredential: "credential-ref", mailCron: "0 0/5 * * * ?" },
        Direct: { directName: "direct-endpoint-adi", directIsAsync: false },
        MQTT: { mqttBroker: "mqtt-broker.host.com", mqttPort: "8883", mqttTopic: "topic/name", mqttAuthName: "credential-ref", mqttVersion: "3" },
        Kafka: { kafkaBroker: "kafka-broker.host.com", kafkaPort: "9093", kafkaGroupId: "consumer-group-id", kafkaQueue: "topic-name", kafkaAuthName: "credential-ref", kafkaAdditionalParameters: "security.protocol=SSL", kafkaCertificateName: "opsiyonel", kafkaHeadersModels: [] },
        RabbitMQ: { rabbitMqBroker: "rabbitmq.host.com", rabbitMqPort: "5672", rabbitMqQueue: "queue-name", rabbitMqExchangeName: "exchange-name", rabbitMqRoutingKey: "opsiyonel", rabbitMqAuthName: "credential-ref", rabbitMqHeaderRows: [] },
        Solace: { solaceBroker: "solace-broker.host.com", solacePort: "5550", solaceQueue: "queue.name", solaceVpn: "vpn-adi", solaceAuthName: "credential-ref" },
        Opcua: { opcuaHost: "opcua.host.com", opcuaApplicationName: "ClientAppName", opcuaApplicationUri: "urn:example:client", opcuaBasicAuthenticationId: "credential-ref", opcuaIsAnonymousLogin: false, opcuaAllowedSecurityPolicies: "Basic256", opcuaKeyStoreName: "opsiyonel" },
        OData: { odataHttpAddress: "https://odata.service.com", odataResourcePath: "EntitySet", odataOperation: "GET", odataVersion: "v2.0|v4.0", odataContentType: "JSON", odataHttpAuthentication: "none|basic|oauth2", odataBasicAuthResourceName: "opsiyonel", odataOAuth2ResourceName: "opsiyonel", odataQueryOptions: "optional-query", odataFields: "{}", odataCron: "0 0/5 * * * ?", odataHttpTimeout: "3000" },
        AS2: { as2Uri: "as2/receive", as2From: "MY_COMPANY_AS2", as2To: "PARTNER_AS2_ID", as2EdiMessageType: "application/edifact", clientCertificateName: "cert-adi", clientPrivateKeyName: "key-adi" },
        AWSSimpleQueue: { awsCredential: "credential-ref", awsCron: "0 0/1 * * * ?", bucketName: "opsiyonel", objectKey: "opsiyonel" }
      }
    },
    processEnd: { description: "Flow cikis noktasi. Birden fazla olabilir.", connectorDataKey: null, fields: { label: "End" } },
    processHTTP: {
      description: "REST/HTTP cagrisi yapan node. Auth icin MUTLAKA once mip_create_credential ile credential olusturulup o isim referans verilmeli.",
      connectorDataKey: "HTTPState",
      authGuide: {
        NONE:   "httpAuthorization: 'None' — basicAuthResourceName ve oAuth2ResourceName bos birakilir.",
        BASIC:  "httpAuthorization: 'Basic' + basicAuthResourceName: '<BASIC tipinde credential adi>' — mip_create_credential ile credentialType:'BASIC' olusturulmus olmali.",
        OAUTH2: "httpAuthorization: 'OAuth2' + oAuth2ResourceName: '<OAUTH_2 tipinde credential adi>' — mip_create_credential ile credentialType:'OAUTH_2' olusturulmus olmali.",
        WARNING: "basicAuthResourceName ve oAuth2ResourceName ALANLARI service-user username degil, mip_create_credential ile olusturulan credential ADIDIR. Service user username buraya YAZILMAZ."
      },
      realExamples: [
        { desc: "Basic Auth ornegi", state: { httpAddress: "https://api.example.com/endpoint", httpMethod: "POST", httpAuthorization: "Basic", basicAuthResourceName: "MY_API_CRED", oAuth2ResourceName: "", proxyEnable: false, httpTimeout: "30000", withBody: false, retryDelay: 0, maxRetries: 0, restAllowedHeaders: false } },
        { desc: "OAuth2 ornegi", state: { httpAddress: "https://api.spotify.com/v1/me", httpMethod: "GET", httpAuthorization: "OAuth2", basicAuthResourceName: "", oAuth2ResourceName: "MY_OAUTH2_CRED", proxyEnable: false, httpTimeout: "3000", withBody: false, retryDelay: 0, maxRetries: 0, restAllowedHeaders: false } },
        { desc: "Auth yok ornegi", state: { httpAddress: "https://api.example.com/public", httpMethod: "GET", httpAuthorization: "None", basicAuthResourceName: "", oAuth2ResourceName: "", proxyEnable: false, httpTimeout: "30000", withBody: false, retryDelay: 0, maxRetries: 0, restAllowedHeaders: false } }
      ],
      fields: { httpAddress: "https://api.example.com/endpoint", httpMethod: "GET|POST|PUT|DELETE|PATCH|HEAD", httpTimeout: "30000", maxRetries: 0, retryDelay: 0, httpAuthorization: "None|Basic|OAuth2", basicAuthResourceName: "BASIC tipinde credential adi (httpAuthorization='Basic' ise dolu olmali)", oAuth2ResourceName: "OAUTH_2 tipinde credential adi (httpAuthorization='OAuth2' ise dolu olmali)", proxyEnable: false, withBody: false, restAllowedHeaders: false, restAllowedHeaderList: [] }
    },
    processSOAP: {
      description: "SOAP web servisi cagrisi. Auth icin MUTLAKA once mip_create_credential ile credential olusturulup o isim referans verilmeli.",
      connectorDataKey: "SOAPState",
      authGuide: {
        NONE:   "soapAuthorization: 'None' — basicAuthResourceName bos birakilir.",
        BASIC:  "soapAuthorization: 'Basic' + basicAuthResourceName: '<BASIC tipinde credential adi>' — mip_create_credential ile credentialType:'BASIC' olusturulmus olmali.",
        CERT:   "ClientCertificateResourceName: '<sertifika adi>' — mip_upload_certificate ile yuklenmis sertifika adi.",
        WARNING: "basicAuthResourceName ALANI service-user username degil, mip_create_credential ile olusturulan credential ADIDIR."
      },
      realExamples: [
        { desc: "Basic Auth SOAP ornegi", state: { soapAddress: "http://service.example.com/soap", soapAction: "http://tempuri.org/IService/Op", soapEnvelope: true, soapAuthorization: "Basic", basicAuthResourceName: "MY_SOAP_CRED", oAuth2ResourceName: "", ClientCertificateResourceName: "", proxyEnable: false, soapTimeout: "60000", retryDelay: 0, maxRetries: 0, soapAllowedHeaders: false } },
        { desc: "Auth yok SOAP ornegi", state: { soapAddress: "http://service.example.com/soap", soapAction: "http://tempuri.org/IService/Op", soapEnvelope: true, soapAuthorization: "None", basicAuthResourceName: "", oAuth2ResourceName: "", ClientCertificateResourceName: "", proxyEnable: false, soapTimeout: "60000", retryDelay: 0, maxRetries: 0, soapAllowedHeaders: false } }
      ],
      fields: { soapAddress: "http://service.example.com/soap", soapAction: "http://tempuri.org/IService/Operation", soapEnvelope: true, soapTimeout: "60000", soapAuthorization: "None|Basic", basicAuthResourceName: "BASIC tipinde credential adi (soapAuthorization='Basic' ise dolu olmali)", oAuth2ResourceName: "OAUTH_2 tipinde credential adi (opsiyonel)", ClientCertificateResourceName: "sertifika adi (opsiyonel, mip_upload_certificate ile yuklenmus olmali)", contentType: "text/xml (opsiyonel)", maxRetries: 0, retryDelay: 0, proxyEnable: false, soapAllowedHeaders: false, soapAllowedHeaderList: [] }
    },
    processScript: {
      description: "Groovy script calistirir. Exchange body/header/property tam erisim. .groovy resource'a referans verir.",
      connectorDataKey: "ScriptState",
      fields: { scriptPath: "scriptDosyasi.groovy", logScriptPayload: true, nodeId: "opsiyonel" },
      groovyGuide: {
        signature: "Her MIP Groovy script su imzayi ZORUNLU kullanmalidir:\n  import org.apache.camel.Exchange;\n  def Exchange executeMessage(Exchange message) {\n    // kodunuz\n    return message;\n  }",
        bodyAccess: {
          read: "def body = message.getIn().getBody(String.class)",
          write: "message.getIn().setBody(yeniBody)",
          alternative: "message.in.getBody(String.class) veya message.in.setBody(...) da kullanilabilir"
        },
        headerAccess: {
          read: "message.getIn().getHeader('headerAdi')",
          write: "message.getIn().setHeader('Content-Type', 'application/json')"
        },
        propertyAccess: {
          read: "message.getProperty('propAdi')  // null-safe: message.getProperty('propAdi') ?: 'default'",
          write: "message.setProperty('propAdi', deger)"
        },
        commonImports: [
          "import org.apache.camel.Exchange;",
          "import groovy.json.JsonSlurper;",
          "import groovy.json.JsonBuilder;",
          "import groovy.xml.XmlSlurper;",
          "import groovy.xml.MarkupBuilder;",
          "import org.apache.camel.http.base.HttpOperationFailedException;"
        ],
        jsonPattern: "def req = new groovy.json.JsonSlurper().parseText(message.getIn().getBody(String.class))\ndef val = req?.field ?: 'default'\nmessage.getIn().setBody(new groovy.json.JsonBuilder([key: val]).toPrettyString())",
        xmlReadPattern: "def root = new groovy.xml.XmlSlurper().parseText(message.getIn().getBody(String.class))\ndef val = root.elementName.text()",
        xmlWritePattern: "def writer = new StringWriter()\ndef xml = new groovy.xml.MarkupBuilder(writer)\nxml.Root {\n  Field(value)\n}\nmessage.getIn().setBody(writer.toString())",
        exceptionPattern: "def ex = exchange.getProperty(Exchange.EXCEPTION_CAUGHT, Exception.class)\nif (ex instanceof org.apache.camel.http.base.HttpOperationFailedException) {\n  def statusCode = ex.getStatusCode()\n  def responseBody = ex.getResponseBody()\n}",
        nullSafeOp: "?.  operatoru kullan: parsedJson?.field?.subfield ?: 'default'",
        realExamples: [
          "// Property set etmek:\nmessage.setProperty('invoiceNo', req.invoiceNo.toString())",
          "// Header set etmek:\nmessage.getIn().setHeader('Authorization', 'Basic ' + ('user:pass'.bytes.encodeBase64().toString()))",
          "// Body XML'den deger cekip property yapmak:\ndef root = new groovy.xml.XmlSlurper().parseText(message.getIn().getBody(String.class))\nmessage.setProperty('desc', root.weather.description.text())",
          "// Liste donusumu:\ndef items = parsedJson.collect { item -> [id: item?.id ?: '', name: item?.name ?: ''] }"
        ]
      }
    },
    processXSLTMapping: { description: "XSLT donusumu uygular. .xsl resource'a referans verir.", connectorDataKey: "XSLTState", fields: { xsltPath: "transform.xsl", logXSLTPayload: false, nodeId: "opsiyonel" } },
    processSetContext: { description: "Payload'dan deger cikarir, exchangeProperty veya header olarak saklar. useSimpleQuery=true ise contextBody ile body'yi rebuild eder.", connectorDataKey: "SetContextState", fields: { nodeId: "", useSimpleQuery: "false=propertyRows/headerRows kullan | true=contextBody ile body'yi yeniden yaz", contextBody: "useSimpleQuery=true oldugunda body expression: uid=dollar{exchangeProperty.uid}&pwd=dollar{exchangeProperty.pwd}", propertyRows: [{ id: 0, propertyName: "propAdi", propertyType: "Constant|Expression|XPath|JSONPath|Header|Property", propertyValue: "string | ${exchangeProperty.x}=='true' | /TedarikciPaketleri/Item | $.TedarikciPaketleri.Item | messageid123 | //status" }], headerRows: [{ id: 0, headerName: "Content-Type", headerType: "Constant|Expression|XPath|JSONPath|Header|Property", headerValue: "string | ${exchangeProperty.x}=='true' | /TedarikciPaketleri/Item | $.TedarikciPaketleri.Item | messsageId123 | //status" }] } },
    processConverter: { description: "Veri formati donusumu. J2X=JSON-to-XML, X2J=XML-to-JSON, diger tipler de var.", connectorDataKey: "ConverterState", fields: { convertType: "J2X|X2J|CSV|JSON|XML|Avro|Parquet", xmlRootName: "J2X icin kok eleman adi (ornek: DenizbankResponse)", xmlNamespace: "opsiyonel namespace (ornek: http://mdpgroup.com/EHO veya a:http://...)", xmlElementForCSV: "CSV donusumunde XML eleman adi", jsonElementForCSV: "CSV donusumunde JSON eleman adi", csvSeparator: "CSV ayirici (varsayilan virgul)", csvHeaders: "CSV sutun basliklari", toXmlElement: "XML ciktida wrap eleman", toJsonElement: "JSON ciktida wrap eleman", isFieldNameAsHeader: false, isDisabledXMLRootElement: "X2J icin true yapilir (kok eleman XML'de zaten var)", isCsvHeaderIncludedAsFieldName: false, isEmptyStringNull: false, jsonElements: [] } },
    processCondition: { description: "Kosullu dallanma. Her conditionsRow bir cikis dalini tanimlar. Her dal icin hedef node edge ile baglanmali.", connectorDataKey: "ConditionState", fields: { conditionsRows: [{ edgeId: "kaynakNodeId--hedefNodeId", conditionName: "dal-adi", conditionType: "Expression|XPath|JSONPath", conditionValue: "${exchangeProperty.status} == OK veya XPath ifadesi", isDefaultCondition: false }], nodeId: "opsiyonel" } },
    processSplit: { description: "Mesaji parcalara boler, her parca akista devam eder.", connectorDataKey: "SplitState", fields: { splitType: "xPath|token|linefeed|regex", xpathExpression: "//items/item", isParallelProcessing: false, isKeepRootElement: false, isStopOnException: false, size: 1 } },
    processSplitter: { description: "processSplit alternatifi.", connectorDataKey: null, fields: {} },
    processFilter: { description: "Kosul saglanmayan mesaji durdurur.", connectorDataKey: "FilterState", fields: { pathTypes: "jsonPath|xPath", jsonpathExpression: "$.field", xpathExpression: "//element" } },
    processMulticast: { description: "Mesaji birden fazla hedefe paralel veya sirali gonderir.", connectorDataKey: "MulticastState", fields: { isParallelProcessing: false } },
    processDirect: { description: "In-memory yonlendirme. flowId ile baska flow'a baglanabilir.", connectorDataKey: "DirectState", fields: { directName: "direct-endpoint-adi", isAsync: false, flowId: "hedef-flow-id (opsiyonel, 41/48 ornekte mevcut)" } },
    processJDBC: { description: "SQL sorgusu calistirir.", connectorDataKey: "JDBCState", fields: { database_name: "datasource-ref", jdbcQuery: "SELECT * FROM table", returnType: "JSON|XML", returnAsXml: false, nodeId: "opsiyonel" } },
    processMail: { description: "SMTP ile e-posta gonderir. Alanlarda exchangeProperty desteklenir.", connectorDataKey: "MailState", fields: { address: "smtp.office365.com", port: 587, credentialName: "credential-ref", from: "sender@domain.com", to: "alici@domain.com", cc: "opsiyonel", bcc: "opsiyonel", subject: "konu", mailBody: "govde", bodyMimeType: "TEXT/Plain|TEXT/Html", bodyEncoding: "UTF-8", authentication: "LOGIN|PLAIN", encryption: "STARTTLS|SSL", addAttachments: false, attachments: [{ id: 0, attachmentName: "name", attachmentMimeType: "Application/JSON", attachmentExpression: "${exchangeProperty.x}=='true'" }], connectionTimeout: "opsiyonel", readTimeout: "opsiyonel", writeTimeout: "opsiyonel" } },
    processSFTP: { description: "SFTP sunucusuna dosya yukler.", connectorDataKey: "SFTPState", fields: { host: "sftp.example.com", port: "22", userName: "user", password: "pass", authenticationMethod: "username|privateKey", privateKeyAlias: "opsiyonel", filePath: "/remote/path", fileName: "dosya.xml", fileEncoding: "UTF-8|Windows-1254", addMessageID: false, addTimeStamp: false, useTempMode: false, tempFileScheme: "UTF-8" } },
    processFTP: { description: "FTP sunucusuna dosya gonderir.", connectorDataKey: "FTPState", fields: { host: "ftp.example.com", port: "21", userName: "user", password: "pass", filePath: "/remote/path", fileName: "output.txt", fileEncoding: "UTF-8", addMessageID: false, addTimeStamp: false, useTempMode: false, tempFileScheme: "UTF-8" } },
    processFile: { description: "Yerel dosya sistemi okuma/yazma.", connectorDataKey: "FileState", fields: { filePath: "C:/output", fileName: "output.xml", addTimeStamp: false, addMessageID: false, useTempMode: false, tempFileScheme: ".tmp", fileEncoding: "UTF-8" } },
    processWebdav: { description: "WebDAV sunucusuna dosya yukler.", connectorDataKey: "WebdavState", fields: { host: "https://webdav.example.com", port: 443, credentialName: "credential-ref", directory: "/integration/outgoing", fileName: "output.txt", isAutoCreate: false, isAddMessageId: false, isAddTimestamp: false } },
    processErrorSubflow: { description: "Flow'a hata yonetimi ekler. processStartError ve processEndError ile birlikte kullanilir.", connectorDataKey: null, fields: {} },
    processStartError: { description: "Hata akisinin baslangici.", connectorDataKey: null, fields: {} },
    processEndError: { description: "Hata akisinin sonu.", connectorDataKey: null, fields: {} },
    processDelayer: { description: "Akisi ms cinsinden durdurur.", connectorDataKey: "DelayerState", fields: { delayer: 3000 } },
    processDelay: { description: "Akisi geciktirir (processDelayer alternatifi).", connectorDataKey: null, fields: {} },
    processLoop: { description: "Belirtilen sayida dongu calistirir.", connectorDataKey: "LoopState", fields: { loopCount: 3 } },
    processAggregator: { description: "Birden fazla mesaji tek mesajda birlestir.", connectorDataKey: "AggregatorState", fields: { incomingFormat: "JSON|XML", correlationExpression: "$.correlationId" } },
    processCounter: { description: "Mesaj sayaci.", connectorDataKey: "CounterState", fields: { counterName: "opsiyonel", mode: "INCREASE|DECREASE|RESET (opsiyonel)" } },
    processEdifactConverter: { description: "EDIFACT ile XML arasinda donusum.", connectorDataKey: "EdifactConverterState", fields: { convertType: "EDIFACT_TO_XML|XML_TO_EDIFACT", singleLine: "false (opsiyonel)" } },
    processTradacomsConverter: { description: "TRADACOMS EDI ile XML donusumu.", connectorDataKey: "TradacomsConverterState", fields: { convertType: "TRADACOMS_TO_XML|XML_TO_TRADACOMS", singleLine: false } },
    processVDAConverter: { description: "VDA formati ile XML donusumu. Alman otomotiv standardi.", connectorDataKey: "VDAConverterState", fields: { convertType: "VDA_TO_XML|XML_TO_VDA (opsiyonel)", singleLine: "false (opsiyonel)", xsdPath: "VDA490500.xsd (opsiyonel)" } },
    processEancomConverter: { description: "EANCOM EDI ile XML donusumu. Perakende/lojistik.", connectorDataKey: "EancomConverterState", fields: { convertType: "EANCOM_TO_XML|XML_TO_EANCOM", singleLine: false } },
    processANSIX12Converter: { description: "ANSI X12 EDI ile XML donusumu. ABD standardi.", connectorDataKey: "ANSIX12ConverterState", fields: { convertType: "ANSIX12_TO_XML|XML_TO_ANSIX12 (opsiyonel)", singleLine: "false (opsiyonel)", xsdPath: "ASC_856004010.xsd (opsiyonel)" } },
    processOdetteConverter: { description: "ODETTE EDI ile XML donusumu. Avrupa otomotiv.", connectorDataKey: "OdetteConverterState", fields: { convertType: "ODETTE_TO_XML|XML_TO_ODETTE (opsiyonel)", singleLine: "false (opsiyonel)" } },
    processEdiExtractor: { description: "EDI mesajindan belirli segmentleri cikarir.", connectorDataKey: null, fields: {} },
    processBase64Converter: { description: "Base64 encode veya decode islemi.", connectorDataKey: "Base64ConverterState", fields: { convertType: "ENCODE|DECODE" } },
    processJMS: { description: "JMS kuyruguna mesaj gonderir.", connectorDataKey: "JMSState", fields: { url: "broker.host.com", port: "61616", topicName: "QUEUE.NAME", authName: "credential-ref", message: "${body}", isLocalConnection: false, isEncrypted: false, isCompressed: false, isTransferExchangeProperties: false, headerRows: [{ id: 0, headerName: "ornek", headerType: "Constant|Expression|JSONPath|Header|XPath", headerValue: "deger" }] } },
    processMQTT: { description: "MQTT broker'a mesaj publish eder.", connectorDataKey: "MQTTState", fields: { broker: "mqtt-broker.host.com", port: "8883", topic: "topic/name", authName: "credential-ref", message: "${body}", version: "3|5", qos: "0|1|2" } },
    processKafka: { description: "Kafka topic'e mesaj gonderir.", connectorDataKey: "KafkaState", fields: { broker: "kafka-broker.host.com", port: "9093", groupId: "consumer-group", queue: "topic-name", authName: "credential-ref", certificateName: "opsiyonel", isCompressed: false, isEncrypted: false, message: "${body}", headerRows: [{ id: 0, headerName: "ornek", headerType: "Constant|Expression|JSONPath|Header|XPath", headerValue: "deger" }], additionalParameters: "security.protocol=SSL" } },
    processRabbitMq: { description: "RabbitMQ'ya mesaj gonderir.", connectorDataKey: "RabbitMqState", fields: { broker: "rabbitmq.host.com", port: "5672", queue: "queue-name", exchangeName: "exchange-name", routingKey: "opsiyonel", authName: "credential-ref", isCompressed: false, isEncrypted: false, message: "${body}", headerRows: [] } },
    processSolace: { description: "Solace mesaj broker'ina mesaj gonderir.", connectorDataKey: "SolaceState", fields: { broker: "solace-broker.host.com", port: "5550", queue: "queue.name", vpn: "vpn-adi", authName: "credential-ref", isCompressed: false, isEncrypted: false, message: "${body}" } },
    processGooglePubsub: { description: "Google Cloud Pub/Sub'a mesaj gonderir.", connectorDataKey: "GooglePubsubState", fields: { googlePubsubCredential: "credential-ref", projectId: "gcp-project-id", destinationName: "topic-adi", attributeRows: [] } },
    processOpcua: { description: "OPC-UA sunucusu ile iletisim. Endustriyel IoT.", connectorDataKey: "OPCUAState", fields: { host: "opcua.host.com", applicationName: "ClientAppName", applicationUri: "urn:example:client", basicAuthenticationId: "credential-ref", isAnonymousLogin: false, allowedSecurityPolicies: "Basic256|None", keyStoreName: "opsiyonel", keyAlias: "opsiyonel", dataType: "String|Int|Float", nodeIds: "[\"ns=2;s=Node/Id\"]" } },
    processOdata: { description: "OData REST servisi cagrisi.", connectorDataKey: "OdataState", fields: { httpAddress: "https://odata.service.com", resourcePath: "EntitySet", operation: "GET|POST|PUT|DELETE", odataVersion: "v2.0|v4.0", httpAuthentication: "none|basic|oauth2", basicAuthResourceName: "opsiyonel", oAuth2ResourceName: "opsiyonel", httpTimeout: "3000", contentType: "JSON|XML", queryOptions: "tam-manuel-odata-query-string", queryFields: { "FieldName": true }, queryFilters: [], queryFilterConditions: [], querySorts: [], fieldsSelection: {}, keyValue: "", top: "opsiyonel", skip: "opsiyonel", useManualQuery: false, headerRows: [] } },
    processRFC: { description: "SAP RFC/BAPI cagrisi.", connectorDataKey: "RFCState", fields: { rfcDestinationName: "SAP-RFC-destination-adi" } },
    processMongoDb: { description: "MongoDB koleksiyonuna sorgu veya yazma islemi.", connectorDataKey: "MongoDbState", fields: { databaseName: "database-adi", collectionName: "collection-adi", operation: "find|insert|update|delete|getColStats", query: "{}", filter: "{}", sort: "{}", limit: "", multiUpdate: "false", returnType: "JSON", bulkWriteModel: [] } },
    processAwsS3Storage: { description: "AWS S3 bucket'a dosya yukler veya indirir.", connectorDataKey: "AwsS3StorageState", fields: { awsCredential: "credential-ref", region: "us-east-1", bucketName: "bucket-adi", objectKey: "path/to/object", contentEncoding: "gzip (opsiyonel)", storageClass: "STANDARD|REDUCED_REDUNDANCY" } },
    processAwsQueue: { description: "AWS SQS kuyruguna mesaj gonderir.", connectorDataKey: "AwsQueueState", fields: { awsCredential: "credential-ref", queueName: "sqs-queue-adi", region: "us-east-1" } },
    processAwsEventBridge: { description: "AWS EventBridge'e event gonderir.", connectorDataKey: "AwsEventBridgeState", fields: { awsCredential: "credential-ref", region: "us-east-1", eventBusName: "event-bus-adi", operation: "putEvent", ruleName: "opsiyonel", targetArn: "opsiyonel", entries: [{ source: "service.name", detail: "{}", detailType: "EventType", resources: "[]" }] } },
    processAzureQueue: { description: "Azure Storage Queue'ya mesaj gonderir.", connectorDataKey: "AzureQueueState", fields: { azureCredential: "credential-ref", accountName: "storage-account-adi", queueName: "queue-adi" } },
    processSalesforceBulkApi: { description: "Salesforce Bulk API ile toplu veri islemi.", connectorDataKey: "SalesforceBulkApiState", fields: { salesforceClientCredential: "client-credential", salesforceUserCredential: "user-credential", objectName: "Account|Contact|vb.", operation: "insert|update|upsert|delete", processType: "Bulk Data", bulkOperation: "Create Job|Query Job", apiVersion: "56.0", columnDelimiter: "COMMA|TAB|PIPE", lineEnding: "LF|CRLF", fieldNames: "opsiyonel", externalId: "opsiyonel", conditionExpression: "opsiyonel", limit: "opsiyonel" } },
    processSalesforceRestQuery: { description: "Salesforce SOQL ile veri sorgular.", connectorDataKey: "SalesforceRestQueryState", fields: { salesforceClientCredential: "client-credential", salesforceUserCredential: "user-credential", processType: "SOQL Query", query: "SELECT Id, Name FROM Account WHERE Industry = 'Technology'", apiVersion: "56.0", includeDeletedRecords: false } },
    processOFTP2: { description: "OFTP2 protokolu ile dosya transferi. Otomotiv EDI'da yaygin.", connectorDataKey: "OFTP2State", fields: { oftp2ConnectionName: 0, host: "oftp2.partner.com", port: 6619, encoding: "ISO-8859-1|UTF-8", fileName: "dosya-adi", fileFormat: "Unstructured|Fixed length|Variable", fileDescription: "opsiyonel", sfid: "O0013000FIRMAADIKOD", isCompressed: false, isEncrypted: false, isSigned: false, signAlgorithm: "MD5|SHA1 (opsiyonel)" } },
    processAS2: { description: "AS2 protokolu ile B2B EDI dosya transferi. Imzalama ve sifreleme destekler.", connectorDataKey: "AS2State", fields: { as2From: "MY_COMPANY_AS2_ID", as2To: "PARTNER_AS2_ID", uri: "as2/receive", hostname: "as2.partner.com", port: 443, ediMessageType: "application/edifact|application/x-edi-x12", messageStructure: "PLAIN|CMS", subject: "mesaj konusu", sendMdn: true, signMdn: true, encryptingAlgorithm: "AES128_CBC|AES256_CBC|3DES", signingAlgorithm: "SHA256WITHRSA|SHA1WITHRSA", isCharsetConversionEnabled: false, clientPrivateKeyId: "key-id", clientPrivateKeyName: "key-adi", clientCertificateId: "opsiyonel", clientCertificateName: "opsiyonel", serverCertificateId: "opsiyonel", serverCertificateName: "opsiyonel", mdnMessageTemplate: "opsiyonel" } },
    conditionEdge: { description: "processCondition cikisindaki kosullu edge. Node degil, edge tipidir, otomatik olusur.", connectorDataKey: null }
  },


  importantNotes: [
    "id, createdDate, createdBy, lastModifiedDate, lastModifiedBy alanlarını yeni flow'larda EKLEME — MIP bunları otomatik atar.",
    "flowLocked: 0 olmalı (1 = kilitli flow, düzenlenemez).",
    "position değerleri UI'da düzgün görünüm için 300px aralıklı set edilmeli (x: 0, 300, 600, 900...).",
    "Paralel branch'lerde y koordinatı değiştirilmeli (üst: y:0, alt: y:150).",
    "Credential/resource referansları (basicAuthResourceName, scriptPath, vb.) MIP'te önceden tanımlı olmalıdır.",
    "Groovy script yazarken MUTLAKA 'def Exchange executeMessage(Exchange message)' imzasini kullan. message.in.body degil, message.getIn().getBody(String.class) kullan. Her zaman message'i return et.",
    "Groovy'de body okuma: message.getIn().getBody(String.class) | body yazma: message.getIn().setBody(...) | property: message.setProperty/getProperty | header: message.getIn().setHeader/getHeader",
    "flowPackageId, mevcut bir package'a referans vermelidir.",
    "Yeni flow oluşturulurken flowId benzersiz olmalıdır — mevcut flow'larla çakışmamalı.",
    "KRİTİK — CREDENTIAL vs SERVICE USER farkı: processHTTP/processSOAP node'larındaki basicAuthResourceName ve oAuth2ResourceName alanları SERVICE USER username DEĞİL, mip_create_credential ile oluşturulan CREDENTIAL ADIDIR. Adım sırası: 1) mip_create_credential ile BASIC veya OAUTH_2 tipinde credential oluştur, 2) processHTTP/processSOAP node'unda o credential adını basicAuthResourceName veya oAuth2ResourceName alanına yaz.",
    "SERVICE USER ne zaman kullanılır: Service user'lar MIP platformuna erişmek için kullanılır (UI girişi, API çağrısı, Start node'unu tetiklemek). processHTTP/processSOAP içinde DIŞ sisteme gidecek çağrıda service user kullanılmaz — credential kullanılır.",
    "Start node güvenliği: REST/SOAP Start node'unda restAuthenticationUsernames veya soapAuthenticationUsernames alanı doluysa BURAYA service-user username yazılabilir. Bu alan dışarıdan bu endpoint'i kimlerin çağırabileceğini kısıtlar.",
    "processHTTP Basic Auth akışı: mip_create_credential(credentialType:'BASIC', basicAuthUsername:'user', password:'pass') → processHTTP node'unda httpAuthorization:'Basic', basicAuthResourceName:'<credential_adı>'",
    "processHTTP OAuth2 akışı: mip_create_credential(credentialType:'OAUTH_2', oAuth2GrantType:'CLIENT_CREDENTIALS', oAuth2TokenUrl:..., oAuth2ClientId:..., oAuth2ClientSecret:...) → processHTTP node'unda httpAuthorization:'OAuth2', oAuth2ResourceName:'<credential_adı>'",
    "KRİTİK — SOAP Start (Sender) WSDL kuralı: SOAP Start adapter'a baglanan WSDL'lerde her <xs:schema> elementinde elementFormDefault=\"qualified\" ZORUNLUDUR. Eksik veya unqualified WSDL ile flow düzgün çalışmaz. Yeni WSDL üretirken mip_generate_wsdl (otomatik baked-in) veya hand-crafted dosyalar için mip_upload_wsdl (otomatik validate + auto-fix) kullanılmalı; mip_upload_resource (resourceType:'wsdl') de çalışır ama validation yapmaz.",
    "KRİTİK — SOAP Start iceren flow olusturma sirasi: 1) WSDL'i hazirla — yeni WSDL icin mip_generate_wsdl(uploadAfter:true, flowId), var olan dosya icin mip_upload_wsdl(filePath, flowId). 2) Binding ve operation isimlerini WSDL'den oku — mip_generate_wsdl ciktisi bindingMetadata olarak verir; hand-crafted/dis WSDL'lerde dosyayi parse edip <wsdl:binding name=...> ve <wsdl:operation name=...> literal degerlerini al (asla 'serviceName + Binding' tahmin etme; gercek ornekler: 'CalculatorSoap', 'IDOCBinding', 'EASoapBinding'). 3) SOAP Start StartState bloguna yaz: connectorType:'SOAP', soapAddress:'/<endpoint_path>' (MIP path, WSDL location DEGIL), soapWSDLResource:'<wsdl_dosya_adi>', soapWSDLBinding:'<wsdl_icindeki_binding_adi>', soapWSDLOperation:'<wsdl_icindeki_operation_adi>'. 4) mip_create_and_import_flow cagir. Auth icin 7/7 gercek ornek soapAuthenticationAllowDefaultBasicCredentials:true kullaniyor."
  ]
};

// ─── WSDL Helpers ─────────────────────────────────────────────────────────────
// MIP, SOAP Start adapter icin yuklenen WSDL'lerde her <xs:schema> elementinde
// elementFormDefault="qualified" olmasini zorunlu kilar. Bu deger eksikse veya
// "unqualified" ise SOAP Sender flow'lari beklendigi gibi calismaz.
function ensureElementFormDefaultQualified(wsdlContent) {
  const warnings = [];
  const schemaTagRegex = /<([\w-]+:)?schema\b([^>]*?)(\/?)>/g;
  const result = wsdlContent.replace(schemaTagRegex, (match, prefix, attrs, selfClose) => {
    const efdMatch = attrs.match(/elementFormDefault\s*=\s*"([^"]*)"/);
    const ns = prefix ?? "";
    if (efdMatch) {
      if (efdMatch[1] !== "qualified") {
        warnings.push(`<${ns}schema> uzerinde elementFormDefault="${efdMatch[1]}" bulundu, "qualified" ile degistirildi.`);
        const newAttrs = attrs.replace(/elementFormDefault\s*=\s*"[^"]*"/, 'elementFormDefault="qualified"');
        return `<${ns}schema${newAttrs}${selfClose}>`;
      }
      return match;
    }
    warnings.push(`<${ns}schema> uzerinde elementFormDefault yoktu, "qualified" enjekte edildi.`);
    return `<${ns}schema${attrs} elementFormDefault="qualified"${selfClose}>`;
  });
  return { content: result, warnings, modified: warnings.length > 0 };
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateXsdElement(elementName, fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return `      <xsd:element name="${escapeXml(elementName)}">\n        <xsd:complexType>\n          <xsd:sequence/>\n        </xsd:complexType>\n      </xsd:element>`;
  }
  const fieldXml = fields.map(f => {
    const name = escapeXml(f.name);
    const type = f.type ?? "string";
    const minOccurs = f.minOccurs ?? 0;
    const maxOccurs = f.maxOccurs ?? 1;
    const typeAttr = type.includes(":") ? type : `xsd:${type}`;
    return `            <xsd:element name="${name}" type="${escapeXml(typeAttr)}" minOccurs="${minOccurs}" maxOccurs="${maxOccurs}"/>`;
  }).join("\n");
  return `      <xsd:element name="${escapeXml(elementName)}">\n        <xsd:complexType>\n          <xsd:sequence>\n${fieldXml}\n          </xsd:sequence>\n        </xsd:complexType>\n      </xsd:element>`;
}

function generateWsdl({ serviceName, targetNamespace, serviceAddress, operations }) {
  if (!serviceName) throw new Error("generateWsdl: serviceName zorunlu.");
  if (!targetNamespace) throw new Error("generateWsdl: targetNamespace zorunlu.");
  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error("generateWsdl: en az bir operation tanımlanmalı.");
  }
  const tns = targetNamespace;
  const addr = serviceAddress || `http://localhost/soap/${serviceName}`;

  const schemaElements = [];
  for (const op of operations) {
    if (!op.name) throw new Error("generateWsdl: her operation icin name zorunlu.");
    schemaElements.push(generateXsdElement(`${op.name}Request`, op.request?.fields ?? []));
    schemaElements.push(generateXsdElement(`${op.name}Response`, op.response?.fields ?? []));
  }

  const messages = operations.flatMap(op => [
    `  <wsdl:message name="${op.name}RequestMessage">\n    <wsdl:part name="parameters" element="tns:${op.name}Request"/>\n  </wsdl:message>`,
    `  <wsdl:message name="${op.name}ResponseMessage">\n    <wsdl:part name="parameters" element="tns:${op.name}Response"/>\n  </wsdl:message>`,
  ]);

  const portTypeOps = operations.map(op =>
    `    <wsdl:operation name="${op.name}">\n      <wsdl:input message="tns:${op.name}RequestMessage"/>\n      <wsdl:output message="tns:${op.name}ResponseMessage"/>\n    </wsdl:operation>`
  );

  const bindingOps = operations.map(op => {
    const action = op.soapAction ?? `${tns}/${op.name}`;
    return `    <wsdl:operation name="${op.name}">\n      <soap:operation soapAction="${escapeXml(action)}"/>\n      <wsdl:input>\n        <soap:body use="literal"/>\n      </wsdl:input>\n      <wsdl:output>\n        <soap:body use="literal"/>\n      </wsdl:output>\n    </wsdl:operation>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions
    xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    xmlns:tns="${escapeXml(tns)}"
    targetNamespace="${escapeXml(tns)}">

  <wsdl:types>
    <xsd:schema targetNamespace="${escapeXml(tns)}" elementFormDefault="qualified">
${schemaElements.join("\n")}
    </xsd:schema>
  </wsdl:types>

${messages.join("\n")}

  <wsdl:portType name="${serviceName}PortType">
${portTypeOps.join("\n")}
  </wsdl:portType>

  <wsdl:binding name="${serviceName}Binding" type="tns:${serviceName}PortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
${bindingOps.join("\n")}
  </wsdl:binding>

  <wsdl:service name="${serviceName}">
    <wsdl:port name="${serviceName}Port" binding="tns:${serviceName}Binding">
      <soap:address location="${escapeXml(addr)}"/>
    </wsdl:port>
  </wsdl:service>
</wsdl:definitions>
`;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS = [
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
      "Tarih aralığında flow başına mesaj sayısını ve ortalama işlem (completion) süresini döner. " +
      "Performans/yavaş flow analizi için kullanışlıdır (zaman damgası içermez).",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Başlangıç tarihi (YYYY-MM-DD)" },
        endDate: { type: "string", description: "Bitiş tarihi (YYYY-MM-DD)" },
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
    description: "MIP flow, node, resource ve package şema bilgisini döner. Yeni flow oluşturmadan önce bu tool çağrılmalıdır. 310 gerçek flow analiz edilerek oluşturulmuş kapsamlı şema ve template kütüphanesi içerir.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "Belirli bir bölüm getir: 'nodeTypes' | 'flowTemplates' | 'validation' | 'expressionLanguage' | 'all' (varsayılan: 'all')",
          default: "all"
        }
      },
      required: []
    }
  },
  {
    name: "mip_create_and_import_flow",
    description: `Verilen flow JSON tanımını doğrulayıp MIP'e import eder. flowData otomatik serialize edilir.

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
];

// ─── Monitoring Excel Report Builder ──────────────────────────────────────────
// Toplanmış aggregate'i çok sayfalı .xlsx'e (OOXML) çevirir. Harici Excel
// kütüphanesi gerektirmez; jszip ile zip + el-yazımı XML üretir.
// agg: { hour:[24]{s,e,d}, byDate:{date:n}, dateHour:{date:[24]}, flowHour:{flow:[24]}, flowTotals:{flow:{s,e,d}}, grandTotal }
// meta: { startDate, endDate, startTime, endTime, flowCount, statuses[], grandTotal, truncated }
async function buildMonitoringReportXlsx(agg, meta) {
  const JSZip = (await import("jszip")).default;
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const colName = (n) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const N = (v, s) => ({ v, t: "n", s });
  const S = (v, s) => ({ v, t: "s", s });
  const tot = (h) => h.s + h.e + h.d;
  const grand = meta.grandTotal || 0;

  // cellXfs: 0 default | 1 header | 2 yeşil(min) | 3 kırmızı(max) | 4 percent | 5 bold | 6-9 heat
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="9">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFCC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEE391"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEC44F"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFB6A4A"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="7" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="8" borderId="0" xfId="0" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const heat = (v, max) => { if (!v || !max) return 0; const r = v / max; if (r < 0.15) return 6; if (r < 0.4) return 7; if (r < 0.7) return 8; return 9; };
  const cellXml = (addr, c) => {
    if (c == null) return "";
    const s = c.s ? ` s="${c.s}"` : "";
    if (c.t === "s") return `<c r="${addr}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
    return `<c r="${addr}"${s}><v>${c.v}</v></c>`;
  };
  const sheetXml = (rows, cols) => {
    let body = "";
    rows.forEach((row, ri) => {
      let cellsX = "";
      row.forEach((c, ci) => { if (c != null) cellsX += cellXml(`${colName(ci)}${ri + 1}`, c); });
      body += `<row r="${ri + 1}">${cellsX}</row>`;
    });
    const colsX = cols ? `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${colsX}<sheetData>${body}</sheetData></worksheet>`;
  };

  // hangi saatler gösterilecek (saat filtresi varsa onunla sınırla)
  const fromH = meta.startTime ? parseInt(meta.startTime.slice(0, 2), 10) : 0;
  const toH = meta.endTime ? parseInt(meta.endTime.slice(0, 2), 10) : 23;
  const hours = [];
  for (let h = fromH; h <= toH; h++) hours.push(h);

  const sheets = [];

  // 1) Özet
  {
    const totals = hours.map((h) => tot(agg.hour[h]));
    const withVal = hours.map((h, i) => [h, totals[i]]).filter((x) => x[1] > 0).sort((a, b) => a[1] - b[1]);
    const minH = withVal[0], maxH = withVal[withVal.length - 1];
    const rows = [
      [S("MIP MONITORING HACİM RAPORU", 5)],
      [S(`Tarih aralığı: ${meta.startDate} → ${meta.endDate}`)],
      [S(`Saat aralığı: ${meta.startTime || "00:00"} - ${meta.endTime || "23:59"}`)],
      [S(`Statüler: ${meta.statuses.join(", ")}`)],
      [S(`Toplam mesaj: ${grand.toLocaleString("tr-TR")}   |   Flow sayısı: ${meta.flowCount}`)],
      [],
    ];
    if (minH && maxH) {
      rows.push([S("En sakin saat", 2), S(`${String(minH[0]).padStart(2, "0")}:00`, 2), N(minH[1], 2)]);
      rows.push([S("En yoğun saat", 3), S(`${String(maxH[0]).padStart(2, "0")}:00`, 3), N(maxH[1], 3)]);
    } else {
      rows.push([S("Seçilen aralıkta kayıt bulunamadı.")]);
    }
    if (meta.truncated) rows.push([], [S("UYARI: Güvenlik limiti aşıldı; rapor kısmi veridir. Daha dar bir aralık seçin.", 3)]);
    sheets.push({ name: "Özet", rows, cols: [18, 16, 12] });
  }

  // 2) Saat
  {
    const totals = hours.map((h) => tot(agg.hour[h]));
    const max = Math.max(1, ...totals);
    const nz = totals.filter((t) => t > 0);
    const min = nz.length ? Math.min(...nz) : 0;
    const rows = [[S("Saat", 1), S("Toplam", 1), S("Başarılı", 1), S("Hata", 1), S("Delivering", 1), S("Pay %", 1), S("Grafik", 1)]];
    hours.forEach((h) => {
      const c = agg.hour[h], t = tot(c);
      const hi = t > 0 && t === min ? 2 : t === max ? 3 : 0;
      rows.push([
        S(`${String(h).padStart(2, "0")}:00`, hi),
        N(t, hi), N(c.s), N(c.e), N(c.d),
        { v: grand ? t / grand : 0, t: "n", s: 4 },
        S("█".repeat(Math.round((t / max) * 40))),
      ]);
    });
    rows.push([S("TOPLAM", 5), N(totals.reduce((a, b) => a + b, 0), 5)]);
    sheets.push({ name: "Saat", rows, cols: [10, 10, 10, 8, 10, 9, 46] });
  }

  // 3) Gün x Saat (heatmap)
  {
    const dates = Object.keys(agg.dateHour).sort();
    const maxCell = Math.max(1, ...dates.flatMap((d) => hours.map((h) => agg.dateHour[d][h])));
    const rows = [[S("Tarih", 1), S("Toplam", 1), ...hours.map((h) => S(String(h).padStart(2, "0"), 1))]];
    for (const d of dates) {
      const arr = agg.dateHour[d];
      const t = hours.reduce((a, h) => a + arr[h], 0);
      rows.push([S(d), N(t), ...hours.map((h) => N(arr[h], heat(arr[h], maxCell)))]);
    }
    sheets.push({ name: "Gun x Saat", rows, cols: [12, 9, ...hours.map(() => 5)] });
  }

  // 4) Flow x Saat (heatmap)
  {
    const flowIds = Object.keys(agg.flowHour).sort((a, b) => agg.flowHour[b].reduce((x, y) => x + y, 0) - agg.flowHour[a].reduce((x, y) => x + y, 0));
    const maxCell = Math.max(1, ...flowIds.flatMap((f) => hours.map((h) => agg.flowHour[f][h])));
    const rows = [[S("Flow", 1), S("Toplam", 1), ...hours.map((h) => S(String(h).padStart(2, "0"), 1))]];
    for (const f of flowIds) {
      const arr = agg.flowHour[f];
      const t = hours.reduce((a, h) => a + arr[h], 0);
      rows.push([S(f), N(t), ...hours.map((h) => N(arr[h], heat(arr[h], maxCell)))]);
    }
    sheets.push({ name: "Flow x Saat", rows, cols: [44, 9, ...hours.map(() => 5)] });
  }

  // 5) Günlük Toplam
  {
    const dates = Object.keys(agg.byDate).sort();
    const rows = [[S("Tarih", 1), S("Toplam mesaj", 1)]];
    dates.forEach((d) => rows.push([S(d), N(agg.byDate[d])]));
    sheets.push({ name: "Gunluk Toplam", rows, cols: [14, 14] });
  }

  // 6) Flow Özet
  {
    const ids = Object.keys(agg.flowTotals).sort((a, b) => {
      const T = (x) => agg.flowTotals[x].s + agg.flowTotals[x].e + agg.flowTotals[x].d;
      return T(b) - T(a);
    });
    const rows = [[S("Flow", 1), S("Başarılı", 1), S("Hata", 1), S("Delivering", 1), S("Toplam", 1)]];
    ids.forEach((f) => {
      const v = agg.flowTotals[f];
      rows.push([S(f), N(v.s), N(v.e), N(v.d), N(v.s + v.e + v.d)]);
    });
    sheets.push({ name: "Flow Ozet", rows, cols: [44, 10, 8, 10, 10] });
  }

  // zip / xlsx
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  const xl = zip.folder("xl");
  xl.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  xl.folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  xl.file("styles.xml", STYLES);
  const ws = xl.folder("worksheets");
  sheets.forEach((s, i) => ws.file(`sheet${i + 1}.xml`, sheetXml(s.rows, s.cols)));
  return zip.generateAsync({ type: "nodebuffer" });
}

// ─── Tool Handlers ────────────────────────────────────────────────────────────
async function handleTool(name, args) {
  await getToken();
  const headers = authHeaders();

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
      const params = { startDate: args.startDate, endDate: args.endDate };
      if (args.paginationSize !== undefined) params.paginationSize = args.paginationSize;
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

const transport = new StdioServerTransport();
await server.connect(transport);
