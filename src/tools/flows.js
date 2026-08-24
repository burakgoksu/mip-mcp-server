import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { DOWNLOAD_DIR } from "../config.js";
import { saveFile, extractFilename } from "../util.js";
import { MIP_FLOW_SCHEMA, validateFlow } from "../kb/flowSchema.js";
import { buildFlowMapping, inferType, inferDataFormat, normalizeNodeIds, normalizeNodeLabels } from "../graphicalMapping.js";

const tools = [
  // ── Integration Flow ──
  {
    name: "mip_export_packages_and_flows",
    description: "Exports the given package and flow IDs as a zip.",
    inputSchema: {
      type: "object",
      properties: {
        packageIds: {
          type: "array",
          items: { type: "string" },
          description: "List of package IDs to export (null = all packages)",
        },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "List of flow IDs to export (empty = all flows)",
        },
      },
      required: [],
    },
  },
  {
    name: "mip_import_packages_and_flows",
    description: "Imports packages and flows from a previously exported zip file.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full path of the zip file to import" },
      },
      required: ["filePath"],
    },
  },
  // ── Deploy / Undeploy / Log Level ──
  {
    name: "mip_deploy_flow",
    description: "Deploys the given flow. It does not run automatically after an import — it deploys only when explicitly called.",
    inputSchema: {
      type: "object",
      properties: {
        flowId:  { type: "string", description: "ID of the flow to deploy (e.g. F_WEATHER_MCP)" },
        version: { type: "number", description: "Version number to deploy. If omitted, the latest existing version is used automatically." },
      },
      required: ["flowId"],
    },
  },

  {
    name: "mip_undeploy_flow",
    description: "Undeploys (stops) the given flow.",
    inputSchema: {
      type: "object",
      properties: {
        flowId: { type: "string", description: "ID of the flow to undeploy" },
      },
      required: ["flowId"],
    },
  },
  {
    name: "mip_set_flow_log_level",
    description: "Changes the log level of a deployed flow. Levels: 1=Only I/O Payload (default), 2=All Steps",
    inputSchema: {
      type: "object",
      properties: {
        flowId:   { type: "string", description: "ID of the flow whose log level is being changed" },
        logLevel: { type: "number", description: "Log level: 1=Only I/O Payload (default), 2=All Steps" },
      },
      required: ["flowId", "logLevel"],
    },
  },
  // ── Flow Schema & Builder ──
  {
    name: "mip_get_flow_schema",
    description: "Returns MIP flow, node, resource and package schema information. This tool must be called before creating a new flow. A comprehensive schema and template library built by analyzing 310+ real flows (including Kervan Prod). Before building a COMPLEX flow (multiple conditions, error subflow, split), always read the 'flowTemplates' and 'edgeSchema' sections.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description: "Fetch a specific section. Valid values: 'flowStructure' | 'nodeSchema' | 'edgeSchema' | 'nodeTypes' | 'expressionLanguage' | 'flowTemplates' | 'graphicalMapping' | 'validation' | 'importantNotes' | 'all' (default: 'all'). For condition/edge wiring: 'edgeSchema' + 'flowTemplates'. For graphical mapping: 'graphicalMapping'. To avoid deploy errors: 'validation'.",
          default: "all"
        }
      },
      required: []
    }
  },
  {
    name: "mip_create_and_import_flow",
    description: `Validates the given flow JSON definition and imports it into MIP. flowData is serialized automatically.

VALIDATION (v1.0.9): the flow is validated automatically BEFORE import. It catches the errors that blow up at deploy time: missing/incorrect condition branch edges (conditionId<->edgeId matching), a missing or duplicated default branch, orphan edges, duplicate node ids, a missing processStart, error subflow parentNode wiring. If there is an error the import is NOT performed and a corrective message is returned. For the correct structure, call mip_get_flow_schema('flowTemplates') first — it gives ready-made complete examples (conditionFlow, twoConditionsFlow, errorSubflowFragment).

PRECONDITION — when a processStart node in the flow has connectorType:"SOAP":
1) The WSDL must exist FIRST. If it does not, generate it with mip_generate_wsdl (you can upload it in the same call by passing uploadAfter:true + flowId), or use mip_upload_wsdl for an existing WSDL file.
2) Make sure the WSDL was uploaded to MIP with elementFormDefault="qualified" (mip_generate_wsdl bakes it in, mip_upload_wsdl auto-fixes it, mip_upload_resource does neither).
3) Match the THREE fields inside the SOAP Start node's connectorData (StartState) to the WSDL:
   - soapWSDLResource:  "<the resourceName you uploaded to MIP, e.g. EchoService.wsdl>"
   - soapWSDLBinding:   "<serviceName>Binding"   (the format mip_generate_wsdl produces)
   - soapWSDLOperation: "<operation name, e.g. Echo>"
The SOAP Start adapter will not work if these fields are empty or mismatched.

There is no such rule for other node types — SOAP Start (Sender) is the special case.`,
    inputSchema: {
      type: "object",
      properties: {
        flow: {
          type: "object",
          description: "Definition of the flow to create. The flowId, flowName, flowPackageId and flowData (array) fields are required."
        },
        resources: {
          type: "array",
          description: "(optional) Resource files to import alongside the flow (source/target schema xsd/xml/json for graphical mapping; also xslt/groovy/wsdl). Each one: { name, filePath, resourceType?, dataFormat? }. resourceType/dataFormat are inferred from the file extension when omitted.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Resource name in MIP (e.g. 'order.xsd')" },
              filePath: { type: "string", description: "Local file path (the content is embedded as base64)" },
              resourceType: { type: "string", description: "xsd|xml|json|xslt|groovy|wsdl (optional)" },
              dataFormat: { type: "string", description: "XML|JSON|NONE (optional)" }
            },
            required: ["name", "filePath"]
          }
        },
        flowMappings: {
          type: "array",
          description: "(optional, v1.16) Graphical mapping definitions for processGraphicalMapping nodes. Each one: { name (== the mappingName on the node), sourceSchema:{name,resourceType?}, targetSchema:{name,resourceType?}, links:[{sourcePath,targetPath}], functions:[...] }. sourcePath/targetPath = the full schema field path (e.g. 'Order/Header/MessageId'). links = one-to-one field mappings. functions = transformations (see below). The referenced schemas must be sent along via 'resources'. The same file name may be given for source and target schema (identity mapping).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              sourceSchema: { type: "object", description: "{ name, resourceType? }" },
              targetSchema: { type: "object", description: "{ name, resourceType? }" },
              links: { type: "array", description: "One-to-one field mappings", items: { type: "object", properties: { sourcePath: { type: "string" }, targetPath: { type: "string" }, targetIsArray: { type: "boolean" } }, required: ["sourcePath", "targetPath"] } },
              functions: {
                type: "array",
                description: "Functional transformations. type: CONSTANT|MULTIPLY|ADD|SUBTRACT|CONCAT|UPPER_CASE|LOWER_CASE|SUBSTRING|REPLACE|TRIM|TO_NUMBER|TO_STRING|IF_ELSE|DATE_FORMAT|... . Examples: constant -> {type:'CONSTANT', value:'123', target:'Root/MENGE'}; multiplication -> {type:'MULTIPLY', inputs:['Root/BNFPO'], constants:['3'], target:'Root/BNFPO'} (MULTIPLY multiplies its inputs, the constant 3 is fed in via constants); concatenation -> {type:'CONCAT', inputs:['Root/A','Root/B'], params:{addSpace:true}, target:'Root/Full'}. target=target field path; inputs=source field paths; constants=extra constant inputs; params=function-specific. Do NOT also put a target field produced by a function into links.",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", description: "Function type (CONSTANT/MULTIPLY/ADD/CONCAT/...)" },
                    target: { type: "string", description: "Target field path" },
                    value: { type: "string", description: "Constant value for CONSTANT" },
                    inputs: { type: "array", items: { type: "string" }, description: "Source field paths (function inputs)" },
                    constants: { type: "array", items: { type: "string" }, description: "Extra constant inputs (automatic CONSTANT node)" },
                    params: { type: "object", description: "Function-specific parameters" }
                  },
                  required: ["type", "target"]
                }
              },
              data: { type: "object", description: "raw {mappings,functions,transformations} (instead of links/functions, advanced use)" }
            },
            required: ["name", "sourceSchema", "targetSchema"]
          }
        },
        skipValidation: {
          type: "boolean",
          description: "If true, the pre-import flow validation (condition/edge/default checks) is skipped. Default false — normally DO NOT skip it."
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

      // DEPLOY-BREAKER FIX: MIP v1.16 deploy'u node id'lerinin 'dndnode_<sayi>' formatinda
      // olmasini ZORUNLU kilar ('start1' gibi id'ler -> bos-sebepli 500). Uygun olmayan
      // id'leri (ve tum edge/condition/parentNode referanslarini) otomatik normalize et.
      // Ayrica node isimlerini (data.label) objectType'in kanonik ismine sabitle —
      // MIP'te node ismi UI tarafindan dayatilir, ozel isim flow object'i bozar.
      if (Array.isArray(flowDef.flowData)) {
        flowDef.flowData = normalizeNodeIds(flowDef.flowData);
        flowDef.flowData = normalizeNodeLabels(flowDef.flowData);
      }

      // Graphical mapping tutarliligi: her processGraphicalMapping node'unun mappingName'i
      // icin flowMappings'te bir tanim olmali (deploy'da esleme bulunamamasini onler).
      const flowMappingsIn = Array.isArray(args.flowMappings) ? args.flowMappings : [];
      if (args.skipValidation !== true && Array.isArray(flowDef.flowData)) {
        const gmNames = flowDef.flowData
          .filter(n => n && n.data && n.data.objectType === "processGraphicalMapping")
          .map(n => (((n.data.connectorData || {}).GraphicalMappingState || {}).mappingName) || "");
        const provided = new Set(flowMappingsIn.map(m => m.name));
        const missing = [...new Set(gmNames)].filter(nm => nm && !provided.has(nm));
        if (missing.length) {
          throw new Error(
            "Graphical mapping HATASI — import edilmedi: su processGraphicalMapping mappingName'leri icin flowMappings tanimi verilmedi: " +
            missing.join(", ") + ". Her biri icin flowMappings'e { name, sourceSchema, targetSchema, links } ekle ve schema dosyalarini resources ile gonder. " +
            "(Kasitli atlamak icin skipValidation:true.)"
          );
        }
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

      // resources/: verilen schema/xslt/groovy/wsdl dosyalarini base64 gomerek paketle
      // (graphical mapping'in kaynak/hedef sema'lari da buradan gelir).
      const resourceObjs = [];
      for (const r of (Array.isArray(args.resources) ? args.resources : [])) {
        if (!r || !r.filePath) throw new Error("resources[].filePath zorunlu.");
        if (!fs.existsSync(r.filePath)) throw new Error(`resource dosyasi bulunamadi: ${r.filePath}`);
        const resourceType = r.resourceType || inferType(r.name || r.filePath);
        resourceObjs.push({
          resourceName: r.name || path.basename(r.filePath),
          flowId: flowDef.flowId,
          resourceType,
          version: 1,
          dataFormat: r.dataFormat || inferDataFormat(resourceType),
          resourceData: fs.readFileSync(r.filePath).toString("base64"),
        });
      }
      zip.folder("resources").file(`resources.${ts}.json`, JSON.stringify(resourceObjs));

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const zipPath = path.join(DOWNLOAD_DIR, `create-flow-${flowDef.flowId}-${ts}.zip`);
      fs.writeFileSync(zipPath, zipBuffer);

      const form = new FormData();
      form.append("filename", fs.createReadStream(zipPath));
      const res = await axios.post(`${BASE_URL}/api/packages/flows/import`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });

      // Graphical mapping: flow-mapping'ler zip ile DEGIL, import SONRASI POST /api/flow-mappings
      // ile olusturulur — cunku her mapping schema resource ID'lerine ihtiyac duyar ve bu ID'ler
      // ancak resources import edildikten sonra atanir (zip icinde ID null olur -> 409).
      let mappingMsg = "";
      if (flowMappingsIn.length) {
        const rres = await axios.get(`${BASE_URL}/api/resources`, { headers, params: { paginationPage: 0, paginationSize: 5000 } });
        const rdata = rres.data;
        const rlist = (Array.isArray(rdata) ? rdata : (rdata.content || [])).filter(r => r.flowId === flowDef.flowId);
        const ridByName = {};
        for (const r of rlist) ridByName[r.resourceName] = r.id;
        const created = [];
        for (const m of flowMappingsIn) {
          const fm = buildFlowMapping({ ...m, flowId: flowDef.flowId });
          const sid = ridByName[fm.sourceSchemaResource.name];
          const tid = ridByName[fm.targetSchemaResource.name];
          if (sid == null) throw new Error(`flowMapping '${fm.name}': kaynak schema resource '${fm.sourceSchemaResource.name}' import edilen resource'lar arasinda yok. 'resources' ile gonderdiginden emin ol.`);
          if (tid == null) throw new Error(`flowMapping '${fm.name}': hedef schema resource '${fm.targetSchemaResource.name}' bulunamadi.`);
          fm.sourceSchemaResourceId = sid;
          fm.targetSchemaResourceId = tid;
          await axios.post(`${BASE_URL}/api/flow-mappings`, fm, { headers });
          created.push(`${fm.name} (src#${sid} -> tgt#${tid})`);
        }
        mappingMsg = `\nGraphical mapping(ler) olusturuldu: ${created.join(", ")}`;
      }

      return `Flow '${flowDef.flowId}' başarıyla oluşturuldu ve MIP'e import edildi.${mappingMsg}\nSonuç: ${JSON.stringify(res.data)}`;
    },
};

export default { tools, handlers };
