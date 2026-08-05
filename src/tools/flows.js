import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { DOWNLOAD_DIR } from "../config.js";
import { saveFile, extractFilename } from "../util.js";
import { MIP_FLOW_SCHEMA, validateFlow } from "../kb/flowSchema.js";

const tools = [
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
];

const handlers = {
    // ── Integration Flow ─────────────────────────────────────────────────────
    mip_export_packages_and_flows: async (args, headers) => {
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
    },

    mip_import_packages_and_flows: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw new Error(`Dosya bulunamadı: ${args.filePath}`);
      }
      const form = new FormData();
      form.append("filename", fs.createReadStream(args.filePath));
      const res = await axios.post(`${BASE_URL}/api/packages/flows/import`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return `Import tamamlandı: ${JSON.stringify(res.data)}`;
    },
    // ── Deploy / Undeploy / Log Level ────────────────────────────────────────
    mip_deploy_flow: async (args, headers) => {
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
    },

    mip_undeploy_flow: async (args, headers) => {
      const res = await axios.put(
        `${BASE_URL}/api/flows/${args.flowId}/undeploy`,
        null,
        { headers }
      );
      return `Flow undeploy edildi: ${JSON.stringify(res.data)}`;
    },

    mip_set_flow_log_level: async (args, headers) => {
      if (![1, 2].includes(args.logLevel)) {
        throw new Error("logLevel 1 (Only I/O Payload) veya 2 (All Steps) olmalıdır.");
      }
      const res = await axios.put(
        `${BASE_URL}/api/flows/${args.flowId}/update-log-level?logLevel=${args.logLevel}`,
        null,
        { headers }
      );
      return `Log seviyesi güncellendi: ${JSON.stringify(res.data)}`;
    },
    // ── Flow Schema & Builder ────────────────────────────────────────────────
    mip_get_flow_schema: async (args, headers) => {
      const section = args.section ?? "all";
      if (section === "all") return JSON.stringify(MIP_FLOW_SCHEMA, null, 2);
      if (MIP_FLOW_SCHEMA[section]) return JSON.stringify(MIP_FLOW_SCHEMA[section], null, 2);
      return JSON.stringify({ error: `Bilinmeyen bölüm: ${section}. Geçerli değerler: ${Object.keys(MIP_FLOW_SCHEMA).join(", ")}` });
    },

    mip_create_and_import_flow: async (args, headers) => {
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
    },
};

export default { tools, handlers };
