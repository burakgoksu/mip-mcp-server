import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { DOWNLOAD_DIR } from "../config.js";
import { saveFile, extractFilename, ensureDownloadDir } from "../util.js";
import { generateWsdl, ensureElementFormDefaultQualified } from "../wsdl.js";

const tools = [
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
];

const handlers = {
    // ── Resource (Groovy / XSLT) ─────────────────────────────────────────────
    mip_upload_resource: async (args, headers) => {
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
    },

    mip_reupload_resource: async (args, headers) => {
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
    },

    mip_list_resources: async (args, headers) => {
      // v1.16: /api/resources sayfali doner ({content}, varsayilan 25) — flowId filtresinin
      // dogru calismasi icin buyuk sayfa iste.
      const res = await axios.get(`${BASE_URL}/api/resources`, { headers, params: { paginationPage: 0, paginationSize: 5000 } });
      let resources = res.data?.content ?? res.data;
      if (args.flowId) {
        resources = resources.filter(r => r.flowId === args.flowId);
      }
      return JSON.stringify(resources, null, 2);
    },
    // ── WSDL (SOAP Sender icin) ──────────────────────────────────────────────
    mip_generate_wsdl: async (args, headers) => {
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
    },

    mip_upload_wsdl: async (args, headers) => {
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
    },
};

export default { tools, handlers };
