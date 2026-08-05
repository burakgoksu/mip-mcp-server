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
