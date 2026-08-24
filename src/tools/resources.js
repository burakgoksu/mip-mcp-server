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
    description: "Uploads Groovy script (.groovy), XSLT (.xsl/.xslt), XSD (.xsd) or WSDL (.wsdl) resource files to MIP. Used by processScript / processXSLTMapping / processStart (SOAP) nodes. elementFormDefault='qualified' is mandatory when uploading a WSDL — prefer mip_upload_wsdl for hand-crafted WSDLs (it validates and injects it automatically).",
    inputSchema: {
      type: "object",
      properties: {
        filePath:     { type: "string", description: "Full path of the file to upload (.groovy / .xsl / .xslt / .xsd / .wsdl)" },
        flowId:       { type: "string", description: "ID of the flow the resource will be attached to (e.g. F_WEATHER_MCP)" },
        resourceName: { type: "string", description: "Resource name as it will appear in MIP (e.g. weather_process.groovy, EchoService.wsdl)" },
        resourceType: { type: "string", description: "Resource type: 'groovy' | 'xsl' | 'xslt' | 'xsd' | 'wsdl'" },
      },
      required: ["filePath", "flowId", "resourceName", "resourceType"],
    },
  },
  {
    name: "mip_reupload_resource",
    description: "Updates an existing Groovy or XSLT resource file in MIP.",
    inputSchema: {
      type: "object",
      properties: {
        id:           { type: "number", description: "ID of the resource to update" },
        filePath:     { type: "string", description: "Full path of the new file" },
        resourceName: { type: "string", description: "New resource name (optional)" },
      },
      required: ["id", "filePath"],
    },
  },
  {
    name: "mip_list_resources",
    description: "Lists every resource in MIP. Used to view Groovy / XSLT / XSD / WSDL files.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "Filter to the resources belonging to a specific flow (optional)" },
      },
      required: [],
    },
  },
  // ── WSDL (SOAP Sender icin) ──
  {
    name: "mip_generate_wsdl",
    description: `Generates a MIP-compatible WSDL file and saves it to disk. The generated WSDL comes with elementFormDefault="qualified" baked in automatically (a hard requirement of MIP).
Typical use: creating a new endpoint contract for a SOAP Start (Sender) adapter. The generated file is saved under MIP_DOWNLOAD_DIR; optionally it can be uploaded to the flow in the same call (uploadAfter:true).
Operation definitions: a request/response field list must be given for each operation. If a field type value is written without the xsd: prefix, xsd: is added automatically (string, int, long, decimal, boolean, dateTime, date, base64Binary).`,
    inputSchema: {
      type: "object",
      properties: {
        serviceName:     { type: "string", description: "WSDL service name (e.g. EchoService). Binding/PortType/Service names are derived from it." },
        targetNamespace: { type: "string", description: "WSDL targetNamespace (e.g. http://mdpgroup.com/mip/echo)" },
        serviceAddress:  { type: "string", description: "soap:address location value (optional, default: http://localhost/soap/<serviceName>)" },
        operations: {
          type: "array",
          description: "Operation list. Each operation: { name, soapAction?, request:{fields:[{name,type,minOccurs?,maxOccurs?}]}, response:{fields:[...]} }",
          items: {
            type: "object",
            properties: {
              name:       { type: "string", description: "Operation name (e.g. Echo, GetOrder)" },
              soapAction: { type: "string", description: "SOAPAction header (optional, default: <targetNamespace>/<name>)" },
              request:  { type: "object", description: "Request element definition: { fields: [{name, type, minOccurs?, maxOccurs?}] }" },
              response: { type: "object", description: "Response element definition: { fields: [{name, type, minOccurs?, maxOccurs?}] }" },
            },
            required: ["name"],
          },
        },
        resourceName: { type: "string", description: "File name as it will appear in MIP. Default: <serviceName>.wsdl" },
        outputPath:   { type: "string", description: "Full file path to save to (optional, default MIP_DOWNLOAD_DIR/<resourceName>)" },
        uploadAfter:  { type: "boolean", description: "If true, the WSDL is uploaded straight to flowId after being generated (default: false)" },
        flowId:       { type: "string", description: "Flow ID to upload to when uploadAfter=true" },
      },
      required: ["serviceName", "targetNamespace", "operations"],
    },
  },
  {
    name: "mip_upload_wsdl",
    description: `Uploads a WSDL file to MIP as a SOAP Start (Sender) resource. Before uploading it verifies that every <xs:schema> / <xsd:schema> element in the file has elementFormDefault="qualified"; it injects the attribute automatically if missing, and replaces "unqualified" with "qualified". The corrected file is written under MIP_DOWNLOAD_DIR and then sent to MIP. The difference from mip_upload_resource: this performs WSDL-specific validation and auto-fixing.`,
    inputSchema: {
      type: "object",
      properties: {
        filePath:     { type: "string", description: "Full path of the WSDL file to upload" },
        flowId:       { type: "string", description: "ID of the flow the resource will be attached to (e.g. F_SOAP_INBOUND)" },
        resourceName: { type: "string", description: "File name as it will appear in MIP (e.g. EchoService.wsdl). The file name is used if omitted." },
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
