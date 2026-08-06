// ─── MIP Flow Schema Knowledge Base ──────────────────────────────────────────
// 310 gerçek flow analiz edilerek oluşturulmuştur. 55 node tipi, tüm alanlar.
export const MIP_FLOW_SCHEMA = {
  description: "MIP Integration Platform — Flow, Resource ve Package şema bilgisi. 310+ gerçek flow (Kervan Prod + 140 v1.16 ornek flow) analiz edilerek olusturuldu. Karmasik akislarda (birden fazla processCondition, error subflow, split/multicast) DOGRU edge/condition wiring icin flowTemplates, edgeSchema.conditionEdge ve validation bolumlerine bak. v1.16 YENI: processGraphicalMapping/processMCP/processXIProxy node'lari, SAPXI start ve gorsel esleme icin graphicalMapping bolumu. KRITIK DUZELTME: condition edge'ler sourceHandle:'normal-source' DE tasir.",

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
    critical: "KRITIK — 310+ gercek flow analizi: MIP export'undaki TUM edge'ler type:'buttonedge' tasir. Eski KB'deki 'style' objesi (strokeWidth/zIndex) GERCEK FLOW'LARDA YOKTUR — edge'e style YAZMA. Iki edge sekli vardir: (1) normal edge, (2) condition edge. Ikisi de type:'buttonedge', height:0, width:0, processSteps:[] tasir; farklari asagida.",
    normalEdge: {
      description: "processCondition DISINDAKI her baglanti. Kaynak node'un cikisindan hedefe.",
      fields: {
        id: "reactflow__edge-<sourceId><sourceHandle>-<targetId>  (sourceHandle 'normal-source' ise id'ye de gomulur: 'reactflow__edge-<sourceId>normal-source-<targetId>')",
        type: "'buttonedge' (SABIT)",
        source: "kaynak node id",
        target: "hedef node id",
        sourceHandle: "'normal-source' — TUM edge'lerde bulunur (normal cikislar VE v1.16'da condition edge'ler de). Condition edge'i ayrica conditionId+label tasir.",
        height: 0, width: 0, processSteps: []
      },
      example: { id: "reactflow__edge-nodeAnormal-source-nodeB", type: "buttonedge", source: "nodeA", target: "nodeB", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] }
    },
    conditionEdge: {
      description: "processCondition node'undan cikan her dal. KRITIK: bu edge'i ELLE yazmak ZORUNLU — 'otomatik olusmaz'. Her conditionsRow icin birebir bir conditionEdge olmali.",
      fields: {
        id: "reactflow__edge-<sourceId>normal-source-<targetId>",
        type: "'buttonedge' (SABIT)",
        source: "processCondition node id",
        target: "dalin gittigi hedef node id",
        sourceHandle: "'normal-source' — v1.16 GERCEK flow'larda condition edge'ler DE bu handle'i tasir (normal edge ile ayni). ESKI KB'de 'yazilmaz' deniyordu, YANLIS. conditionId+label ile BIRLIKTE bulunur.",
        conditionId: "'<sourceId>--<targetId>' (CIFT tire). Node'daki conditionsRows[].edgeId ile BIREBIR AYNI olmali — eslesmezse dal baglanmaz, deploy patlar.",
        label: "conditionsRows[].conditionName ile ayni (orn 'OK','ERR','default')",
        height: 0, width: 0, processSteps: []
      },
      note: "CONDITION EDGE = NORMAL EDGE + conditionId + label. Yani sourceHandle:'normal-source' DE bulunur (v1.16 export'larinda 84/84 boyle). Onceki KB 'sourceHandle yazilmaz' diyordu; bu duzeltildi.",
      example: { id: "reactflow__edge-condAnormal-source-targetB", type: "buttonedge", source: "condA", target: "targetB", sourceHandle: "normal-source", conditionId: "condA--targetB", label: "OK", height: 0, width: 0, processSteps: [] }
    }
  },

  nodeTypes: {
    processStart: {
      description: "Her flow'un tek zorunlu giris noktasi. connectorType ile trigger tipi belirlenir.",
      required: true,
      connectorDataKey: "StartState",
      commonFields: { connectorType: "REST|SOAP|File|SFTP|JMS|JDBC|Timer|OData|OFTP2|MQTT|Mail|Direct|RabbitMQ|Solace|Kafka|Opcua|AS2|AWSSimpleQueue|SAPXI", isSyncEndpoint: true, concurrentConsumers: 1, addSearchterm: false, httpsEnable: false, isIdempotentActive: false, fileMaxSize: "10000" },
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
        AWSSimpleQueue: { awsCredential: "credential-ref", awsCron: "0 0/1 * * * ?", bucketName: "opsiyonel", objectKey: "opsiyonel" },
        SAPXI: { note: "SAP XI/PI Proxy SENDER (v1.16). SAP'tan MIP'e XI/PI proxy mesaji alir. Gonderen tarafi processXIProxy node'udur (bkz. nodeTypes.processXIProxy); XI System/PO baglantisi Operations>Sap-Connections>XI Proxy'de tanimli olmali (mip_*_xi_system / mip_*_po_connection). SOAP/REST auth alanlari BASIC ile gelir (soapAuthenticationType:'BASIC', restAuthenticationType:'BASIC').", soapAuthenticationType: "BASIC", restAuthenticationType: "BASIC", fileCharset: "UTF-8" }
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
    processCondition: {
      description: "Kosullu dallanma (Camel Content-Based Router). Her conditionsRow bir cikis dalini tanimlar VE her dal icin edgeSchema.conditionEdge tipinde bir edge ELLE yazilmali. connectorData sadece ConditionState.conditionsRows icerir.",
      connectorDataKey: "ConditionState",
      rules: [
        "ZORUNLU DEFAULT: Her processCondition'da TAM BIR satir isDefaultCondition:true olmali. Default satirda conditionType:'' ve conditionValue:'' (BOS). Default yoksa eslesmeyen mesaj kaybolur ve flow deploy/calisma hatasi verir.",
        "EDGE SEKLI (v1.16): condition edge = normal edge + conditionId + label. Yani sourceHandle:'normal-source' DE tasir (id de 'reactflow__edge-<cond>normal-source-<hedef>'). Onceki KB 'sourceHandle yazilmaz' diyordu, DUZELTILDI — 84/84 gercek export'ta sourceHandle var.",
        "EDGE ESLESMESI: conditionsRows[].edgeId, o dala karsilik gelen conditionEdge'in conditionId'si ile BIREBIR ayni olmali. Format: '<conditionNodeId>--<hedefNodeId>' (cift tire).",
        "HER SATIR = HER EDGE: N conditionsRow varsa N adet conditionEdge olmali. Eksik/fazla edge deploy'u bozar.",
        "EXPRESSION QUOTING: conditionType:'Expression' iken string sabitler TEK TIRNAK icinde: \"${exchangeProperty.rootName} == 'OK'\". Tirnaksiz yazim (== OK) Camel Simple'da patlar. Sayisal karsilastirma tirnaksiz: \"${exchangeProperty.count} > 0\".",
        "SIRALAMA: MIP dallari yukaridan asagi degerlendirir; ilk eslesen dala gider. Default satir en sona konur (gercek flow'larda hem basta hem sonda gorulur ama sona koymak en guvenlisi)."
      ],
      fields: { conditionsRows: [{ edgeId: "<conditionNodeId>--<hedefNodeId>", conditionName: "dal-adi (edge.label ile ayni)", conditionType: "Expression|XPath|JSONPath ('' = default satir)", conditionValue: "${exchangeProperty.status} == 'OK' | XPath | '' (default satir)", isDefaultCondition: false }], nodeId: "opsiyonel" },
      realExample: {
        desc: "GERCEK 4-dalli condition (F_KERVANGIDA_UK_STOCK_ADJS): rootName property'sine gore ERR/FATAL/OK/default. Node + 4 edge birlikte.",
        conditionNode: { id: "condA", type: "special", data: { objectType: "processCondition", label: "Route", connectorData: { ConditionState: { conditionsRows: [
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
      twoConditionNote: "IKI AYRI condition node ard arda kullanilabilir (gercek flow'larda yaygin: once 'Route' sonra 'SAP gate'). Her biri BAGIMSIZ bir node + kendi edge setine sahip. Ikinci condition'in girisine, birinci condition'in bir dalindan normalEdge ile gelinir. Hata belirtisi 'iki condition kullanamadim' -> genellikle ikinci condition'in edge conditionId eslesmesi veya default dali eksikti."
    },
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
    processErrorSubflow: {
      description: "Flow'a hata yonetimi (Camel onException/doTry benzeri) ekler. processStartError + processEndError ile birlikte UC'lu bir grup olusturur. connectorData YOK.",
      connectorDataKey: null,
      structure: [
        "CONTAINER: processErrorSubflow node'u type:'error' (dikkat: digerleri gibi 'special' DEGIL). Kendi position'u var, connectorData yok.",
        "COCUKLAR: processStartError ve processEndError node'lari container'in COCUGUDUR — her ikisinde parentNode:'<container id>' ve extent:'parent' bulunur, position container'a GORECELIdir.",
        "ID KONVANSIYONU (gercek flow'larda): StartError id = <containerId>+'0', EndError id = <containerId>+'1'. Zorunlu degil ama MIP UI boyle uretir.",
        "AKIS: processStartError -> (hata isleyen node'lar: script/mail/setContext...) -> processEndError. Bu ic node'lar da parentNode:'<containerId>', extent:'parent' tasir. Baglantilar normalEdge (buttonedge + sourceHandle:'normal-source').",
        "Ana flow ile edge ile BAGLANMAZ — MIP hata olunca otomatik bu subflow'a yonlendirir."
      ],
      realExample: {
        container: { id: "err1", type: "error", data: { objectType: "processErrorSubflow", label: "Error Handling", connectorData: null }, position: { x: 1400, y: 400 }, height: 200, width: 1300, processSteps: [] },
        startError: { id: "err10", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processStartError", label: "Start Error" }, position: { x: 20, y: 40 }, height: 40, width: 160, processSteps: [] },
        endError: { id: "err11", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processEndError", label: "End Error" }, position: { x: 1230, y: 42 }, height: 40, width: 160, processSteps: [] }
      }
    },
    processStartError: { description: "Hata akisinin baslangici. type:'special', parentNode:'<processErrorSubflow container id>', extent:'parent'. connectorData yok. Bkz. processErrorSubflow.structure.", connectorDataKey: null, fields: {} },
    processEndError: { description: "Hata akisinin sonu. type:'special', parentNode:'<processErrorSubflow container id>', extent:'parent'. connectorData yok.", connectorDataKey: null, fields: {} },
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
    processGraphicalMapping: {
      description: "(v1.16 YENI) Gorsel (drag-drop) alan eslemesi uygular — XSLT/Groovy yazmadan kaynak sema alanlarini hedef sema alanlarina baglar. Node connectorData'da SADECE mappingName tasir; asil esleme AYRI bir 'flow-mapping' nesnesinde durur (bkz. graphicalMapping bolumu). ONEMLI: mappingName == flow-mapping.name (ayni flowId altinda) BIREBIR eslesmeli; ayrica flow-mapping ve kaynak/hedef schema resource'lari import paketine dahil edilmeli yoksa deploy'da esleme bulunamaz.",
      connectorDataKey: "GraphicalMappingState",
      fields: { mappingName: "Bagli flow-mapping'in adi (orn 'MAPPING'). Ayni flowId'deki flow-mapping.name ile ayni olmali." },
      note: "XSLT (processXSLTMapping) ve Groovy (processScript) resource DOSYASINA (.xsl/.groovy) referans verir; graphical mapping ise resource degil, birinci-sinif flow-mapping nesnesine (name ile) referans verir. Uretim/import icin mip_create_and_import_flow'un flowMappings alanini kullan."
    },
    processMCP: {
      description: "(v1.16 YENI) MIP'in MCP CLIENT olarak baglandigi harici bir MCP server'in bir tool'unu cagirir. connectorData sadece cagrilacak tool adini tasir. Kullanilacak MCP server Operations>Destinations>MCP Servers'ta tanimli+SENKRONIZE olmali (mip_create_mcp_server + mip_sync_mcp_server); tool adi o server'in sundugu tool'lardan biri (mip_list_mcp_server_tools ile gorulur).",
      connectorDataKey: "MCPState",
      fields: { tool: "Cagrilacak MCP tool adi (orn 'echo', 'printEnv', 'list_allowed_directories'). MCP server'in expose ettigi tool'lardan biri." },
      note: "Bu, /api/mcp-servers (mip_*_mcp_server tool'lari) ile tanimli DIS MCP server'lara baglanir — bu projenin kendisi (mip-mcp-server) ile karistirma. Transport HTTP/SSE olmali (stdio/npx senkronize olmaz)."
    },
    processXIProxy: {
      description: "(v1.16 YENI) MIP'ten SAP'a XI/PI proxy mesaji GONDERIR (SAP XI proxy receiver). Karsi taraf (SAP'tan MIP'e) processStart connectorType:'SAPXI'dir. XI System / PO baglantisi Operations>Sap-Connections>XI Proxy'de tanimli olmali (mip_*_xi_system, mip_*_po_connection, mip_*_soa_connection) — takilan mesajlar mip_list_xi_queue_messages ile izlenir.",
      connectorDataKey: "XIProxyState",
      fields: { xiSystemName: "Hedef XI System adi (mip_list_xi_systems)", xiInterfaceName: "SAP interface adi (orn 'SI_CUSTOM_MODULE_INB_SYN')", xiNamespace: "Interface namespace (orn 'http://mdpgroup.com/...')", xiQos: "BestEffort|ExactlyOnce|ExactlyOnceInOrder", xiSenderService: "Gonderen servis adi (orn 'MIP')", xiInterfaceSource: "'catalog' (ESR katalogundan) veya 'wsdl' (yuklenmis WSDL)", xiCatalogConnectionId: "catalog kaynagi icin PO/SOA connection id (string)", xiWsdlResourceName: "wsdl kaynagi icin yuklenmis WSDL adi", xiTimeout: 60000, xiMaxRetries: 0, xiRetryDelay: 5000 }
    },
    conditionEdge: { description: "processCondition cikisindaki kosullu edge. Node DEGIL, edge tipidir ve ELLE YAZILMALI (otomatik olusmaz). Yapisi icin bkz. edgeSchema.conditionEdge. Her conditionsRow icin bir tane, sourceHandle:'normal-source'+conditionId+label tasir, conditionId=edgeId eslesmeli, ayrica bir default dali edge'i de bulunmali.", connectorDataKey: null }
  },


  expressionLanguage: {
    description: "MIP node'lari Apache Camel altyapisi kullanir. Alanlarda gecen ifadeler Camel Simple / XPath / JSONPath dilindedir.",
    simple: {
      property:  "${exchangeProperty.ad}  — processSetContext ile set edilen property'yi okur",
      header:    "${header.HeaderAdi}  — mesaj header'i",
      body:      "${body}  — mesaj govdesi",
      stringLiteral: "String sabit karsilastirmasi TEK TIRNAK ister: ${exchangeProperty.route} == 'OK'  (== OK YANLIS)",
      numeric:   "Sayisal karsilastirma tirnaksiz: ${exchangeProperty.count} > 0",
      combine:   "Mantiksal: ${exchangeProperty.a} == 'X' && ${header.b} == 'Y'",
      usedIn:    "processCondition.conditionValue (conditionType:'Expression'), processFilter, processSetContext (propertyType:'Expression'), processMail alanlari, processDirect, attachmentExpression"
    },
    xpath:   "conditionType/propertyType:'XPath' -> XML body uzerinde: /Root/Item/Status  veya  //status  veya  local-name(/*) (kok eleman adi).",
    jsonPath:"conditionType/propertyType:'JSONPath' -> JSON body uzerinde: $.field.subfield  veya  $.items[0].id",
    commonPattern: "TIPIK AKIS: processScript veya processSetContext ile body'den bir deger cikarilip exchangeProperty'ye yazilir (orn 'route'), sonra processCondition ${exchangeProperty.route}=='...' ile dallanir. Gercek flow'larda en yaygin desen budur — condition dogrudan body parse etmez, once property'ye alinir.",
    flowConfigurations: "GLOBAL/LOCAL FLOW CONFIG'LER: MIP'te 'Global Flow Configurations' (Operations menusu, mip_*_global_flow_config tool'lari) ve flow bazli 'Configure Flow' ile tanimlanan config'ler, flow calisirken configKey adiyla EXCHANGE PROPERTY olarak sunulur. Groovy/Simple icinde okunur: Simple -> ${exchangeProperty.<configKey>} , Groovy script -> exchange.getProperty('<configKey>'); deger atamak/override etmek icin processSetContext (propertyName:'<configKey>') veya Groovy exchange.setProperty('<configKey>', deger) kullanilir. Ortamlar/flow'lar arasi degisen sabitleri (bayrak, esik, mail adresi vb.) HARDCODE ETME — config anahtarindan exchangeProperty olarak oku. configValue skaler veya JSON olabilir; JSON ise parse edilmis obje olarak gelir. Global config appliedGlobally ise tum flow'lara otomatik uygulanir; flow bazli deger override edilebilir veya flow'a ozel (local) config eklenebilir."
  },

  flowTemplates: {
    description: "Gercek Kervan Prod flow'larindan cikarilmis, dogrudan mip_create_and_import_flow'a verilebilecek TAM (node+edge) canonical sablonlar. Node id'leri ornek — kendi benzersiz id'lerinle degistir ama edge/conditionId eslesmelerini KORU.",

    linearFlow: {
      desc: "En basit akis: Start -> Script -> End. Normal edge yapisini gosterir.",
      flowData: [
        { id: "start1", type: "special", data: { objectType: "processStart", label: "Start", connectorData: { StartState: { connectorType: "REST", restAddress: "/ornek", restMethod: "POST", restAuthenticationAllowDefaultBasicCredentials: true, isSyncEndpoint: true } } }, position: { x: 0, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "script1", type: "special", data: { objectType: "processScript", label: "Transform", connectorData: { ScriptState: { scriptPath: "transform.groovy", logScriptPayload: true } } }, position: { x: 300, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "end1", type: "special", data: { objectType: "processEnd", label: "End", connectorData: null }, position: { x: 600, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-start1normal-source-script1", type: "buttonedge", source: "start1", target: "script1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-script1normal-source-end1", type: "buttonedge", source: "script1", target: "end1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] }
      ]
    },

    conditionFlow: {
      desc: "TEK condition, 3 dal (OK / ERR / default). Once SetContext ile 'route' property'si set edilir, sonra condition dallanir. KARMASIK FLOW'DA EN KRITIK SABLON — edgeId<->conditionId eslesmesine ve default dala dikkat.",
      flowData: [
        { id: "start1", type: "special", data: { objectType: "processStart", label: "Start", connectorData: { StartState: { connectorType: "REST", restAddress: "/route", restMethod: "POST", restAuthenticationAllowDefaultBasicCredentials: true, isSyncEndpoint: true } } }, position: { x: 0, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "set1", type: "special", data: { objectType: "processSetContext", label: "Set route", connectorData: { SetContextState: { useSimpleQuery: false, contextBody: "", headerRows: [], propertyRows: [{ id: 0, propertyName: "route", propertyType: "XPath", propertyValue: "/Result/Status" }] } } }, position: { x: 300, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "cond1", type: "special", data: { objectType: "processCondition", label: "Route", connectorData: { ConditionState: { conditionsRows: [
          { edgeId: "cond1--okEnd",  conditionName: "OK",      conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'OK'",  isDefaultCondition: false },
          { edgeId: "cond1--errEnd", conditionName: "ERR",     conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'ERR'", isDefaultCondition: false },
          { edgeId: "cond1--defEnd", conditionName: "default", conditionType: "",           conditionValue: "",                                   isDefaultCondition: true }
        ] } } }, position: { x: 600, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "okEnd",  type: "special", data: { objectType: "processEnd", label: "OK End",  connectorData: null }, position: { x: 900, y: 0 },   height: 40, width: 160, processSteps: [] },
        { id: "errEnd", type: "special", data: { objectType: "processEnd", label: "ERR End", connectorData: null }, position: { x: 900, y: 150 }, height: 40, width: 160, processSteps: [] },
        { id: "defEnd", type: "special", data: { objectType: "processEnd", label: "Def End", connectorData: null }, position: { x: 900, y: 300 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-start1normal-source-set1", type: "buttonedge", source: "start1", target: "set1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-set1normal-source-cond1", type: "buttonedge", source: "set1", target: "cond1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-okEnd",  type: "buttonedge", source: "cond1", target: "okEnd",  sourceHandle: "normal-source", conditionId: "cond1--okEnd",  label: "OK",      height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-errEnd", type: "buttonedge", source: "cond1", target: "errEnd", sourceHandle: "normal-source", conditionId: "cond1--errEnd", label: "ERR",     height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-defEnd", type: "buttonedge", source: "cond1", target: "defEnd", sourceHandle: "normal-source", conditionId: "cond1--defEnd", label: "default", height: 0, width: 0, processSteps: [] }
      ]
    },

    twoConditionsFlow: {
      desc: "IKI ard arda condition (kullanicinin takildigi senaryo). cond1 (OK/default) -> OK dalindan cond2'ye normalEdge; cond2 (SAP/default). Her condition BAGIMSIZ node + kendi edge seti. Ikinci condition'in default'u da ZORUNLU.",
      flowData: [
        { id: "start1", type: "special", data: { objectType: "processStart", label: "Start", connectorData: { StartState: { connectorType: "Timer", timerCron: "0 0/5 * 1/1 * ? *", isSyncEndpoint: false } } }, position: { x: 0, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "cond1", type: "special", data: { objectType: "processCondition", label: "Route1", connectorData: { ConditionState: { conditionsRows: [
          { edgeId: "cond1--proc1", conditionName: "OK",      conditionType: "Expression", conditionValue: "${exchangeProperty.route} == 'OK'", isDefaultCondition: false },
          { edgeId: "cond1--end1",  conditionName: "default", conditionType: "",           conditionValue: "",                                  isDefaultCondition: true }
        ] } } }, position: { x: 300, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "proc1", type: "special", data: { objectType: "processScript", label: "Process", connectorData: { ScriptState: { scriptPath: "process.groovy", logScriptPayload: true } } }, position: { x: 600, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "cond2", type: "special", data: { objectType: "processCondition", label: "SAP gate", connectorData: { ConditionState: { conditionsRows: [
          { edgeId: "cond2--sapErr", conditionName: "sapError", conditionType: "Expression", conditionValue: "${exchangeProperty.sapMail} == '1'", isDefaultCondition: false },
          { edgeId: "cond2--okEnd",  conditionName: "default",  conditionType: "",           conditionValue: "",                                    isDefaultCondition: true }
        ] } } }, position: { x: 900, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "sapErr", type: "special", data: { objectType: "processMail", label: "Notify", connectorData: { MailState: { from: "mip@ornek.com", to: "ops@ornek.com", subject: "SAP error", mailBody: "Hata: ${exchangeProperty.err}", bodyMimeType: "TEXT/Plain", bodyEncoding: "UTF-8", address: "smtp.ornek.com", port: 25, encryption: "STARTTLS", authentication: "LOGIN", credentialName: "smtp_cred", addAttachments: false, attachments: [] } } }, position: { x: 1200, y: 150 }, height: 40, width: 160, processSteps: [] },
        { id: "okEnd", type: "special", data: { objectType: "processEnd", label: "OK End",  connectorData: null }, position: { x: 1200, y: 0 }, height: 40, width: 160, processSteps: [] },
        { id: "end1",  type: "special", data: { objectType: "processEnd", label: "Skip End", connectorData: null }, position: { x: 600, y: 150 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-start1normal-source-cond1", type: "buttonedge", source: "start1", target: "cond1", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-proc1", type: "buttonedge", source: "cond1", target: "proc1", sourceHandle: "normal-source", conditionId: "cond1--proc1", label: "OK",      height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond1normal-source-end1",  type: "buttonedge", source: "cond1", target: "end1",  sourceHandle: "normal-source", conditionId: "cond1--end1",  label: "default", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-proc1normal-source-cond2", type: "buttonedge", source: "proc1", target: "cond2", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond2normal-source-sapErr", type: "buttonedge", source: "cond2", target: "sapErr", sourceHandle: "normal-source", conditionId: "cond2--sapErr", label: "sapError", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-cond2normal-source-okEnd",  type: "buttonedge", source: "cond2", target: "okEnd",  sourceHandle: "normal-source", conditionId: "cond2--okEnd",  label: "default",  height: 0, width: 0, processSteps: [] }
      ]
    },

    errorSubflowFragment: {
      desc: "Hata yonetimi grubu. Ana flow node'larina EK olarak eklenir; ana flow ile edge ile baglanmaz. Container type:'error', cocuklar parentNode+extent:'parent'.",
      flowData: [
        { id: "err1", type: "error", data: { objectType: "processErrorSubflow", label: "Error Handling", connectorData: null }, position: { x: 0, y: 400 }, height: 220, width: 700, processSteps: [] },
        { id: "err10", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processStartError", label: "Start Error", connectorData: null }, position: { x: 20, y: 40 }, height: 40, width: 160, processSteps: [] },
        { id: "errMail", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processMail", label: "Alert", connectorData: { MailState: { from: "mip@ornek.com", to: "ops@ornek.com", subject: "Flow error", mailBody: "Hata olustu", bodyMimeType: "TEXT/Plain", bodyEncoding: "UTF-8", address: "smtp.ornek.com", port: 25, encryption: "STARTTLS", authentication: "LOGIN", credentialName: "smtp_cred", addAttachments: false, attachments: [] } } }, position: { x: 250, y: 40 }, height: 40, width: 160, processSteps: [] },
        { id: "err11", type: "special", parentNode: "err1", extent: "parent", data: { objectType: "processEndError", label: "End Error", connectorData: null }, position: { x: 500, y: 40 }, height: 40, width: 160, processSteps: [] },
        { id: "reactflow__edge-err10normal-source-errMail", type: "buttonedge", source: "err10", target: "errMail", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] },
        { id: "reactflow__edge-errMailnormal-source-err11", type: "buttonedge", source: "errMail", target: "err11", sourceHandle: "normal-source", height: 0, width: 0, processSteps: [] }
      ]
    },

    directChaining: {
      desc: "Bir flow'u baska flow'a baglama (gercek Kervan pattern, 7 kullanim). processDirect'te directName + hedef flowId birlikte verilir. Hedef flow'da connectorType:'Direct' Start olmali.",
      note: "Gonderen: processDirect { DirectState: { directName: '/SalesOrderIdoc', flowId: 'F_HEDEF_FLOW_ID', isAsync: false } }. Alan: processStart { StartState: { connectorType: 'Direct', directName: '/SalesOrderIdoc' } }. directName iki tarafta AYNI olmali."
    }
  },

  graphicalMapping: {
    description: "(v1.16 YENI) Gorsel alan eslemesi (drag-drop mapping). XSLT/Groovy YAZMADAN kaynak sema alanlarini hedef sema alanlarina baglar. processXSLTMapping (.xsl dosyasi) veya processScript (.groovy dosyasi) RESOURCE'a referans verir; graphical mapping ise AYRI bir birinci-sinif 'flow-mapping' NESNESIDIR ve node ona name ile referans verir.",
    architecture: [
      "3 parca: (1) processGraphicalMapping node (connectorData: { GraphicalMappingState: { mappingName } }), (2) flow-mapping nesnesi (esleme grafi + kaynak/hedef sema referansi), (3) kaynak & hedef schema RESOURCE'lari (xsd/xml/json dosyalari).",
      "BAGLANTI: node.GraphicalMappingState.mappingName == flow-mapping.name (ayni flowId altinda). Ayni isimde flow-mapping yoksa deploy'da esleme bulunamaz.",
      "IMPORT: flow-mapping nesnesi export/import zip'inde 'flow-mappings/' klasorunde, schema dosyalari 'resources/' klasorunde tasinir. mip_create_and_import_flow'un flowMappings + resources alanlari bunlari paketler (aksi halde graphical mapping'li flow deploy olsa da esleme bos kalir)."
    ],
    flowMappingObject: {
      description: "flow-mappings/ altindaki her kayit. id/createdBy vb. audit alanlari server tarafinda atanir — gonderme.",
      shape: { name: "Esleme adi (node'daki mappingName ile ayni)", flowId: "Ait oldugu flow", version: 1, sourceSchemaResourceId: "server id — import'ta ISIM ile cozulur, elle verme", sourceSchemaResource: { name: "kaynak-sema-dosyasi.xsd", flowId: "F_...", resourceType: "xsd|xml|json" }, targetSchemaResourceId: "server id", targetSchemaResource: { name: "hedef-sema.json", flowId: "F_...", resourceType: "xsd|xml|json" }, data: "esleme grafi (asagida)" }
    },
    dataFormat: {
      description: "flow-mapping.data = { mappings:[...], transformations:[...] }. React-Flow benzeri gorsel graf.",
      mappings: "Her kaynak->hedef alan baglantisi: { id:'<srcPath>-source--<tgtPath>-target', type:'custom', source:'source-file', target:'target-file', selected:false, markerEnd:{type:'arrow'}, sourceHandle:'<srcPath>-source', targetHandle:'<tgtPath>-target', targetIsArray:false }. srcPath/tgtPath = sema icindeki alan yolu (orn 'Header/MessageId', 'TransformedPayload/customer/fullName').",
      transformations: "Her HEDEF alan icin bir donusum dugumu: { id:'<tgtPath>-target', edges:[{ id:'<srcPath>-source--<tgtPath>-target', source, target, markerEnd }], nodes:[ {id:'<srcPath>-source', type:'fieldNode', data:{label, connectorType:'source'}}, {id:'<tgtPath>-target', type:'fieldNode', data:{label, connectorType:'target'}} ] }. Basit 1:1 eslemede her hedef alan icin tek edge.",
      note: "1:1 alan eslemeleri icin mip_create_and_import_flow'a links:[{sourcePath,targetPath}] listesi verilir; MCP data.mappings + data.transformations'i otomatik uretir (concat gibi fonksiyonel donusumler icin ham data verilebilir)."
    }
  },

  validation: {
    description: "mip_create_and_import_flow bu kurallari import ONCESI otomatik kontrol eder ve ihlalde HATA firlatir (deploy'da patlamadan once yakalar). Flow uretirken bu kurallara uy.",
    errors: [
      "E1 processCondition node'unda EN FAZLA 1 adet isDefaultCondition:true satiri olabilir (>1 => hata). Default YOKLUGU hata degil, W5 uyarisidir (gercek prod flow'larda default'suz condition var).",
      "E2 Her conditionsRows[].edgeId icin, o condition node'undan cikan conditionId'si AYNI olan bir edge bulunmali (eksik dal edge'i). ASIL DEPLOY-BREAKER budur.",
      "E3 conditionId'si olan her edge, kaynak condition node'unun conditionsRows'unda edgeId olarak gecmeli (yetim condition edge).",
      "E4 Tum edge source/target degerleri var olan bir node id'sine isaret etmeli (yetim edge).",
      "E5 Node id'leri benzersiz olmali.",
      "E6 Flow'da tam olarak >=1 processStart olmali.",
      "E7 processErrorSubflow varsa, ic node'lari (StartError/EndError) parentNode ile ona bagli olmali.",
      "E8 processGraphicalMapping node'unda GraphicalMappingState.mappingName BOS olamaz (bagli flow-mapping adi)."
    ],
    warnings: [
      "W1 conditionType:'Expression' ve conditionValue string sabit iceriyorsa tek tirnak onerilir (== OK -> == 'OK').",
      "W2 Edge'lerde type:'buttonedge' yoksa uyari (MIP tolere edebilir ama canonical degil).",
      "W3 processCondition harici node'lardan cikan normal edge'de sourceHandle:'normal-source' onerilir.",
      "W4 Ayni conditionName bir condition node icinde birden fazla kez kullanilmis (belirsiz dal).",
      "W5 processCondition default dal icermiyor — eslesmeyen mesaj sessizce duser. Bilincli degilse default ekle.",
      "W6 Bilinmeyen objectType (KB nodeTypes'ta yok) — yazim hatasi veya desteklenmeyen node.",
      "W7 processGraphicalMapping var — mappingName'e karsilik gelen flow-mapping + schema resource'lari import paketine dahil edilmeli (mip_create_and_import_flow flowMappings alani)."
    ]
  },

  importantNotes: [
    "SAFETY / DANGER ZONES (read first): This MCP deliberately exposes NO tools for MIP's 'Database Management', 'DB Analysis & Backup' (backup/restore), or license write. These operations can cause IRREVERSIBLE damage on a live/customer MIP server. NEVER build, call, or probe: /api/database-management/*, /api/log-deletion*, /admin/backups, (/healthcheck-service)/admin/restore(/latest), /api/license/save. License is READ-ONLY (mip_get_license_detail / mip_check_license). — TR: Bu MCP; Database Management, DB Analysis & Backup ve lisans yazma icin BILEREK tool sunmaz; geri donulemez hasar riski. Bu endpoint'lere dokunma. Lisans yalnizca salt-okunur.",
    "id, createdDate, createdBy, lastModifiedDate, lastModifiedBy alanlarını yeni flow'larda EKLEME — MIP bunları otomatik atar.",
    "flowLocked: 0 olmalı (1 = kilitli flow, düzenlenemez).",
    "position değerleri UI'da düzgün görünüm için 300px aralıklı set edilmeli (x: 0, 300, 600, 900...).",
    "Paralel branch'lerde y koordinatı değiştirilmeli (üst: y:0, alt: y:150).",
    "KRITIK — EDGE TIPI: TUM edge'ler type:'buttonedge' tasir. Eski 'style' objesini (strokeWidth/zIndex) YAZMA — gercek flow'larda yok. TUM edge'lerde (normal VE condition) sourceHandle:'normal-source' bulunur (v1.16 duzeltmesi — eski KB 'condition edge'de yok' diyordu, YANLIS). Condition edge ek olarak conditionId+label tasir.",
    "KRITIK — CONDITION WIRING: processCondition dallari OTOMATIK olusmaz. Her conditionsRows satiri icin ELLE bir edge yaz: type:'buttonedge', sourceHandle:'normal-source', edge.conditionId = row.edgeId ('<condNodeId>--<hedefId>' cift tire) BIREBIR eslesmeli, edge.label = row.conditionName. Ayrica TAM 1 default satir (isDefaultCondition:true, conditionType:'', conditionValue:'') + onun edge'i ZORUNLU. Eksikse deploy patlar. Tam ornek: flowTemplates.conditionFlow ve twoConditionsFlow.",
    "KRITIK — CONDITION EXPRESSION: conditionValue string sabit karsilastirmasi tek tirnak ister: \"${exchangeProperty.route} == 'OK'\". Tirnaksiz (== OK) Camel'da patlar. Condition genelde body'yi degil, onceden processSetContext/processScript ile set edilmis exchangeProperty'yi okur.",
    "KRITIK — IKI CONDITION: Ard arda iki processCondition tamamen desteklenir; her biri BAGIMSIZ node + kendi edge seti + kendi default dali. Ikincinin girisine birincinin bir dalindan normalEdge ile gelinir. Bkz. flowTemplates.twoConditionsFlow.",
    "KRITIK — ERROR SUBFLOW: processErrorSubflow container type:'error' (special DEGIL); processStartError/processEndError ve ic node'lar parentNode:'<containerId>' + extent:'parent' tasir. Ana flow ile edge ile baglanmaz. Bkz. flowTemplates.errorSubflowFragment.",
    "v1.16 YENI NODE'LAR: processGraphicalMapping (gorsel esleme — flow-mapping nesnesine mappingName ile baglanir, bkz. graphicalMapping bolumu), processMCP (harici MCP server tool cagrisi — MCPState.tool; server /api/mcp-servers'ta senkronize olmali), processXIProxy (MIP->SAP XI/PI proxy gonderimi — XIProxyState; XI System/PO baglantisi Sap-Connections'ta tanimli olmali). processStart connectorType'a SAPXI (SAP->MIP XI proxy sender) eklendi.",
    "GRAPHICAL MAPPING deploy sarti: processGraphicalMapping kullanan flow'da mappingName ile ayni isimde bir flow-mapping VE kaynak/hedef schema resource'lari import paketine dahil edilmeli. mip_create_and_import_flow'un flowMappings + resources alanlarini kullan; aksi halde flow acilir ama esleme bos/deploy hatali olur.",
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
      return { errors: [`flowData JSON parse edilemedi: ${e.message}`], warnings: [] };
    }
  }
  if (!Array.isArray(data)) {
    return { errors: ["flowData bir array olmali (node + edge listesi)."], warnings: [] };
  }

  const nodes = data.filter(x => x && x.data && x.data.objectType);
  const edges = data.filter(x => x && x.source && x.target && !(x.data && x.data.objectType));
  const nodeIds = new Set(nodes.map(n => n.id));

  // E5 — benzersiz node id
  const seen = new Set();
  for (const n of nodes) {
    if (seen.has(n.id)) errors.push(`E5 Tekrar eden node id: '${n.id}'.`);
    seen.add(n.id);
  }

  // E6 — en az bir processStart
  const startCount = nodes.filter(n => n.data.objectType === "processStart").length;
  if (startCount < 1) errors.push("E6 Flow'da en az bir processStart node'u olmali.");

  // E4 — yetim edge (source/target var olmayan node'a isaret ediyor)
  for (const e of edges) {
    if (!nodeIds.has(e.source)) errors.push(`E4 Edge '${e.id || e.source + "->" + e.target}' var olmayan source node'a isaret ediyor: '${e.source}'.`);
    if (!nodeIds.has(e.target)) errors.push(`E4 Edge '${e.id || e.source + "->" + e.target}' var olmayan target node'a isaret ediyor: '${e.target}'.`);
    // W2 — buttonedge onerisi
    if (e.type !== "buttonedge") warnings.push(`W2 Edge '${e.id || e.source + "->" + e.target}' type:'buttonedge' tasimiyor (canonical degil).`);
  }

  // Condition node'lari
  const condNodes = nodes.filter(n => n.data.objectType === "processCondition");
  const condEdgesBySource = {};
  for (const e of edges.filter(e => e.conditionId)) {
    (condEdgesBySource[e.source] = condEdgesBySource[e.source] || []).push(e);
  }

  for (const c of condNodes) {
    const rows = (((c.data.connectorData || {}).ConditionState || {}).conditionsRows) || [];
    if (rows.length === 0) { errors.push(`E1 processCondition '${c.id}' bos — hic conditionsRow yok.`); continue; }

    // E1 — en fazla 1 default (ERROR). Default YOKLUGU deploy'u bozmaz (gercek
    // prod flow'larda default'suz condition'lar var — eslesmeyen mesaj duser) →
    // sadece W5 uyarisi.
    const defaults = rows.filter(r => r.isDefaultCondition === true);
    if (defaults.length === 0) warnings.push(`W5 processCondition '${c.id}' default dal (isDefaultCondition:true) icermiyor — hicbir kosula uymayan mesaj sessizce duser. Bilincli degilse bir default dal ekle.`);
    if (defaults.length > 1)  errors.push(`E1 processCondition '${c.id}' ${defaults.length} default dal iceriyor — sadece 1 olmali.`);

    // W4 — tekrar eden conditionName
    const names = {};
    for (const r of rows) names[r.conditionName] = (names[r.conditionName] || 0) + 1;
    Object.entries(names).filter(([, v]) => v > 1).forEach(([k]) => warnings.push(`W4 processCondition '${c.id}' icinde '${k}' conditionName'i birden fazla kez var.`));

    const outEdges = condEdgesBySource[c.id] || [];
    const rowEdgeIds = new Set(rows.map(r => r.edgeId));
    const edgeCondIds = new Set(outEdges.map(e => e.conditionId));

    // E2 — her row icin eslesen edge
    for (const r of rows) {
      if (!edgeCondIds.has(r.edgeId)) {
        errors.push(`E2 processCondition '${c.id}' dali '${r.conditionName}' (edgeId '${r.edgeId}') icin eslesen conditionEdge yok. Bir edge ekle: { type:'buttonedge', source:'${c.id}', target:'<hedef>', conditionId:'${r.edgeId}', label:'${r.conditionName}' }.`);
      }
      // W1 — expression quoting
      if (r.conditionType === "Expression" && r.conditionValue && /==\s*[A-Za-z_][A-Za-z0-9_]*\s*$/.test(r.conditionValue)) {
        warnings.push(`W1 processCondition '${c.id}' dali '${r.conditionName}': string sabit tek tirnak icinde olmali (orn: == '${r.conditionValue.split("==").pop().trim()}').`);
      }
    }
    // E3 — yetim condition edge
    for (const e of outEdges) {
      if (!rowEdgeIds.has(e.conditionId)) {
        errors.push(`E3 processCondition '${c.id}' cikisinda conditionId '${e.conditionId}' olan edge var ama conditionsRows'da boyle bir edgeId yok (yetim dal edge'i).`);
      }
      // W3 icin: condition edge'de sourceHandle olmamali (bilgi amacli, sessiz)
    }
  }

  // E3 (ek) — condition edge kaynagi processCondition olmayan node ise
  for (const e of edges.filter(e => e.conditionId)) {
    const src = nodes.find(n => n.id === e.source);
    if (src && src.data.objectType !== "processCondition") {
      errors.push(`E3 conditionId'li edge '${e.id}' kaynagi processCondition degil ('${src.data.objectType}'). Sadece processCondition cikislari conditionId tasir.`);
    }
  }

  // W3 — normal edge'de sourceHandle onerisi (processCondition disi node'lardan)
  for (const e of edges.filter(e => !e.conditionId)) {
    const src = nodes.find(n => n.id === e.source);
    if (src && src.data.objectType !== "processCondition" && !e.sourceHandle) {
      warnings.push(`W3 Edge '${e.id || e.source + "->" + e.target}' normal cikis ama sourceHandle:'normal-source' yok.`);
    }
  }

  // E7 — error subflow cocuklari parentNode ile bagli mi
  const errContainers = nodes.filter(n => n.data.objectType === "processErrorSubflow");
  for (const cont of errContainers) {
    const children = nodes.filter(n => n.parentNode === cont.id);
    const hasStart = children.some(n => n.data.objectType === "processStartError");
    const hasEnd = children.some(n => n.data.objectType === "processEndError");
    if (!hasStart) errors.push(`E7 processErrorSubflow '${cont.id}' icin parentNode ile bagli processStartError yok.`);
    if (!hasEnd) errors.push(`E7 processErrorSubflow '${cont.id}' icin parentNode ile bagli processEndError yok.`);
  }
  // parentNode'u var olmayan container'a isaret eden node
  for (const n of nodes.filter(x => x.parentNode)) {
    if (!nodeIds.has(n.parentNode)) errors.push(`E7 Node '${n.id}' parentNode:'${n.parentNode}' var olmayan bir node'a isaret ediyor.`);
  }

  // W6 — taninmayan objectType (yazim hatasi / desteklenmeyen yeni node yakalama)
  const knownTypes = new Set(Object.keys(MIP_FLOW_SCHEMA.nodeTypes).filter(k => k !== "conditionEdge"));
  for (const n of nodes) {
    if (!knownTypes.has(n.data.objectType)) {
      warnings.push(`W6 Node '${n.id}' bilinmeyen objectType:'${n.data.objectType}'. Yazim hatasi olabilir veya KB'de tanimli degil (nodeTypes'a bak).`);
    }
  }

  // W7 — graphical mapping node'u var ama esleme paketi bu flowData'da yok (flow-mappings
  // ayri tasinir). mip_create_and_import_flow flowMappings alaniyla bunu ayrica dogrular;
  // burada sadece hatirlatma: mappingName'e karsilik gelen bir flow-mapping import edilmeli.
  for (const n of nodes.filter(n => n.data.objectType === "processGraphicalMapping")) {
    const mn = (((n.data.connectorData || {}).GraphicalMappingState || {}).mappingName) || "";
    if (!mn) errors.push(`E8 processGraphicalMapping '${n.id}' GraphicalMappingState.mappingName BOS. Bagli flow-mapping adini ver.`);
    else warnings.push(`W7 processGraphicalMapping '${n.id}' -> mappingName:'${mn}'. Bu isimde bir flow-mapping (+ kaynak/hedef schema resource'lari) import paketine dahil edilmeli, yoksa esleme bos kalir. mip_create_and_import_flow flowMappings alanini kullan.`);
  }

  return { errors, warnings };
}
