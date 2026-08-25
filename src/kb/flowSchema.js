// ─── MIP Flow Schema Knowledge Base ──────────────────────────────────────────
// 310 gerçek flow analiz edilerek oluşturulmuştur. 55 node tipi, tüm alanlar.
import { LANG, loadCatalog, t } from "../i18n/index.js";
import { applyKbOverlay } from "../i18n/overlay.js";
const KB = {
  description: "MIP Integration Platform — Flow, Resource and Package schema reference. Built by analysing 310+ real flows (Kervan Prod + 140 v1.16 sample flows). For CORRECT edge/condition wiring in complex flows (multiple processCondition, error subflow, split/multicast) see the flowTemplates, edgeSchema.conditionEdge and validation sections. NEW in v1.16: processGraphicalMapping/processMCP/processXIProxy nodes, plus the graphicalMapping section for SAPXI start and visual mapping. CRITICAL CORRECTION: condition edges DO also carry sourceHandle:'normal-source'.",

  flowStructure: {
    topLevelFields: {
      required: ["flowId", "flowName", "flowPackageId", "flowData"],
      optional: ["flowDescription", "version", "flowLocked", "flowConfiguration"],
      notes: "Audit fields such as id, createdDate and createdBy are assigned automatically during import. flowData is JSON-encoded as a string."
    },
    flowDataFormat: "The flowData field holds a JSON array as a string. It contains nodes and edges together. It must be serialized with JSON.stringify()."
  },

  nodeSchema: {
    commonFields: {
      id: "Unique string in dndnode_<number> format. CRITICAL: the MIP v1.16 deploy compiler REQUIRES this format — ids like 'start1'/'cond1' make deploy return a 500 with 'Flow can not deploy. Cause is :' (empty cause). mip_create_and_import_flow rewrites every node id into this format before import (along with the edge/condition/parentNode references), so ids like 'start1' in the templates are not a problem.",
      type: "always 'special'",
      sourcePosition: "genellikle 'right'",
      targetPosition: "genellikle 'left'",
      position: { x: "number (300px spacing recommended)", y: "number" },
      height: 40.0,
      width: 160.0,
      processSteps: [],
      data: {
        objectType: "node tipini belirler (processStart, processHTTP, vb.)",
        label: "The FIXED canonical name for each objectType (e.g. processSetContext→'Set Context', processScript→'Script', processCondition→'Condition', processMail→'Mail', processEnd→'End'). The MIP UI enforces this name; it cannot be changed. DO NOT write a custom/descriptive name (e.g. 'mail body' on a SetContext) — it corrupts the flow object. mip_create_and_import_flow rewrites labels to the canonical name before import.",
        connectorData: "configuration object specific to the objectType",
        processTypeIcon: "optional icon name"
      }
    }
  },

  edgeSchema: {
    critical: "CRITICAL — from analysing 310+ real flows: EVERY edge in a MIP export carries type:'buttonedge'. The 'style' object from the old KB (strokeWidth/zIndex) DOES NOT EXIST IN REAL FLOWS — DO NOT write style on an edge. There are two edge shapes: (1) normal edge, (2) condition edge. Both carry type:'buttonedge', height:0, width:0, processSteps:[]; their differences are below.",
    normalEdge: {
      description: "Every connection EXCEPT those out of a processCondition. From the source node's output to the target.",
      fields: {
        id: "reactflow__edge-<sourceId><sourceHandle>-<targetId>  (when sourceHandle is 'normal-source' it is embedded in the id too: 'reactflow__edge-<sourceId>normal-source-<targetId>')",
        type: "'buttonedge' (SABIT)",
        source: "kaynak node id",
        target: "hedef node id",
        sourceHandle: "'normal-source' — present on EVERY edge (normal outputs AND, in v1.16, condition edges too). A condition edge additionally carries conditionId+label.",
        height: 0, width: 0, processSteps: []
      },
      example: { id: "reactflow__edge-nodeAnormal-source-nodeB", type: "buttonedge", source: "nodeA", target: "nodeB", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] }
    },
    conditionEdge: {
      description: "Every branch leaving a processCondition node. CRITICAL: writing this edge BY HAND IS MANDATORY — it is 'not created automatically'. There must be exactly one conditionEdge per conditionsRow.",
      fields: {
        id: "reactflow__edge-<sourceId>normal-source-<targetId>",
        type: "'buttonedge' (SABIT)",
        source: "processCondition node id",
        target: "dalin gittigi hedef node id",
        sourceHandle: "'normal-source' — in REAL v1.16 flows condition edges DO carry this handle too (same as a normal edge). The OLD KB said it 'is not written', which is WRONG. It appears TOGETHER with conditionId+label.",
        conditionId: "'<sourceId>--<targetId>' (DOUBLE hyphen). Must be EXACTLY THE SAME as conditionsRows[].edgeId on the node — if they do not match the branch is not connected and deploy blows up.",
        label: "same as conditionsRows[].conditionName (e.g. 'OK','ERR','default')",
        height: 0, width: 0, processSteps: []
      },
      note: "CONDITION EDGE = NORMAL EDGE + conditionId + label. That means sourceHandle:'normal-source' is present too (84/84 of the v1.16 exports look like this). The previous KB said 'sourceHandle is not written'; that has been corrected.",
      example: { id: "reactflow__edge-condAnormal-source-targetB", type: "buttonedge", source: "condA", target: "targetB", sourceHandle: "normal-source", conditionId: "condA--targetB", label: "OK", height: 0, width: 0, processSteps: [] }
    }
  },

  nodeTypes: {
    processStart: {
      description: "The single mandatory entry point of every flow. connectorType determines the trigger type.",
      required: true,
      connectorDataKey: "StartState",
      commonFields: { connectorType: "REST|SOAP|File|SFTP|JMS|JDBC|Timer|OData|OFTP2|MQTT|Mail|Direct|RabbitMQ|Solace|Kafka|Opcua|AS2|AWSSimpleQueue|SAPXI", isSyncEndpoint: true, concurrentConsumers: 1, addSearchterm: false, httpsEnable: false, isIdempotentActive: false, fileMaxSize: "10000" },
      byConnectorType: {
        REST: {
          restAddress: "/api/endpoint",
          restMethod: "GET|POST|PUT|DELETE|PATCH",
          restAuthenticationAllowDefaultBasicCredentials: "true=any MIP user can call it with Basic Auth | false=only the listed users",
          restAuthenticationAllowExplicitUsers: "true=only the service-users listed in restAuthenticationUsernames can call it",
          restAuthenticationUsernames: ["service-user-username-1", "service-user-username-2"],
          basicAuthResourceName: "Not for protecting this Start node — the name of the BASIC credential (created with mip_create_credential) used in polling scenarios",
          oAuth2ResourceName: "name of the OAUTH_2 credential for polling scenarios",
          clientCertificateResourceName: "optional certificate name",
          headerRows: [],
          isRestPollingActive: false,
          restPollingBody: "optional",
          restPollingTime: "optional",
          restPollAuthorization: "optional",
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
          authNote: "CRITICAL: restAuthenticationUsernames takes a SERVICE USER username. processHTTP/processSOAP, by contrast, take the name of a credential created with mip_create_credential — these are different things."
        },
        SOAP: {
          soapAddress: "The endpoint path MIP will expose to the outside world (e.g. '/yigit_soap', '/eho/mip', '/F_TBS_START_SOAP'). Starts with '/'. This is NOT the <soap:address location=...> inside the WSDL — it is unrelated to it.",
          soapWSDLResource: "The name of the WSDL file UPLOADED to MIP via mip_upload_resource(resourceType:'wsdl') or mip_generate_wsdl/mip_upload_wsdl (e.g. 'calculator.wsdl', 'OrderService.wsdl'). It must match the uploaded file name exactly.",
          soapWSDLBinding: "A literal copy of the <wsdl:binding name=\"...\"> value inside the WSDL. THERE IS NO FIXED FORMAT — the name is whatever the WSDL author chose. For hand-crafted/external WSDLs you must parse the file and read it; DO NOT DERIVE it from the service name. For a WSDL produced by mip_generate_wsdl the format is '<serviceName>Binding'.",
          soapWSDLOperation: "A literal copy of the <wsdl:operation name=\"...\"> value inside the WSDL. It must be read from the WSDL — the SOAP Start routes every call to this operation.",
          soapAuthenticationAllowExplicitUsers: "true=only the service-users listed in soapAuthenticationUsernames can call it",
          soapAuthenticationAllowDefaultBasicCredentials: "true=any MIP user can call it with Basic Auth",
          soapAuthenticationUsernames: ["service-user-username-1"],
          authNote: "CRITICAL: soapAuthenticationUsernames takes a SERVICE USER username. basicAuthResourceName on a processSOAP node, by contrast, is THE NAME OF A CREDENTIAL created with mip_create_credential.",
          wsdlNote: "MANDATORY: in the WSDL file referenced by soapWSDLResource, every <xs:schema> / <xsd:schema> element must carry elementFormDefault=\"qualified\". The mip_generate_wsdl tool bakes this value in automatically; the mip_upload_wsdl tool fixes it automatically before upload if it is missing or unqualified.",
          wsdlWorkflow: "The WSDL must be ready BEFORE creating a flow that contains a SOAP Start. The sequence: 1) Generate+upload with mip_generate_wsdl(serviceName, targetNamespace, operations, uploadAfter:true, flowId) (new WSDL) OR upload an existing file with mip_upload_wsdl(filePath, flowId). 2) Read the WSDL's <wsdl:binding name=...> and <wsdl:operation name=...> values (mip_generate_wsdl returns them as bindingMetadata in its output; for hand-crafted files, parse the WSDL). 3) Write those values into the SOAP Start StartState: soapWSDLResource=<file_name>, soapWSDLBinding=<binding name>, soapWSDLOperation=<operation name>, soapAddress='/<endpoint_path>'. 4) Call mip_create_and_import_flow.",
          realExamples: [
            { desc: "Public Calculator WSDL (the binding name 'CalculatorSoap' was taken literally from the WSDL)",
              state: { connectorType: "SOAP", soapAddress: "/yigit_soap_example1", soapWSDLResource: "calculator.wsdl", soapWSDLBinding: "CalculatorSoap", soapWSDLOperation: "Add", soapAuthenticationAllowDefaultBasicCredentials: true, soapAuthenticationAllowExplicitUsers: false, soapAuthenticationUsernames: [] } },
            { desc: "SAP-style WSDL (long binding name with underscores)",
              state: { connectorType: "SOAP", soapAddress: "/test123", soapWSDLResource: "SI_SAP_LIMAN_BAKIMMATIK_OUT_SYN.wsdl", soapWSDLBinding: "SI_SAP_LIMAN_BAKIMMATIK_OUT_SYNBinding", soapWSDLOperation: "SI_SAP_LIMAN_BAKIMMATIK_OUT_SYN", soapAuthenticationAllowDefaultBasicCredentials: true, soapAuthenticationAllowExplicitUsers: false, soapAuthenticationUsernames: [] } },
            { desc: "Custom service ('OrderServiceBinding' / 'CreateOrder' tipik <Service>Binding pattern)",
              state: { connectorType: "SOAP", soapAddress: "/F_TBS_START_SOAP", soapWSDLResource: "OrderService.wsdl", soapWSDLBinding: "OrderServiceBinding", soapWSDLOperation: "CreateOrder", soapAuthenticationAllowDefaultBasicCredentials: true, soapAuthenticationAllowExplicitUsers: false, soapAuthenticationUsernames: [] } }
          ]
        },
        File: { fileDirectory: "/path/to/dir", fileName: "*.xml", fileArchiveDirectory: "optional", fileCron: "0 0/1 * 1/1 * ? *", fileProcessingMode: "MOVE|DELETE", fileCharset: "UTF-8", skipEmptyFile: true },
        SFTP: { sftpHost: "sftp.example.com", sftpPort: "22", sftpUserName: "user", sftpPassword: "pass", privateKeyAlias: "optional", authenticationMethod: "username|privateKey", fileDirectory: "/remote/path", fileName: "*.csv", fileCron: "0 9 * * *" },
        Timer: { timerCron: "0 0/1 * 1/1 * ? *", directName: "optional" },
        JMS: { jmsUrl: "broker.host.com", jmsPort: "61616", jmsTopicName: "QUEUE.NAME", jmsAuthName: "credential-ref", jmsIsLocalConnection: false, jmsIsEncrypted: false, jmsIsCompressed: false, jmsIsTransferExchangeProperties: false, jmsMaxConcurrentCustomers: 1, jmsInErrorRetryInterval: "1000" },
        JDBC: { jdbcUrl: "jdbc:sqlserver://host:1433;database=DB", jdbcQuery: "SELECT * FROM table", jdbcCron: "0 0/5 * * * ?", jdbcReturnType: "xml|json" },
        Mail: { imapAddress: "imap.office365.com", mailCredential: "credential-ref", mailCron: "0 0/5 * * * ?" },
        Direct: { directName: "direct-endpoint-name", directIsAsync: false },
        MQTT: { mqttBroker: "mqtt-broker.host.com", mqttPort: "8883", mqttTopic: "topic/name", mqttAuthName: "credential-ref", mqttVersion: "3" },
        Kafka: { kafkaBroker: "kafka-broker.host.com", kafkaPort: "9093", kafkaGroupId: "consumer-group-id", kafkaQueue: "topic-name", kafkaAuthName: "credential-ref", kafkaAdditionalParameters: "security.protocol=SSL", kafkaCertificateName: "optional", kafkaHeadersModels: [] },
        RabbitMQ: { rabbitMqBroker: "rabbitmq.host.com", rabbitMqPort: "5672", rabbitMqQueue: "queue-name", rabbitMqExchangeName: "exchange-name", rabbitMqRoutingKey: "optional", rabbitMqAuthName: "credential-ref", rabbitMqHeaderRows: [] },
        Solace: { solaceBroker: "solace-broker.host.com", solacePort: "5550", solaceQueue: "queue.name", solaceVpn: "vpn-name", solaceAuthName: "credential-ref" },
        Opcua: { opcuaHost: "opcua.host.com", opcuaApplicationName: "ClientAppName", opcuaApplicationUri: "urn:example:client", opcuaBasicAuthenticationId: "credential-ref", opcuaIsAnonymousLogin: false, opcuaAllowedSecurityPolicies: "Basic256", opcuaKeyStoreName: "optional" },
        OData: { odataHttpAddress: "https://odata.service.com", odataResourcePath: "EntitySet", odataOperation: "GET", odataVersion: "v2.0|v4.0", odataContentType: "JSON", odataHttpAuthentication: "none|basic|oauth2", odataBasicAuthResourceName: "optional", odataOAuth2ResourceName: "optional", odataQueryOptions: "optional-query", odataFields: "{}", odataCron: "0 0/5 * * * ?", odataHttpTimeout: "3000" },
        AS2: { as2Uri: "as2/receive", as2From: "MY_COMPANY_AS2", as2To: "PARTNER_AS2_ID", as2EdiMessageType: "application/edifact", clientCertificateName: "cert-name", clientPrivateKeyName: "key-name" },
        AWSSimpleQueue: { awsCredential: "credential-ref", awsCron: "0 0/1 * * * ?", bucketName: "optional", objectKey: "optional" },
        SAPXI: { note: "SAP XI/PI Proxy SENDER (v1.16). Receives an XI/PI proxy message from SAP into MIP. The sending side is the processXIProxy node (see nodeTypes.processXIProxy); the XI System/PO connection must be defined under Operations>Sap-Connections>XI Proxy (mip_*_xi_system / mip_*_po_connection). The SOAP/REST auth fields arrive as BASIC (soapAuthenticationType:'BASIC', restAuthenticationType:'BASIC').", soapAuthenticationType: "BASIC", restAuthenticationType: "BASIC", fileCharset: "UTF-8" }
      }
    },
    processEnd: { description: "The flow's exit point. There may be more than one.", connectorDataKey: null, fields: { label: "End" } },
    processHTTP: {
      description: "Node that makes a REST/HTTP call. For auth you MUST first create a credential with mip_create_credential and reference it by that name.",
      connectorDataKey: "HTTPState",
      authGuide: {
        NONE:   "httpAuthorization: 'None' — basicAuthResourceName and oAuth2ResourceName are left empty.",
        BASIC:  "httpAuthorization: 'Basic' + basicAuthResourceName: '<name of a BASIC credential>' — it must have been created with mip_create_credential using credentialType:'BASIC'.",
        OAUTH2: "httpAuthorization: 'OAuth2' + oAuth2ResourceName: '<name of an OAUTH_2 credential>' — it must have been created with mip_create_credential using credentialType:'OAUTH_2'.",
        WARNING: "The basicAuthResourceName and oAuth2ResourceName FIELDS are not a service-user username, they are the NAME OF A CREDENTIAL created with mip_create_credential. A service user username is NOT written here."
      },
      realExamples: [
        { desc: "Basic Auth ornegi", state: { httpAddress: "https://api.example.com/endpoint", httpMethod: "POST", httpAuthorization: "Basic", basicAuthResourceName: "MY_API_CRED", oAuth2ResourceName: "", proxyEnable: false, httpTimeout: "30000", withBody: false, retryDelay: 0, maxRetries: 0, restAllowedHeaders: false } },
        { desc: "OAuth2 ornegi", state: { httpAddress: "https://api.spotify.com/v1/me", httpMethod: "GET", httpAuthorization: "OAuth2", basicAuthResourceName: "", oAuth2ResourceName: "MY_OAUTH2_CRED", proxyEnable: false, httpTimeout: "3000", withBody: false, retryDelay: 0, maxRetries: 0, restAllowedHeaders: false } },
        { desc: "Example without auth", state: { httpAddress: "https://api.example.com/public", httpMethod: "GET", httpAuthorization: "None", basicAuthResourceName: "", oAuth2ResourceName: "", proxyEnable: false, httpTimeout: "30000", withBody: false, retryDelay: 0, maxRetries: 0, restAllowedHeaders: false } }
      ],
      fields: { httpAddress: "https://api.example.com/endpoint", httpMethod: "GET|POST|PUT|DELETE|PATCH|HEAD", httpTimeout: "30000", maxRetries: 0, retryDelay: 0, httpAuthorization: "None|Basic|OAuth2", basicAuthResourceName: "name of a BASIC credential (must be set when httpAuthorization='Basic')", oAuth2ResourceName: "name of an OAUTH_2 credential (must be set when httpAuthorization='OAuth2')", proxyEnable: false, withBody: false, restAllowedHeaders: false, restAllowedHeaderList: [] }
    },
    processSOAP: {
      description: "SOAP web service call. For auth you MUST first create a credential with mip_create_credential and reference it by that name.",
      connectorDataKey: "SOAPState",
      authGuide: {
        NONE:   "soapAuthorization: 'None' — basicAuthResourceName is left empty.",
        BASIC:  "soapAuthorization: 'Basic' + basicAuthResourceName: '<name of a BASIC credential>' — it must have been created with mip_create_credential using credentialType:'BASIC'.",
        CERT:   "ClientCertificateResourceName: '<certificate name>' — the name of a certificate uploaded with mip_upload_certificate.",
        WARNING: "The basicAuthResourceName FIELD is not a service-user username, it is the NAME OF A CREDENTIAL created with mip_create_credential."
      },
      realExamples: [
        { desc: "Basic Auth SOAP ornegi", state: { soapAddress: "http://service.example.com/soap", soapAction: "http://tempuri.org/IService/Op", soapEnvelope: true, soapAuthorization: "Basic", basicAuthResourceName: "MY_SOAP_CRED", oAuth2ResourceName: "", ClientCertificateResourceName: "", proxyEnable: false, soapTimeout: "60000", retryDelay: 0, maxRetries: 0, soapAllowedHeaders: false } },
        { desc: "SOAP example without auth", state: { soapAddress: "http://service.example.com/soap", soapAction: "http://tempuri.org/IService/Op", soapEnvelope: true, soapAuthorization: "None", basicAuthResourceName: "", oAuth2ResourceName: "", ClientCertificateResourceName: "", proxyEnable: false, soapTimeout: "60000", retryDelay: 0, maxRetries: 0, soapAllowedHeaders: false } }
      ],
      fields: { soapAddress: "http://service.example.com/soap", soapAction: "http://tempuri.org/IService/Operation", soapEnvelope: true, soapTimeout: "60000", soapAuthorization: "None|Basic", basicAuthResourceName: "name of a BASIC credential (must be set when soapAuthorization='Basic')", oAuth2ResourceName: "name of an OAUTH_2 credential (optional)", ClientCertificateResourceName: "certificate name (optional, must have been uploaded with mip_upload_certificate)", contentType: "text/xml (optional)", maxRetries: 0, retryDelay: 0, proxyEnable: false, soapAllowedHeaders: false, soapAllowedHeaderList: [] }
    },
    processScript: {
      description: "Groovy script calistirir. Exchange body/header/property tam erisim. .groovy resource'a referans verir.",
      connectorDataKey: "ScriptState",
      fields: { scriptPath: "scriptDosyasi.groovy", logScriptPayload: true, nodeId: "optional" },
      groovyGuide: {
        signature: "Every MIP Groovy script MUST use this signature:\n  import org.apache.camel.Exchange;\n  def Exchange executeMessage(Exchange message) {\n    // your code\n    return message;\n  }",
        bodyAccess: {
          read: "def body = message.getIn().getBody(String.class)",
          write: "message.getIn().setBody(yeniBody)",
          alternative: "message.in.getBody(String.class) or message.in.setBody(...) can also be used"
        },
        headerAccess: {
          read: "message.getIn().getHeader('headerAdi')",
          write: "message.getIn().setHeader('Content-Type', 'application/json')"
        },
        propertyAccess: {
          read: "message.getProperty('propAdi')  // null-safe: message.getProperty('propAdi') ?: 'default'",
          write: "message.setProperty('propName', value)"
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
        nullSafeOp: "use the ?. operator: parsedJson?.field?.subfield ?: 'default'",
        realExamples: [
          "// Property set etmek:\nmessage.setProperty('invoiceNo', req.invoiceNo.toString())",
          "// Header set etmek:\nmessage.getIn().setHeader('Authorization', 'Basic ' + ('user:pass'.bytes.encodeBase64().toString()))",
          "// Pull a value out of an XML body and turn it into a property:\ndef root = new groovy.xml.XmlSlurper().parseText(message.getIn().getBody(String.class))\nmessage.setProperty('desc', root.weather.description.text())",
          "// Liste donusumu:\ndef items = parsedJson.collect { item -> [id: item?.id ?: '', name: item?.name ?: ''] }"
        ]
      }
    },
    processXSLTMapping: { description: "XSLT donusumu uygular. .xsl resource'a referans verir.", connectorDataKey: "XSLTState", fields: { xsltPath: "transform.xsl", logXSLTPayload: false, nodeId: "optional" } },
    processSetContext: { description: "Extracts a value from the payload and stores it as an exchangeProperty or header. When useSimpleQuery=true it rebuilds the body from contextBody.", connectorDataKey: "SetContextState", fields: { nodeId: "", useSimpleQuery: "false=use propertyRows/headerRows | true=rewrite the body from contextBody", contextBody: "useSimpleQuery=true oldugunda body expression: uid=dollar{exchangeProperty.uid}&pwd=dollar{exchangeProperty.pwd}", propertyRows: [{ id: 0, propertyName: "propAdi", propertyType: "Constant|Expression|XPath|JSONPath|Header|Property", propertyValue: "string | ${exchangeProperty.x}=='true' | /TedarikciPaketleri/Item | $.TedarikciPaketleri.Item | messageid123 | //status" }], headerRows: [{ id: 0, headerName: "Content-Type", headerType: "Constant|Expression|XPath|JSONPath|Header|Property", headerValue: "string | ${exchangeProperty.x}=='true' | /TedarikciPaketleri/Item | $.TedarikciPaketleri.Item | messsageId123 | //status" }] } },
    processConverter: { description: "Data format conversion. J2X=JSON-to-XML, X2J=XML-to-JSON, and other types exist too.", connectorDataKey: "ConverterState", fields: { convertType: "J2X|X2J|CSV|JSON|XML|Avro|Parquet", xmlRootName: "root element name for J2X (example: DenizbankResponse)", xmlNamespace: "optional namespace (example: http://mdpgroup.com/EHO or a:http://...)", xmlElementForCSV: "XML element name for CSV conversion", jsonElementForCSV: "JSON element name for CSV conversion", csvSeparator: "CSV separator (default comma)", csvHeaders: "CSV sutun basliklari", toXmlElement: "XML ciktida wrap eleman", toJsonElement: "JSON ciktida wrap eleman", isFieldNameAsHeader: false, isDisabledXMLRootElement: "set true for X2J (the root element already exists in the XML)", isCsvHeaderIncludedAsFieldName: false, isEmptyStringNull: false, jsonElements: [] } },
    processCondition: {
      description: "Conditional branching (Camel Content-Based Router). Each conditionsRow defines one output branch AND an edge of type edgeSchema.conditionEdge must be written BY HAND for each branch. connectorData contains only ConditionState.conditionsRows.",
      connectorDataKey: "ConditionState",
      rules: [
        "MANDATORY DEFAULT: every processCondition must have EXACTLY ONE row with isDefaultCondition:true. On the default row conditionType:'' and conditionValue:'' (EMPTY). Without a default, a non-matching message is lost and the flow fails to deploy/run.",
        "EDGE SHAPE (v1.16): condition edge = normal edge + conditionId + label. That means it carries sourceHandle:'normal-source' TOO (and the id is 'reactflow__edge-<cond>normal-source-<target>'). The previous KB said 'sourceHandle is not written'; that has been CORRECTED — sourceHandle is present in 84/84 real exports.",
        "EDGE MATCHING: conditionsRows[].edgeId must be EXACTLY the same as the conditionId of the conditionEdge for that branch. Format: '<conditionNodeId>--<targetNodeId>' (double hyphen).",
        "ONE ROW = ONE EDGE: if there are N conditionsRows there must be N conditionEdges. A missing or extra edge breaks deploy.",
        "EXPRESSION QUOTING: when conditionType:'Expression', string literals go in SINGLE QUOTES: \"${exchangeProperty.rootName} == 'OK'\". Writing it unquoted (== OK) blows up in Camel Simple. Numeric comparison is unquoted: \"${exchangeProperty.count} > 0\".",
        "ORDERING: MIP evaluates branches top to bottom and takes the first match. Put the default row last (real flows show it both first and last, but last is safest)."
      ],
      fields: { conditionsRows: [{ edgeId: "<conditionNodeId>--<hedefNodeId>", conditionName: "branch-name (same as edge.label)", conditionType: "Expression|XPath|JSONPath ('' = default satir)", conditionValue: "${exchangeProperty.status} == 'OK' | XPath | '' (default satir)", isDefaultCondition: false }], nodeId: "optional" },
      realExample: {
        desc: "A REAL 4-branch condition (F_KERVANGIDA_UK_STOCK_ADJS): ERR/FATAL/OK/default based on the rootName property. Node + 4 edges together.",
        conditionNode: { id: "condA", type: "special", data: { objectType: "processCondition", label: "Condition", connectorData: { ConditionState: { conditionsRows: [
          { edgeId: "condA--nodeErr",  conditionName: "ERR",   conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'ERR'",   isDefaultCondition: false },
          { edgeId: "condA--nodeFatal",conditionName: "FATAL", conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'FATAL'", isDefaultCondition: false },
          { edgeId: "condA--nodeOk",   conditionName: "OK",    conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'OK'",    isDefaultCondition: false },
          { edgeId: "condA--nodeNone", conditionName: "default",conditionType: "",           conditionValue: "",                                     isDefaultCondition: true }
        ] } } }, position: { x: 600, y: 0 }, height: 40, width: 160, processSteps: [] },
        edges: [
          { id: "reactflow__edge-condAnormal-source-nodeErr",  type: "buttonedge", source: "condA", target: "nodeErr",  sourceHandle: "normal-source", conditionId: "condA--nodeErr",  label: "ERR",     height: 0, width: 0, processSteps: [] },
          { id: "reactflow__edge-condAnormal-source-nodeFatal",type: "buttonedge", source: "condA", target: "nodeFatal",sourceHandle: "normal-source", conditionId: "condA--nodeFatal",label: "FATAL",   height: 0, width: 0, processSteps: [] },
          { id: "reactflow__edge-condAnormal-source-nodeOk",   type: "buttonedge", source: "condA", target: "nodeOk",   sourceHandle: "normal-source", conditionId: "condA--nodeOk",   label: "OK",      height: 0, width: 0, processSteps: [] },
          { id: "reactflow__edge-condAnormal-source-nodeNone", type: "buttonedge", source: "condA", target: "nodeNone", sourceHandle: "normal-source", conditionId: "condA--nodeNone", label: "default", height: 0, width: 0, processSteps: [] }
        ]
      },
      twoConditionNote: "TWO separate condition nodes can be used back to back (common in real flows: first 'Route', then 'SAP gate'). Each is an INDEPENDENT node with its own edge set. The second condition is reached from one of the first condition's branches via a normalEdge. The symptom 'I could not use two conditions' usually means the second condition's edge conditionId matching or its default branch was missing."
    },
    processSplit: { description: "Splits the message into parts; each part continues through the flow.", connectorDataKey: "SplitState", fields: { splitType: "xPath|token|linefeed|regex", xpathExpression: "//items/item", isParallelProcessing: false, isKeepRootElement: false, isStopOnException: false, size: 1 } },
    processSplitter: { description: "processSplit alternatifi.", connectorDataKey: null, fields: {} },
    processFilter: { description: "Kosul saglanmayan mesaji durdurur.", connectorDataKey: "FilterState", fields: { pathTypes: "jsonPath|xPath", jsonpathExpression: "$.field", xpathExpression: "//element" } },
    processMulticast: { description: "Sends the message to multiple targets, in parallel or sequentially.", connectorDataKey: "MulticastState", fields: { isParallelProcessing: false } },
    processDirect: { description: "In-memory routing. Can connect to another flow via flowId.", connectorDataKey: "DirectState", fields: { directName: "direct-endpoint-name", isAsync: false, flowId: "target-flow-id (optional, present in 41/48 examples)" } },
    processJDBC: { description: "SQL sorgusu calistirir.", connectorDataKey: "JDBCState", fields: { database_name: "datasource-ref", jdbcQuery: "SELECT * FROM table", returnType: "JSON|XML", returnAsXml: false, nodeId: "optional" } },
    processMail: { description: "Sends e-mail over SMTP. exchangeProperty is supported in the fields.", connectorDataKey: "MailState", fields: { address: "smtp.office365.com", port: 587, credentialName: "credential-ref", from: "sender@domain.com", to: "alici@domain.com", cc: "optional", bcc: "optional", subject: "konu", mailBody: "govde", bodyMimeType: "TEXT/Plain|TEXT/Html", bodyEncoding: "UTF-8", authentication: "LOGIN|PLAIN", encryption: "STARTTLS|SSL", addAttachments: false, attachments: [{ id: 0, attachmentName: "name", attachmentMimeType: "Application/JSON", attachmentExpression: "${exchangeProperty.x}=='true'" }], connectionTimeout: "optional", readTimeout: "optional", writeTimeout: "optional" } },
    processSFTP: { description: "Uploads a file to an SFTP server.", connectorDataKey: "SFTPState", fields: { host: "sftp.example.com", port: "22", userName: "user", password: "pass", authenticationMethod: "username|privateKey", privateKeyAlias: "optional", filePath: "/remote/path", fileName: "file.xml", fileEncoding: "UTF-8|Windows-1254", addMessageID: false, addTimeStamp: false, useTempMode: false, tempFileScheme: "UTF-8" } },
    processFTP: { description: "Sends a file to an FTP server.", connectorDataKey: "FTPState", fields: { host: "ftp.example.com", port: "21", userName: "user", password: "pass", filePath: "/remote/path", fileName: "output.txt", fileEncoding: "UTF-8", addMessageID: false, addTimeStamp: false, useTempMode: false, tempFileScheme: "UTF-8" } },
    processFile: { description: "Local file system read/write.", connectorDataKey: "FileState", fields: { filePath: "C:/output", fileName: "output.xml", addTimeStamp: false, addMessageID: false, useTempMode: false, tempFileScheme: ".tmp", fileEncoding: "UTF-8" } },
    processWebdav: { description: "Uploads a file to a WebDAV server.", connectorDataKey: "WebdavState", fields: { host: "https://webdav.example.com", port: 443, credentialName: "credential-ref", directory: "/integration/outgoing", fileName: "output.txt", isAutoCreate: false, isAddMessageId: false, isAddTimestamp: false } },
    processErrorSubflow: {
      description: "Adds error handling to the flow (similar to Camel onException/doTry). Together with processStartError + processEndError it forms a group of THREE. It has NO connectorData.",
      connectorDataKey: null,
      structure: [
        "CONTAINER: the processErrorSubflow node is type:'error' (note: NOT 'special' like the others). It has its own position and no connectorData.",
        "CHILDREN: the processStartError and processEndError nodes are CHILDREN of the container — both carry parentNode:'<container id>' and extent:'parent', and their position is RELATIVE to the container.",
        "ID CONVENTION (as seen in real flows): StartError id = <containerId>+'0', EndError id = <containerId>+'1'. Not mandatory, but this is what the MIP UI generates.",
        "FLOW: processStartError -> (error-handling nodes: script/mail/setContext...) -> processEndError. These inner nodes also carry parentNode:'<containerId>', extent:'parent'. The connections are normalEdges (buttonedge + sourceHandle:'normal-source').",
        "It is NOT CONNECTED to the main flow by an edge — MIP routes to this subflow automatically when an error occurs."
      ],
      realExample: {
        container: { id: "err1", type: "error", data: { objectType: "processErrorSubflow", label: "Error Subflow", connectorData: null }, position: { x: 1400, y: 400 }, height: 200, width: 1300, processSteps: [] },
        startError: { id: "err10", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processStartError", label: "Start Error" }, position: { x: 20, y: 40 }, height: 40, width: 160, processSteps: [] },
        endError: { id: "err11", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processEndError", label: "End Error" }, position: { x: 1230, y: 42 }, height: 40, width: 160, processSteps: [] }
      }
    },
    processStartError: { description: "Start of the error flow. type:'special', parentNode:'<processErrorSubflow container id>', extent:'parent'. No connectorData. See processErrorSubflow.structure.", connectorDataKey: null, fields: {} },
    processEndError: { description: "End of the error flow. type:'special', parentNode:'<processErrorSubflow container id>', extent:'parent'. No connectorData.", connectorDataKey: null, fields: {} },
    processDelayer: { description: "Akisi ms cinsinden durdurur.", connectorDataKey: "DelayerState", fields: { delayer: 3000 } },
    processDelay: { description: "Akisi geciktirir (processDelayer alternatifi).", connectorDataKey: null, fields: {} },
    processLoop: { description: "Belirtilen sayida dongu calistirir.", connectorDataKey: "LoopState", fields: { loopCount: 3 } },
    processAggregator: { description: "Combines multiple messages into a single message.", connectorDataKey: "AggregatorState", fields: { incomingFormat: "JSON|XML", correlationExpression: "$.correlationId" } },
    processCounter: { description: "Message counter.", connectorDataKey: "CounterState", fields: { counterName: "optional", mode: "INCREASE|DECREASE|RESET (optional)" } },
    processEdifactConverter: { description: "Conversion between EDIFACT and XML.", connectorDataKey: "EdifactConverterState", fields: { convertType: "EDIFACT_TO_XML|XML_TO_EDIFACT", singleLine: "false (optional)" } },
    processTradacomsConverter: { description: "Conversion between TRADACOMS EDI and XML.", connectorDataKey: "TradacomsConverterState", fields: { convertType: "TRADACOMS_TO_XML|XML_TO_TRADACOMS", singleLine: false } },
    processVDAConverter: { description: "Conversion between the VDA format and XML. German automotive standard.", connectorDataKey: "VDAConverterState", fields: { convertType: "VDA_TO_XML|XML_TO_VDA (optional)", singleLine: "false (optional)", xsdPath: "VDA490500.xsd (optional)" } },
    processEancomConverter: { description: "Conversion between EANCOM EDI and XML. Retail/logistics.", connectorDataKey: "EancomConverterState", fields: { convertType: "EANCOM_TO_XML|XML_TO_EANCOM", singleLine: false } },
    processANSIX12Converter: { description: "Conversion between ANSI X12 EDI and XML. US standard.", connectorDataKey: "ANSIX12ConverterState", fields: { convertType: "ANSIX12_TO_XML|XML_TO_ANSIX12 (optional)", singleLine: "false (optional)", xsdPath: "ASC_856004010.xsd (optional)" } },
    processOdetteConverter: { description: "Conversion between ODETTE EDI and XML. European automotive.", connectorDataKey: "OdetteConverterState", fields: { convertType: "ODETTE_TO_XML|XML_TO_ODETTE (optional)", singleLine: "false (optional)" } },
    processEdiExtractor: { description: "EDI mesajindan belirli segmentleri cikarir.", connectorDataKey: null, fields: {} },
    processBase64Converter: { description: "Base64 encode or decode operation.", connectorDataKey: "Base64ConverterState", fields: { convertType: "ENCODE|DECODE" } },
    processJMS: { description: "Sends a message to a JMS queue.", connectorDataKey: "JMSState", fields: { url: "broker.host.com", port: "61616", topicName: "QUEUE.NAME", authName: "credential-ref", message: "${body}", isLocalConnection: false, isEncrypted: false, isCompressed: false, isTransferExchangeProperties: false, headerRows: [{ id: 0, headerName: "example", headerType: "Constant|Expression|JSONPath|Header|XPath", headerValue: "value" }] } },
    processMQTT: { description: "Publishes a message to an MQTT broker.", connectorDataKey: "MQTTState", fields: { broker: "mqtt-broker.host.com", port: "8883", topic: "topic/name", authName: "credential-ref", message: "${body}", version: "3|5", qos: "0|1|2" } },
    processKafka: { description: "Sends a message to a Kafka topic.", connectorDataKey: "KafkaState", fields: { broker: "kafka-broker.host.com", port: "9093", groupId: "consumer-group", queue: "topic-name", authName: "credential-ref", certificateName: "optional", isCompressed: false, isEncrypted: false, message: "${body}", headerRows: [{ id: 0, headerName: "example", headerType: "Constant|Expression|JSONPath|Header|XPath", headerValue: "value" }], additionalParameters: "security.protocol=SSL" } },
    processRabbitMq: { description: "Sends a message to RabbitMQ.", connectorDataKey: "RabbitMqState", fields: { broker: "rabbitmq.host.com", port: "5672", queue: "queue-name", exchangeName: "exchange-name", routingKey: "optional", authName: "credential-ref", isCompressed: false, isEncrypted: false, message: "${body}", headerRows: [] } },
    processSolace: { description: "Sends a message to a Solace message broker.", connectorDataKey: "SolaceState", fields: { broker: "solace-broker.host.com", port: "5550", queue: "queue.name", vpn: "vpn-name", authName: "credential-ref", isCompressed: false, isEncrypted: false, message: "${body}" } },
    processGooglePubsub: { description: "Sends a message to Google Cloud Pub/Sub.", connectorDataKey: "GooglePubsubState", fields: { googlePubsubCredential: "credential-ref", projectId: "gcp-project-id", destinationName: "topic-name", attributeRows: [] } },
    processOpcua: { description: "Communicates with an OPC-UA server. Industrial IoT.", connectorDataKey: "OPCUAState", fields: { host: "opcua.host.com", applicationName: "ClientAppName", applicationUri: "urn:example:client", basicAuthenticationId: "credential-ref", isAnonymousLogin: false, allowedSecurityPolicies: "Basic256|None", keyStoreName: "optional", keyAlias: "optional", dataType: "String|Int|Float", nodeIds: "[\"ns=2;s=Node/Id\"]" } },
    processOdata: { description: "OData REST servisi cagrisi.", connectorDataKey: "OdataState", fields: { httpAddress: "https://odata.service.com", resourcePath: "EntitySet", operation: "GET|POST|PUT|DELETE", odataVersion: "v2.0|v4.0", httpAuthentication: "none|basic|oauth2", basicAuthResourceName: "optional", oAuth2ResourceName: "optional", httpTimeout: "3000", contentType: "JSON|XML", queryOptions: "tam-manuel-odata-query-string", queryFields: { "FieldName": true }, queryFilters: [], queryFilterConditions: [], querySorts: [], fieldsSelection: {}, keyValue: "", top: "optional", skip: "optional", useManualQuery: false, headerRows: [] } },
    processRFC: { description: "SAP RFC/BAPI cagrisi.", connectorDataKey: "RFCState", fields: { rfcDestinationName: "SAP-RFC-destination-name" } },
    processMongoDb: { description: "Query or write operation against a MongoDB collection.", connectorDataKey: "MongoDbState", fields: { databaseName: "database-name", collectionName: "collection-name", operation: "find|insert|update|delete|getColStats", query: "{}", filter: "{}", sort: "{}", limit: "", multiUpdate: "false", returnType: "JSON", bulkWriteModel: [] } },
    processAwsS3Storage: { description: "Uploads a file to, or downloads one from, an AWS S3 bucket.", connectorDataKey: "AwsS3StorageState", fields: { awsCredential: "credential-ref", region: "us-east-1", bucketName: "bucket-name", objectKey: "path/to/object", contentEncoding: "gzip (optional)", storageClass: "STANDARD|REDUCED_REDUNDANCY" } },
    processAwsQueue: { description: "Sends a message to an AWS SQS queue.", connectorDataKey: "AwsQueueState", fields: { awsCredential: "credential-ref", queueName: "sqs-queue-name", region: "us-east-1" } },
    processAwsEventBridge: { description: "AWS EventBridge'e event gonderir.", connectorDataKey: "AwsEventBridgeState", fields: { awsCredential: "credential-ref", region: "us-east-1", eventBusName: "event-bus-name", operation: "putEvent", ruleName: "optional", targetArn: "optional", entries: [{ source: "service.name", detail: "{}", detailType: "EventType", resources: "[]" }] } },
    processAzureQueue: { description: "Sends a message to an Azure Storage Queue.", connectorDataKey: "AzureQueueState", fields: { azureCredential: "credential-ref", accountName: "storage-account-name", queueName: "queue-name" } },
    processSalesforceBulkApi: { description: "Bulk data operation via the Salesforce Bulk API.", connectorDataKey: "SalesforceBulkApiState", fields: { salesforceClientCredential: "client-credential", salesforceUserCredential: "user-credential", objectName: "Account|Contact|vb.", operation: "insert|update|upsert|delete", processType: "Bulk Data", bulkOperation: "Create Job|Query Job", apiVersion: "56.0", columnDelimiter: "COMMA|TAB|PIPE", lineEnding: "LF|CRLF", fieldNames: "optional", externalId: "optional", conditionExpression: "optional", limit: "optional" } },
    processSalesforceRestQuery: { description: "Queries data from Salesforce with SOQL.", connectorDataKey: "SalesforceRestQueryState", fields: { salesforceClientCredential: "client-credential", salesforceUserCredential: "user-credential", processType: "SOQL Query", query: "SELECT Id, Name FROM Account WHERE Industry = 'Technology'", apiVersion: "56.0", includeDeletedRecords: false } },
    processOFTP2: { description: "File transfer over the OFTP2 protocol. Common in automotive EDI.", connectorDataKey: "OFTP2State", fields: { oftp2ConnectionName: 0, host: "oftp2.partner.com", port: 6619, encoding: "ISO-8859-1|UTF-8", fileName: "file-name", fileFormat: "Unstructured|Fixed length|Variable", fileDescription: "optional", sfid: "O0013000FIRMAADIKOD", isCompressed: false, isEncrypted: false, isSigned: false, signAlgorithm: "MD5|SHA1 (optional)" } },
    processAS2: { description: "B2B EDI file transfer over the AS2 protocol. Supports signing and encryption.", connectorDataKey: "AS2State", fields: { as2From: "MY_COMPANY_AS2_ID", as2To: "PARTNER_AS2_ID", uri: "as2/receive", hostname: "as2.partner.com", port: 443, ediMessageType: "application/edifact|application/x-edi-x12", messageStructure: "PLAIN|CMS", subject: "message subject", sendMdn: true, signMdn: true, encryptingAlgorithm: "AES128_CBC|AES256_CBC|3DES", signingAlgorithm: "SHA256WITHRSA|SHA1WITHRSA", isCharsetConversionEnabled: false, clientPrivateKeyId: "key-id", clientPrivateKeyName: "key-name", clientCertificateId: "optional", clientCertificateName: "optional", serverCertificateId: "optional", serverCertificateName: "optional", mdnMessageTemplate: "optional" } },
    processGraphicalMapping: {
      description: "(NEW in v1.16) Applies a visual (drag-and-drop) field mapping — connects source schema fields to target schema fields without writing XSLT/Groovy. The node's connectorData carries ONLY mappingName; the mapping itself lives in a SEPARATE 'flow-mapping' object (see the graphicalMapping section). IMPORTANT: mappingName == flow-mapping.name (under the same flowId) must match EXACTLY; the flow-mapping and the source/target schema resources must also be included in the import package, otherwise the mapping is not found at deploy time.",
      connectorDataKey: "GraphicalMappingState",
      fields: { mappingName: "Name of the linked flow-mapping (e.g. 'MAPPING'). Must be the same as flow-mapping.name under the same flowId." },
      note: "XSLT (processXSLTMapping) and Groovy (processScript) reference a resource FILE (.xsl/.groovy); a graphical mapping, by contrast, references a first-class flow-mapping object (by name), not a resource. Use the flowMappings argument of mip_create_and_import_flow to generate/import one."
    },
    processMCP: {
      description: "(NEW in v1.16) Calls a tool on an external MCP server that MIP connects to as an MCP CLIENT. connectorData carries only the name of the tool to call. The MCP server must be defined and SYNCHRONIZED under Operations>Destinations>MCP Servers (mip_create_mcp_server + mip_sync_mcp_server); the tool name must be one of the tools that server exposes (visible via mip_list_mcp_server_tools).",
      connectorDataKey: "MCPState",
      fields: { tool: "Name of the MCP tool to call (e.g. 'echo', 'printEnv', 'list_allowed_directories'). One of the tools exposed by the MCP server." },
      note: "This connects to EXTERNAL MCP servers defined via /api/mcp-servers (the mip_*_mcp_server tools) — do not confuse it with this project itself (mip-mcp-server). The transport must be HTTP/SSE (stdio/npx will not synchronize)."
    },
    processXIProxy: {
      description: "(NEW in v1.16) SENDS an XI/PI proxy message from MIP to SAP (SAP XI proxy receiver). The opposite direction (SAP to MIP) is processStart with connectorType:'SAPXI'. The XI System / PO connection must be defined under Operations>Sap-Connections>XI Proxy (mip_*_xi_system, mip_*_po_connection, mip_*_soa_connection) — stuck messages are monitored with mip_list_xi_queue_messages.",
      connectorDataKey: "XIProxyState",
      fields: { xiSystemName: "Name of the target XI System (mip_list_xi_systems)", xiInterfaceName: "SAP interface name (e.g. 'SI_CUSTOM_MODULE_INB_SYN')", xiNamespace: "Interface namespace (e.g. 'http://mdpgroup.com/...')", xiQos: "BestEffort|ExactlyOnce|ExactlyOnceInOrder", xiSenderService: "Sender service name (e.g. 'MIP')", xiInterfaceSource: "'catalog' (from the ESR catalog) or 'wsdl' (an uploaded WSDL)", xiCatalogConnectionId: "PO/SOA connection id for the catalog source (string)", xiWsdlResourceName: "name of the uploaded WSDL for the wsdl source", xiTimeout: 60000, xiMaxRetries: 0, xiRetryDelay: 5000 }
    },
    conditionEdge: { description: "The conditional edge leaving a processCondition. This is NOT a node but an edge type, and it MUST BE WRITTEN BY HAND (it is not created automatically). For its structure see edgeSchema.conditionEdge. One per conditionsRow, carrying sourceHandle:'normal-source'+conditionId+label, with conditionId matching edgeId, and a default branch edge must exist as well.", connectorDataKey: null }
  },


  expressionLanguage: {
    description: "MIP node'lari Apache Camel altyapisi kullanir. Alanlarda gecen ifadeler Camel Simple / XPath / JSONPath dilindedir.",
    simple: {
      property:  "${exchangeProperty.name}  — reads a property set with processSetContext",
      header:    "${header.HeaderName}  — a message header",
      body:      "${body}  — the message body",
      stringLiteral: "String sabit karsilastirmasi TEK TIRNAK ister: ${exchangeProperty.route} == 'OK'  (== OK YANLIS)",
      numeric:   "Sayisal karsilastirma tirnaksiz: ${exchangeProperty.count} > 0",
      combine:   "Mantiksal: ${exchangeProperty.a} == 'X' && ${header.b} == 'Y'",
      usedIn:    "processCondition.conditionValue (conditionType:'Expression'), processFilter, processSetContext (propertyType:'Expression'), processMail alanlari, processDirect, attachmentExpression"
    },
    xpath:   "conditionType/propertyType:'XPath' -> over an XML body: /Root/Item/Status  or  //status  or  local-name(/*) (root element name).",
    jsonPath:"conditionType/propertyType:'JSONPath' -> over a JSON body: $.field.subfield  or  $.items[0].id",
    commonPattern: "TYPICAL FLOW: processScript or processSetContext extracts a value from the body into an exchangeProperty (e.g. 'route'), then processCondition branches on ${exchangeProperty.route}=='...'. This is the most common pattern in real flows — the condition does not parse the body directly, the value is lifted into a property first.",
    flowConfigurations: "GLOBAL/LOCAL FLOW CONFIGS: configs defined in MIP under 'Global Flow Configurations' (Operations menu, the mip_*_global_flow_config tools) and per-flow via 'Configure Flow' are exposed at runtime as EXCHANGE PROPERTIES named after their configKey. Read them from Groovy/Simple: Simple -> ${exchangeProperty.<configKey>} , Groovy script -> exchange.getProperty('<configKey>'); to assign or override a value use processSetContext (propertyName:'<configKey>') or, in Groovy, exchange.setProperty('<configKey>', value). DO NOT HARDCODE constants that vary across environments/flows (flags, thresholds, mail addresses, etc.) — read them from a config key as an exchangeProperty. configValue may be a scalar or JSON; if it is JSON it arrives as a parsed object. A global config with appliedGlobally is applied to every flow automatically; the value can be overridden per flow, or a flow-specific (local) config can be added."
  },

  flowTemplates: {
    description: "COMPLETE (node+edge) canonical templates extracted from real Kervan Prod flows, ready to hand straight to mip_create_and_import_flow. The node ids are examples — replace them with your own unique ids but PRESERVE the edge/conditionId matching.",

    linearFlow: {
      desc: "The simplest flow: Start -> Script -> End. Shows the normal edge structure.",
      flowData: [
        { id: "start1", type: "special", data: { objectType: "processStart", label: "Start", connectorData: { StartState: { connectorType: "REST", restAddress: "/example", restMethod: "POST", restAuthenticationAllowDefaultBasicCredentials: true, isSyncEndpoint: true } } }, position: { x: 0, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "script1", type: "special", data: { objectType: "processScript", label: "Script", connectorData: { ScriptState: { scriptPath: "transform.groovy", logScriptPayload: true } } }, position: { x: 300, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "end1", type: "special", data: { objectType: "processEnd", label: "End", connectorData: null }, position: { x: 600, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-start1normal-source-script1", type: "buttonedge", source: "start1", target: "script1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-script1normal-source-end1", type: "buttonedge", source: "script1", target: "end1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] }
      ]
    },

    conditionFlow: {
      desc: "ONE condition, 3 branches (OK / ERR / default). A 'route' property is set with SetContext first, then the condition branches on it. THE MOST CRITICAL TEMPLATE FOR COMPLEX FLOWS — mind the edgeId<->conditionId matching and the default branch.",
      flowData: [
        { id: "start1", type: "special", data: { objectType: "processStart", label: "Start", connectorData: { StartState: { connectorType: "REST", restAddress: "/route", restMethod: "POST", restAuthenticationAllowDefaultBasicCredentials: true, isSyncEndpoint: true } } }, position: { x: 0, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "set1", type: "special", data: { objectType: "processSetContext", label: "Set Context", connectorData: { SetContextState: { useSimpleQuery: false, contextBody: "", headerRows: [], propertyRows: [{ id: 0, propertyName: "route", propertyType: "XPath", propertyValue: "/Result/Status" }] } } }, position: { x: 300, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "cond1", type: "special", data: { objectType: "processCondition", label: "Condition", connectorData: { ConditionState: { conditionsRows: [
          { edgeId: "cond1--okEnd",  conditionName: "OK",      conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'OK'",  isDefaultCondition: false },
          { edgeId: "cond1--errEnd", conditionName: "ERR",     conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'ERR'", isDefaultCondition: false },
          { edgeId: "cond1--defEnd", conditionName: "default", conditionType: "",           conditionValue: "",                                   isDefaultCondition: true }
        ] } } }, position: { x: 600, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "okEnd",  type: "special", data: { objectType: "processEnd", label: "End",  connectorData: null }, position: { x: 900, y: 0 },   height: 40, width: 160, processSteps: [] },
        { id: "errEnd", type: "special", data: { objectType: "processEnd", label: "End", connectorData: null }, position: { x: 900, y: 150 }, height: 40, width: 160, processSteps: [] },
        { id: "defEnd", type: "special", data: { objectType: "processEnd", label: "End", connectorData: null }, position: { x: 900, y: 300 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-start1normal-source-set1", type: "buttonedge", source: "start1", target: "set1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-set1normal-source-cond1", type: "buttonedge", source: "set1", target: "cond1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-okEnd",  type: "buttonedge", source: "cond1", target: "okEnd",  sourceHandle: "normal-source", conditionId: "cond1--okEnd",  label: "OK",      height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-errEnd", type: "buttonedge", source: "cond1", target: "errEnd", sourceHandle: "normal-source", conditionId: "cond1--errEnd", label: "ERR",     height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-defEnd", type: "buttonedge", source: "cond1", target: "defEnd", sourceHandle: "normal-source", conditionId: "cond1--defEnd", label: "default", height: 0, width: 0, processSteps: [] }
      ]
    },

    twoConditionsFlow: {
      desc: "TWO consecutive conditions (the scenario users get stuck on). cond1 (OK/default) -> a normalEdge from the OK branch to cond2; cond2 (SAP/default). Each condition is an INDEPENDENT node with its own edge set. The second condition's default is MANDATORY too.",
      flowData: [
        { id: "start1", type: "special", data: { objectType: "processStart", label: "Start", connectorData: { StartState: { connectorType: "Timer", timerCron: "0 0/5 * 1/1 * ? *", isSyncEndpoint: false } } }, position: { x: 0, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "cond1", type: "special", data: { objectType: "processCondition", label: "Condition", connectorData: { ConditionState: { conditionsRows: [
          { edgeId: "cond1--proc1", conditionName: "OK",      conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'OK'", isDefaultCondition: false },
          { edgeId: "cond1--end1",  conditionName: "default", conditionType: "",           conditionValue: "",                                  isDefaultCondition: true }
        ] } } }, position: { x: 300, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "proc1", type: "special", data: { objectType: "processScript", label: "Script", connectorData: { ScriptState: { scriptPath: "process.groovy", logScriptPayload: true } } }, position: { x: 600, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "cond2", type: "special", data: { objectType: "processCondition", label: "Condition", connectorData: { ConditionState: { conditionsRows: [
          { edgeId: "cond2--sapErr", conditionName: "sapError", conditionType: "Expression", conditionValue: "${exchangeProperty.sapMail} == '1'", isDefaultCondition: false },
          { edgeId: "cond2--okEnd",  conditionName: "default",  conditionType: "",           conditionValue: "",                                    isDefaultCondition: true }
        ] } } }, position: { x: 900, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "sapErr", type: "special", data: { objectType: "processMail", label: "Mail", connectorData: { MailState: { from: "mip@example.com", to: "ops@example.com", subject: "SAP error", mailBody: "Error: ${exchangeProperty.err}", bodyMimeType: "TEXT/Plain", bodyEncoding: "UTF-8", address: "smtp.example.com", port: 25, encryption: "STARTTLS", authentication: "LOGIN", credentialName: "smtp_cred", addAttachments: false, attachments: [] } } }, position: { x: 1200, y: 150 }, height: 40, width: 160, processSteps: [] },
        { id: "okEnd", type: "special", data: { objectType: "processEnd", label: "End",  connectorData: null }, position: { x: 1200, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "end1",  type: "special", data: { objectType: "processEnd", label: "End", connectorData: null }, position: { x: 600, y: 150 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-start1normal-source-cond1", type: "buttonedge", source: "start1", target: "cond1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-proc1", type: "buttonedge", source: "cond1", target: "proc1", sourceHandle: "normal-source", conditionId: "cond1--proc1", label: "OK",      height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-end1",  type: "buttonedge", source: "cond1", target: "end1",  sourceHandle: "normal-source", conditionId: "cond1--end1",  label: "default", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-proc1normal-source-cond2", type: "buttonedge", source: "proc1", target: "cond2", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond2normal-source-sapErr", type: "buttonedge", source: "cond2", target: "sapErr", sourceHandle: "normal-source", conditionId: "cond2--sapErr", label: "sapError", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond2normal-source-okEnd",  type: "buttonedge", source: "cond2", target: "okEnd",  sourceHandle: "normal-source", conditionId: "cond2--okEnd",  label: "default",  height: 0, width: 0, processSteps: [] }
      ]
    },

    errorSubflowFragment: {
      desc: "The error-handling group. It is added IN ADDITION to the main flow's nodes; it is not connected to the main flow by an edge. Container type:'error', children carry parentNode+extent:'parent'.",
      flowData: [
        { id: "err1", type: "error", data: { objectType: "processErrorSubflow", label: "Error Subflow", connectorData: null }, position: { x: 0, y: 400 }, height: 220, width: 700, processSteps: [] },
        { id: "err10", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processStartError", label: "Start Error", connectorData: null }, position: { x: 20, y: 40 }, height: 40, width: 160, processSteps: [] },
        { id: "errMail", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processMail", label: "Mail", connectorData: { MailState: { from: "mip@example.com", to: "ops@example.com", subject: "Flow error", mailBody: "An error occurred", bodyMimeType: "TEXT/Plain", bodyEncoding: "UTF-8", address: "smtp.example.com", port: 25, encryption: "STARTTLS", authentication: "LOGIN", credentialName: "smtp_cred", addAttachments: false, attachments: [] } } }, position: { x: 250, y: 40 }, height: 40, width: 160, processSteps: [] },
        { id: "err11", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processEndError", label: "End Error", connectorData: null }, position: { x: 500, y: 40 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-err10normal-source-errMail", type: "buttonedge", source: "err10", target: "errMail", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-errMailnormal-source-err11", type: "buttonedge", source: "errMail", target: "err11", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] }
      ]
    },

    directChaining: {
      desc: "Chaining one flow into another (a real Kervan pattern, 7 uses). On processDirect, directName and the target flowId are given together. The target flow must have a Start with connectorType:'Direct'.",
      note: "Sender: processDirect { DirectState: { directName: '/SalesOrderIdoc', flowId: 'F_TARGET_FLOW_ID', isAsync: false } }. Receiver: processStart { StartState: { connectorType: 'Direct', directName: '/SalesOrderIdoc' } }. directName must be THE SAME on both sides."
    }
  },

  graphicalMapping: {
    description: "(NEW in v1.16) Visual field mapping (drag-and-drop). Connects source schema fields to target schema fields WITHOUT WRITING XSLT/Groovy. processXSLTMapping (.xsl file) and processScript (.groovy file) reference a RESOURCE; a graphical mapping, by contrast, is a SEPARATE first-class 'flow-mapping' OBJECT that the node references by name.",
    architecture: [
      "3 parca: (1) processGraphicalMapping node (connectorData: { GraphicalMappingState: { mappingName } }), (2) flow-mapping nesnesi (esleme grafi + kaynak/hedef sema referansi), (3) kaynak & hedef schema RESOURCE'lari (xsd/xml/json dosyalari).",
      "LINK: node.GraphicalMappingState.mappingName == flow-mapping.name (under the same flowId). If no flow-mapping of that name exists, the mapping is not found at deploy time.",
      "IMPORT: the flow-mapping object travels in the export/import zip under the 'flow-mappings/' folder, and the schema files under 'resources/'. The flowMappings + resources arguments of mip_create_and_import_flow package both (otherwise a flow with a graphical mapping may deploy but the mapping stays empty)."
    ],
    flowMappingObject: {
      description: "One record under flow-mappings/. Audit fields such as id/createdBy are assigned server-side — do not send them.",
      shape: { name: "Mapping name (same as mappingName on the node)", flowId: "Ait oldugu flow", version: 1, sourceSchemaResourceId: "server id — resolved BY NAME on import, do not set it by hand", sourceSchemaResource: { name: "kaynak-sema-dosyasi.xsd", flowId: "F_...", resourceType: "xsd|xml|json" }, targetSchemaResourceId: "server id", targetSchemaResource: { name: "hedef-sema.json", flowId: "F_...", resourceType: "xsd|xml|json" }, data: "esleme grafi (asagida)" }
    },
    dataFormat: {
      description: "flow-mapping.data = { mappings:[...], transformations:[...] }. React-Flow benzeri gorsel graf.",
      mappings: "Each source->target field link: { id:'<srcPath>-source--<tgtPath>-target', type:'custom', source:'source-file', target:'target-file', selected:false, markerEnd:{type:'arrow'}, sourceHandle:'<srcPath>-source', targetHandle:'<tgtPath>-target', targetIsArray:false }. srcPath/tgtPath = the field path inside the schema (e.g. 'Header/MessageId', 'TransformedPayload/customer/fullName').",
      transformations: "One transformation node per TARGET field: { id:'<tgtPath>-target', edges:[{ id:'<srcPath>-source--<tgtPath>-target', source, target, markerEnd }], nodes:[ {id:'<srcPath>-source', type:'fieldNode', data:{label, connectorType:'source'}}, {id:'<tgtPath>-target', type:'fieldNode', data:{label, connectorType:'target'}} ] }. In a simple 1:1 mapping there is a single edge per target field.",
      note: "For 1:1 field mappings, pass mip_create_and_import_flow a links:[{sourcePath,targetPath}] list; the MCP generates data.mappings automatically."
    },
    functions: {
      description: "Functional transformations live in flow-mapping.data.functions. The RUNTIME uses data.mappings + data.functions; data.transformations is ONLY for the visual editor and is NOT REQUIRED at deploy time (verified live). Pass them via flowMappings[].functions in mip_create_and_import_flow; a target field produced by a function must NOT also be listed in links.",
      palette: "String: CONCAT, SPLIT, SUBSTRING, UPPER_CASE, LOWER_CASE, REPLACE, TRIM | Math: ADD, SUBTRACT, MULTIPLY (girdilerini birlikte isler) | Type: TO_NUMBER, TO_STRING | Constant: CONSTANT (params.value) | Conditional: IF_ELSE | Date: CURRENT_DATE, DATE_FORMAT, DATE_BEFORE, DATE_AFTER, COMPARE_DATES",
      shape: "data.functions[] = { id:'<Label>--dndnode_<n>', type, inputs:[<srcPath>-source | <another-function-node-id>], params:{}, outputs:[<tgtPath>-target | <function-node-id>], position }. Functions can be chained: one function's outputs becomes another function's node id.",
      toolInput: "flowMappings[].functions examples: constant -> {type:'CONSTANT', value:'123', target:'Root/MENGE'}; multiply -> {type:'MULTIPLY', inputs:['Root/BNFPO'], constants:['3'], target:'Root/BNFPO'} (MULTIPLY multiplies its inputs; use constants for the literal 3 and the MCP feeds a CONSTANT node automatically); concatenate -> {type:'CONCAT', inputs:['Root/A','Root/B'], params:{addSpace:true}, target:'Root/Full'}."
    }
  },

  validation: {
    description: "mip_create_and_import_flow checks these rules automatically BEFORE import and THROWS on a violation (catching the problem before deploy blows up). Follow these rules when generating a flow.",
    errors: [
      "E1 A processCondition node may have AT MOST 1 row with isDefaultCondition:true (>1 => error). The ABSENCE of a default is not an error but warning W5 (real production flows do contain conditions without a default).",
      "E2 For every conditionsRows[].edgeId there must be an edge leaving that condition node whose conditionId is THE SAME (missing branch edge). THIS is the real deploy-breaker.",
      "E3 Every edge that has a conditionId must appear as an edgeId in the source condition node's conditionsRows (orphan condition edge).",
      "E4 Every edge source/target value must point at an existing node id (orphan edge).",
      "E5 Node ids must be unique.",
      "E6 A flow must contain >=1 processStart.",
      "E7 If a processErrorSubflow exists, its inner nodes (StartError/EndError) must be attached to it via parentNode.",
      "E8 GraphicalMappingState.mappingName on a processGraphicalMapping node cannot be EMPTY (it is the name of the linked flow-mapping)."
    ],
    warnings: [
      "W1 When conditionType:'Expression' and conditionValue contains a string literal, single quotes are recommended (== OK -> == 'OK').",
      "W2 Warns when an edge lacks type:'buttonedge' (MIP may tolerate it, but it is not canonical).",
      "W3 processCondition harici node'lardan cikan normal edge'de sourceHandle:'normal-source' onerilir.",
      "W4 The same conditionName is used more than once inside one condition node (ambiguous branch).",
      "W5 The processCondition has no default branch — a message matching nothing is silently dropped. Add a default unless that is deliberate.",
      "W6 Unknown objectType (not in the KB nodeTypes) — a typo or an unsupported node.",
      "W7 A processGraphicalMapping is present — the flow-mapping matching mappingName plus its schema resources must be included in the import package (the flowMappings argument of mip_create_and_import_flow)."
    ]
  },

  importantNotes: [
    "SAFETY / DANGER ZONES (read first): This MCP deliberately exposes NO tools for MIP's 'Database Management', 'DB Analysis & Backup' (backup/restore), or license write. These operations can cause IRREVERSIBLE damage on a live/customer MIP server. NEVER build, call, or probe: /api/database-management/*, /api/log-deletion*, /admin/backups, (/healthcheck-service)/admin/restore(/latest), /api/license/save. License is READ-ONLY (mip_get_license_detail / mip_check_license).",
    "DO NOT add the id, createdDate, createdBy, lastModifiedDate or lastModifiedBy fields to new flows — MIP assigns them automatically.",
    "flowLocked must be 0 (1 = locked flow, cannot be edited).",
    "position values should be set 300px apart so the flow renders properly in the UI (x: 0, 300, 600, 900...).",
    "On parallel branches the y coordinate must differ (upper: y:0, lower: y:150).",
    "CRITICAL — EDGE TYPE: EVERY edge carries type:'buttonedge'. DO NOT write the old 'style' object (strokeWidth/zIndex) — it does not exist in real flows. sourceHandle:'normal-source' is present on EVERY edge (normal AND condition) (a v1.16 correction — the old KB said it was absent on condition edges, which is WRONG). A condition edge additionally carries conditionId+label.",
    "CRITICAL — CONDITION WIRING: processCondition branches are NOT created automatically. Write an edge BY HAND for every conditionsRows row: type:'buttonedge', sourceHandle:'normal-source', edge.conditionId = row.edgeId ('<condNodeId>--<targetId>', double hyphen) must match EXACTLY, edge.label = row.conditionName. EXACTLY 1 default row (isDefaultCondition:true, conditionType:'', conditionValue:'') plus its edge is MANDATORY as well. If any of this is missing, deploy blows up. Full examples: flowTemplates.conditionFlow and twoConditionsFlow.",
    "CRITICAL — CONDITION EXPRESSION: comparing conditionValue against a string literal requires single quotes: \"${exchangeProperty.route} == 'OK'\". Without quotes (== OK) Camel blows up. A condition usually reads an exchangeProperty set earlier by processSetContext/processScript rather than the body itself.",
    "CRITICAL — TWO CONDITIONS: two consecutive processCondition nodes are fully supported; each is an INDEPENDENT node with its own edge set and its own default branch. The second is reached from one of the first one's branches via a normalEdge. See flowTemplates.twoConditionsFlow.",
    "CRITICAL — ERROR SUBFLOW: the processErrorSubflow container is type:'error' (NOT special); processStartError/processEndError and the inner nodes carry parentNode:'<containerId>' + extent:'parent'. It is not connected to the main flow by an edge. See flowTemplates.errorSubflowFragment.",
    "CRITICAL — NODE NAME (data.label): the node name is a FIXED canonical value per objectType (processStart→'Start', processSetContext→'Set Context', processScript→'Script', processCondition→'Condition', processMail→'Mail', processEnd→'End', processHTTP→'HTTP', processSplit→'Splitter', processRFC→'SAP RFC', processGraphicalMapping→'Graphical Mapping' …). The MIP UI enforces this name and THE USER CANNOT CHANGE IT. DO NOT write a custom/descriptive name (e.g. 'Set route', 'mail body', 'Notify', 'Transform') — it corrupts the flow object. mip_create_and_import_flow normalizes every label to the canonical name before import, so even a wrong value from the model is corrected.",
    "CRITICAL — NODE ID FORMAT (v1.16 DEPLOY-BREAKER): node ids MUST be in 'dndnode_<number>' format; ids like 'start1'/'cond1' will OPEN the flow but make DEPLOY return a 500 with 'Flow can not deploy. Cause is :' (empty cause). This was the real reason behind the 'flow opens but will not deploy' problem. mip_create_and_import_flow fixes this AUTOMATICALLY before import (every node id + edge source/target/id/conditionId + conditionsRows.edgeId + parentNode is rewritten consistently) — so deploy works even if the model emits 'start1'.",
    "NEW NODES IN v1.16: processGraphicalMapping (visual mapping — bound to a flow-mapping object by mappingName, see the graphicalMapping section), processMCP (calls a tool on an external MCP server — MCPState.tool; the server must be synchronized under /api/mcp-servers), processXIProxy (MIP->SAP XI/PI proxy send — XIProxyState; the XI System/PO connection must be defined under Sap-Connections). SAPXI (SAP->MIP XI proxy sender) was added to the processStart connectorType list.",
    "GRAPHICAL MAPPING deploy requirement: in a flow using processGraphicalMapping, a flow-mapping with the same name as mappingName AND the source/target schema resources must be included in the import package. Use the flowMappings + resources arguments of mip_create_and_import_flow; otherwise the flow opens but the mapping is empty / deploy fails.",
    "Credential/resource references (basicAuthResourceName, scriptPath, etc.) must already be defined in MIP.",
    "When writing a Groovy script you MUST use the signature 'def Exchange executeMessage(Exchange message)'. Use message.getIn().getBody(String.class), not message.in.body. Always return message.",
    "In Groovy — read the body: message.getIn().getBody(String.class) | write the body: message.getIn().setBody(...) | property: message.setProperty/getProperty | header: message.getIn().setHeader/getHeader",
    "flowPackageId must reference an existing package.",
    "When creating a new flow, flowId must be unique — it must not clash with existing flows.",
    "CRITICAL — CREDENTIAL vs SERVICE USER: the basicAuthResourceName and oAuth2ResourceName fields on processHTTP/processSOAP nodes are NOT a SERVICE USER username, they are the NAME OF A CREDENTIAL created with mip_create_credential. Order of steps: 1) create a credential of type BASIC or OAUTH_2 with mip_create_credential, 2) write that credential's name into the basicAuthResourceName or oAuth2ResourceName field of the processHTTP/processSOAP node.",
    "When a SERVICE USER is used: service users are for accessing the MIP platform (UI login, API call, triggering a Start node). A service user is not used for an outbound call to an EXTERNAL system from processHTTP/processSOAP — a credential is used there.",
    "Start node security: if the restAuthenticationUsernames or soapAuthenticationUsernames field on a REST/SOAP Start node is populated, a service-user username CAN be written HERE. That field restricts who may call this endpoint from outside.",
    "processHTTP Basic Auth flow: mip_create_credential(credentialType:'BASIC', basicAuthUsername:'user', password:'pass') → on the processHTTP node, httpAuthorization:'Basic', basicAuthResourceName:'<credential_name>'",
    "processHTTP OAuth2 flow: mip_create_credential(credentialType:'OAUTH_2', oAuth2GrantType:'CLIENT_CREDENTIALS', oAuth2TokenUrl:..., oAuth2ClientId:..., oAuth2ClientSecret:...) → on the processHTTP node, httpAuthorization:'OAuth2', oAuth2ResourceName:'<credential_name>'",
    "CRITICAL — SOAP Start (Sender) WSDL rule: in WSDLs bound to the SOAP Start adapter, elementFormDefault=\"qualified\" is MANDATORY on every <xs:schema> element. A flow will not work correctly with a missing or unqualified WSDL. When producing a new WSDL use mip_generate_wsdl (baked in automatically), and for hand-crafted files use mip_upload_wsdl (automatic validate + auto-fix); mip_upload_resource (resourceType:'wsdl') works too but performs no validation.",
    "CRITICAL — order for creating a flow that contains a SOAP Start: 1) Prepare the WSDL — for a new WSDL mip_generate_wsdl(uploadAfter:true, flowId), for an existing file mip_upload_wsdl(filePath, flowId). 2) Read the binding and operation names from the WSDL — mip_generate_wsdl returns them as bindingMetadata; for hand-crafted/external WSDLs, parse the file and take the literal <wsdl:binding name=...> and <wsdl:operation name=...> values (never guess 'serviceName + Binding'; real examples: 'CalculatorSoap', 'IDOCBinding', 'EASoapBinding'). 3) Write them into the SOAP Start StartState block: connectorType:'SOAP', soapAddress:'/<endpoint_path>' (the MIP path, NOT the WSDL location), soapWSDLResource:'<wsdl_file_name>', soapWSDLBinding:'<binding_name_from_the_wsdl>', soapWSDLOperation:'<operation_name_from_the_wsdl>'. 4) Call mip_create_and_import_flow. For auth, 7/7 real examples use soapAuthenticationAllowDefaultBasicCredentials:true."
  ]
};

// English is the source language, so 'en' is a zero-work fast path (no clone,
// no catalog read). Any other locale gets the prose leaves overlaid; literal
// flow data carries no catalog key and is therefore never touched.
export const MIP_FLOW_SCHEMA =
  LANG === "en" ? KB : applyKbOverlay(KB, loadCatalog(LANG, "kb"));

// ─── Flow Validation ──────────────────────────────────────────────────────────
// mip_create_and_import_flow oncesi, deploy'da patlayan yaygin hatalari yakalar.
// Ozellikle karmasik akislarda (birden fazla processCondition, error subflow)
// edge/condition wiring hatalarini import'tan ONCE tespit eder.
// Donen: { errors: string[], warnings: string[] }
export function validateFlow(flowData) {
  const errors = [];
  const warnings = [];

  // flowData string olabilir — parse et
  let data = flowData;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (e) {
      return { errors: [t("validate.parseFailed", { detail: e.message }, "flowData could not be parsed as JSON: {detail}")], warnings: [] };
    }
  }
  if (!Array.isArray(data)) {
    return { errors: [t("validate.notArray", null, "flowData must be an array (a list of nodes + edges).")], warnings: [] };
  }

  const nodes = data.filter(x => x && x.data && x.data.objectType);
  const edges = data.filter(x => x && x.source && x.target && !(x.data && x.data.objectType));
  const nodeIds = new Set(nodes.map(n => n.id));

  // E5 — benzersiz node id
  const seen = new Set();
  for (const n of nodes) {
    if (seen.has(n.id)) errors.push(t("validate.E5", { id: n.id }, "E5 Duplicate node id: '{id}'."));
    seen.add(n.id);
  }

  // E6 — en az bir processStart
  const startCount = nodes.filter(n => n.data.objectType === "processStart").length;
  if (startCount < 1) errors.push(t("validate.E6", null, "E6 A flow must contain at least one processStart node."));

  // E4 — yetim edge (source/target var olmayan node'a isaret ediyor)
  for (const e of edges) {
    if (!nodeIds.has(e.source)) errors.push(t("validate.E4source", { edge: `${e.id || e.source + "->" + e.target}`, node: e.source }, "E4 Edge '{edge}' points at a source node that does not exist: '{node}'."));
    if (!nodeIds.has(e.target)) errors.push(t("validate.E4target", { edge: `${e.id || e.source + "->" + e.target}`, node: e.target }, "E4 Edge '{edge}' points at a target node that does not exist: '{node}'."));
    // W2 — buttonedge onerisi
    if (e.type !== "buttonedge") warnings.push(t("validate.W2", { edge: `${e.id || e.source + "->" + e.target}` }, "W2 Edge '{edge}' does not carry type:'buttonedge' (not canonical)."));
  }

  // Condition node'lari
  const condNodes = nodes.filter(n => n.data.objectType === "processCondition");
  const condEdgesBySource = {};
  for (const e of edges.filter(e => e.conditionId)) {
    (condEdgesBySource[e.source] = condEdgesBySource[e.source] || []).push(e);
  }

  for (const c of condNodes) {
    const rows = (((c.data.connectorData || {}).ConditionState || {}).conditionsRows) || [];
    if (rows.length === 0) { errors.push(t("validate.E1empty", { id: c.id }, "E1 processCondition '{id}' is empty — it has no conditionsRow at all.")); continue; }

    // E1 — en fazla 1 default (ERROR). Default YOKLUGU deploy'u bozmaz (gercek
    // prod flow'larda default'suz condition'lar var — eslesmeyen mesaj duser) →
    // sadece W5 uyarisi.
    const defaults = rows.filter(r => r.isDefaultCondition === true);
    if (defaults.length === 0) warnings.push(t("validate.W5", { id: c.id }, "W5 processCondition '{id}' has no default branch (isDefaultCondition:true) — a message matching no condition is silently dropped. Add a default branch unless that is deliberate."));
    if (defaults.length > 1)  errors.push(t("validate.E1multi", { id: c.id, count: defaults.length }, "E1 processCondition '{id}' contains {count} default branches — there must be exactly 1."));

    // W4 — tekrar eden conditionName
    const names = {};
    for (const r of rows) names[r.conditionName] = (names[r.conditionName] || 0) + 1;
    Object.entries(names).filter(([, v]) => v > 1).forEach(([k]) => warnings.push(t("validate.W4", { id: c.id, name: k }, "W4 The conditionName '{name}' appears more than once inside processCondition '{id}'.")));

    const outEdges = condEdgesBySource[c.id] || [];
    const rowEdgeIds = new Set(rows.map(r => r.edgeId));
    const edgeCondIds = new Set(outEdges.map(e => e.conditionId));

    // E2 — her row icin eslesen edge
    for (const r of rows) {
      if (!edgeCondIds.has(r.edgeId)) {
        errors.push(t("validate.E2", { id: c.id, branch: r.conditionName, edgeId: r.edgeId }, "E2 No matching conditionEdge for branch '{branch}' (edgeId '{edgeId}') of processCondition '{id}'. Add an edge: { type:'buttonedge', source:'{id}', target:'<target>', conditionId:'{edgeId}', label:'{branch}' }."));
      }
      // W1 — expression quoting
      if (r.conditionType === "Expression" && r.conditionValue && /==\s*[A-Za-z_][A-Za-z0-9_]*\s*$/.test(r.conditionValue)) {
        warnings.push(t("validate.W1", { id: c.id, branch: r.conditionName, value: r.conditionValue.split("==").pop().trim() }, "W1 processCondition '{id}' branch '{branch}': a string literal must be inside single quotes (e.g. == '{value}')."));
      }
    }
    // E3 — yetim condition edge
    for (const e of outEdges) {
      if (!rowEdgeIds.has(e.conditionId)) {
        errors.push(t("validate.E3orphan", { id: c.id, conditionId: e.conditionId }, "E3 An edge with conditionId '{conditionId}' leaves processCondition '{id}', but conditionsRows has no such edgeId (orphan branch edge)."));
      }
      // W3 icin: condition edge'de sourceHandle olmamali (bilgi amacli, sessiz)
    }
  }

  // E3 (ek) — condition edge kaynagi processCondition olmayan node ise
  for (const e of edges.filter(e => e.conditionId)) {
    const src = nodes.find(n => n.id === e.source);
    if (src && src.data.objectType !== "processCondition") {
      errors.push(t("validate.E3source", { edge: e.id, objectType: src.data.objectType }, "E3 The source of edge '{edge}' (which has a conditionId) is not a processCondition ('{objectType}'). Only processCondition outputs carry a conditionId."));
    }
  }

  // W3 — normal edge'de sourceHandle onerisi (processCondition disi node'lardan)
  for (const e of edges.filter(e => !e.conditionId)) {
    const src = nodes.find(n => n.id === e.source);
    if (src && src.data.objectType !== "processCondition" && !e.sourceHandle) {
      warnings.push(t("validate.W3", { edge: `${e.id || e.source + "->" + e.target}` }, "W3 Edge '{edge}' is a normal output but has no sourceHandle:'normal-source'."));
    }
  }

  // E7 — error subflow cocuklari parentNode ile bagli mi
  const errContainers = nodes.filter(n => n.data.objectType === "processErrorSubflow");
  for (const cont of errContainers) {
    const children = nodes.filter(n => n.parentNode === cont.id);
    const hasStart = children.some(n => n.data.objectType === "processStartError");
    const hasEnd = children.some(n => n.data.objectType === "processEndError");
    if (!hasStart) errors.push(t("validate.E7start", { id: cont.id }, "E7 No processStartError attached via parentNode for processErrorSubflow '{id}'."));
    if (!hasEnd) errors.push(t("validate.E7end", { id: cont.id }, "E7 No processEndError attached via parentNode for processErrorSubflow '{id}'."));
  }
  // parentNode'u var olmayan container'a isaret eden node
  for (const n of nodes.filter(x => x.parentNode)) {
    if (!nodeIds.has(n.parentNode)) errors.push(t("validate.E7parent", { id: n.id, parent: n.parentNode }, "E7 Node '{id}' has parentNode:'{parent}', which points at a node that does not exist."));
  }

  // W6 — taninmayan objectType (yazim hatasi / desteklenmeyen yeni node yakalama)
  const knownTypes = new Set(Object.keys(MIP_FLOW_SCHEMA.nodeTypes).filter(k => k !== "conditionEdge"));
  for (const n of nodes) {
    if (!knownTypes.has(n.data.objectType)) {
      warnings.push(t("validate.W6", { id: n.id, objectType: n.data.objectType }, "W6 Node '{id}' has an unknown objectType:'{objectType}'. It may be a typo, or it is not defined in the KB (see nodeTypes)."));
    }
  }

  // W7 — graphical mapping node'u var ama esleme paketi bu flowData'da yok (flow-mappings
  // ayri tasinir). mip_create_and_import_flow flowMappings alaniyla bunu ayrica dogrular;
  // burada sadece hatirlatma: mappingName'e karsilik gelen bir flow-mapping import edilmeli.
  for (const n of nodes.filter(n => n.data.objectType === "processGraphicalMapping")) {
    const mn = (((n.data.connectorData || {}).GraphicalMappingState || {}).mappingName) || "";
    if (!mn) errors.push(t("validate.E8", { id: n.id }, "E8 GraphicalMappingState.mappingName on processGraphicalMapping '{id}' is EMPTY. Provide the name of the linked flow-mapping."));
    else warnings.push(t("validate.W7", { id: n.id, name: mn }, "W7 processGraphicalMapping '{id}' -> mappingName:'{name}'. A flow-mapping of that name (plus its source/target schema resources) must be included in the import package, otherwise the mapping stays empty. Use the flowMappings argument of mip_create_and_import_flow."));
  }

  return { errors, warnings };
}
