import axios from "axios";
import { BASE_URL } from "../config.js";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { DOWNLOAD_DIR } from "../config.js";
import { saveFile, extractFilename } from "../util.js";
import { MIP_FLOW_SCHEMA, validateFlow } from "../kb/flowSchema.js";
import { buildFlowMapping, inferType, inferDataFormat, normalizeNodeIds, normalizeNodeLabels } from "../graphicalMapping.js";
import { msg, err, t } from "../i18n/index.js";

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
          description: "List of package IDs to export. If omitted AND flowIds is also empty, ALL packages are exported. To get only specific flows, send an empty array [] (the tool does this automatically when flowIds is non-empty).",
        },
        flowIds: {
          type: "array",
          items: { type: "string" },
          description: "List of flow IDs to export. When non-empty, packageIds automatically becomes [], so ONLY these flows are returned.",
        },
      },
      required: [],
    },
  },
  {
    name: "mip_import_packages_and_flows",
    description: "Imports packages and flows from a previously exported zip file. WARNING: writes EVERY flow and package in the zip. If you are updating a single flow, make sure the zip contains only that flow (see flowIds + packageIds:[] on the export tool).",
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
        package: {
          type: "object",
          description: "(optional) Package-record fields for flow.flowPackageId. The package's REAL record is read from MIP first and these values are merged ON TOP of it field by field, so anything you omit keeps its real value and an existing package never loses its name, description or parent. Send only what you actually want to change. For a brand-new package, packageRootId is how you nest it under an existing one. If the real record cannot be read, NO package record is written at all (the existing one is left untouched) and these fields are not applied.",
          properties: {
            packageId: { type: "string", description: "Package id. Optional and redundant \u2014 if given it must equal flow.flowPackageId; it exists only so this object can be passed as a complete record." },
            packageName: { type: "string", description: "Display name. Defaults to the existing package's real name, or to packageId for a brand-new package. A package's name may legitimately differ from its id." },
            packageDescription: { type: "string", description: "Description. Defaults to the existing package's real description, or to packageId for a brand-new package (MIP's own convention)." },
            packageRootId: { type: "string", description: "Id of the PARENT package this package sits under. Defaults to the existing package's real parent; omit for a root-level package. Setting this on an EXISTING package MOVES it in the package tree \u2014 only send it when that is what you mean." }
          },
          required: []
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

// Reads flows/*.json out of an export zip and returns the flowIds inside.
// Returns null when the zip cannot be inspected — a content summary is a nicety,
// losing the export path would not be. A FILTERED export contains no packages/
// folder at all, so nothing here may assume one; only flows/ is read.
async function readExportedFlowIds(zipBuffer) {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(zipBuffer);
    const ids = [];
    for (const [name, entry] of Object.entries(zip.files)) {
      // "flows/" deliberately does not match the sibling "flow-mappings/" folder.
      if (entry.dir || !name.startsWith("flows/") || !name.endsWith(".json")) continue;
      const parsed = JSON.parse(await entry.async("string"));
      for (const f of (Array.isArray(parsed) ? parsed : [parsed])) {
        if (f && (f.flowId || f.flowName)) ids.push(f.flowId || f.flowName);
      }
    }
    return ids;
  } catch {
    return null;
  }
}

// ─── Package record lookup ────────────────────────────────────────────────────
// Resolves a package's REAL record from MIP's package tree so the import zip can
// re-send it unchanged instead of fabricating one. The fabricated record used to
// overwrite the real one on import: packageRootId was never sent, so a nested
// package was orphaned out of its tree, and its real name/description were
// replaced — and packageName legitimately differs from packageId in production
// data, so that rename was not hypothetical.
//
// NEVER THROWS. That is a deliberate exception to this project's "handlers throw,
// index.js formats" rule, for the same reason readExportedFlowIds gives above: an
// inventory read that fails must cost the package record, never the flow import.
//
// THREE outcomes, and the difference between them is load-bearing:
//   found   → re-send this record (merged with any explicit args)
//   absent  → the walk COMPLETED and proved the id is not there → generate one
//   unknown → we could not tell → write NO packages/ entry at all
// "absent" may only come from a complete walk. Anything short of one is
// "unknown", because a partial walk cannot tell "not there" from "not reached",
// and a partial walk reporting "absent" is exactly the corruption this closes.
const PACKAGE_LOOKUP_CALL_BUDGET = 1000;      // ~3.5x the largest install seen (284 packages / 287 calls)
const PACKAGE_LOOKUP_TIME_BUDGET_MS = 20000;  // bounds user-visible latency directly: on a slow host the
                                              // same walk could blow the MCP client's tool timeout and kill
                                              // the whole import — strictly worse than the omit fallback.
const PACKAGE_PAGE = { paginationPage: 0, paginationSize: 1000 };
const PACKAGE_FIELDS = ["packageName", "packageDescription", "packageRootId"];

// Kept short on purpose: this ends up inside a user-facing sentence, so it must
// not splat a whole axios error object.
const httpDetail = (e) => (e?.response ? `HTTP ${e.response.status}` : (e?.code || e?.message || "unknown error"));

async function findPackageRecord(packageId, headers, opts = {}) {
  const callBudget = opts.callBudget ?? PACKAGE_LOOKUP_CALL_BUDGET;
  const timeBudget = opts.timeBudgetMs ?? PACKAGE_LOOKUP_TIME_BUDGET_MS;
  const started = Date.now();
  let calls = 0;

  // An empty package answers 204 with no body — that is "empty", not an error.
  // Same validateStatus precedent as monitoring.js; without it axios rejects and
  // a legitimately empty subtree would read as a failure.
  const page = async (url) => {
    calls++;
    const r = await axios.get(url, {
      headers,
      params: PACKAGE_PAGE,
      validateStatus: (s) => s === 200 || s === 204,
    });
    if (r.status === 204 || !r.data) return [];
    return Array.isArray(r.data.content) ? r.data.content : [];
  };

  // Scans one page for the target. Called the moment a page arrives, so a match
  // short-circuits before any sibling subtree is fetched — scanning a whole
  // level before descending would make every nested package cost the full
  // root-level fan-out (~57 calls on the largest install) instead of ~2.
  const scan = (items, parentId) => {
    for (const it of items) {
      if (it?.type !== "PACKAGE" || it.id !== packageId) continue;
      const rootId = typeof it.rootId === "string" && it.rootId ? it.rootId : null;
      if (rootId && parentId && rootId !== parentId) {
        // stdout is the MCP protocol channel — diagnostics go to stderr.
        console.error(t("flows.packageParentMismatchLog", { packageId, rootId, parentId },
          "[mip_create_and_import_flow] package '{packageId}': API rootId='{rootId}' but it was found under '{parentId}'; using rootId."));
      }
      // The walk already knows the parent, so packageRootId is right whether or
      // not PACKAGE items carry rootId; rootId is only the preferred cross-check.
      const root = rootId || parentId;
      return {
        status: "found",
        calls,
        parentSource: rootId ? "rootId" : (parentId ? "path" : "none"),
        record: {
          // The tree's id is the package id STRING ("P_LIMIT"); the zip's own `id`
          // is a numeric PK. Tree id maps to packageId and never to that zip id.
          packageId: it.id,
          packageName: typeof it.name === "string" && it.name ? it.name : it.id,
          packageDescription: typeof it.description === "string" && it.description ? it.description : it.id,
          // Omitted, never null: real exports of a root-level package carry no
          // such key at all, and a shape MIP never emits is one its importer has
          // never been asked to read.
          ...(root ? { packageRootId: root } : {}),
        },
      };
    }
    return null;
  };

  // Iterative rather than recursive so the parent id travels with each page, the
  // budget checks live in one place, and deep nesting cannot touch the stack.
  const seen = new Set();
  const queue = [];
  let rootItems;
  try {
    rootItems = await page(`${BASE_URL}/api/packages`);
  } catch (e) {
    return { status: "unknown", reason: "http", detail: httpDetail(e), calls };
  }
  const rootHit = scan(rootItems, null);
  if (rootHit) return rootHit;
  queue.push(rootItems);

  while (queue.length) {
    for (const it of queue.shift()) {
      if (it?.type !== "PACKAGE" || seen.has(it.id)) continue;
      // Marked before the fetch: the same package can be referenced from several
      // parents, which is an infinite loop otherwise.
      seen.add(it.id);
      if (calls >= callBudget)
        return { status: "unknown", reason: "calls", detail: String(callBudget), calls };
      if (Date.now() - started >= timeBudget)
        return { status: "unknown", reason: "time", detail: String(timeBudget), calls };
      let child;
      try {
        child = await page(`${BASE_URL}/api/packages/${encodeURIComponent(it.id)}`);
      } catch (e) {
        // One unreachable subtree makes "absent" unprovable.
        return { status: "unknown", reason: "http", detail: httpDetail(e), calls };
      }
      const hit = scan(child, it.id);
      if (hit) return hit;
      queue.push(child);
    }
  }
  return { status: "absent", calls };
}

// Why the lookup reached no verdict, as one clause for the user-facing message.
function lookupReasonText(lookup) {
  if (lookup.reason === "calls")
    return t("flows.packageLookupCallBudget", { budget: lookup.detail, calls: lookup.calls },
      "the package tree search hit its {budget}-call limit after {calls} calls without reaching a verdict");
  if (lookup.reason === "time")
    return t("flows.packageLookupTimeBudget", { budget: lookup.detail, calls: lookup.calls },
      "the package tree search hit its {budget} ms time limit after {calls} calls without reaching a verdict");
  return t("flows.packageLookupHttpError", { detail: lookup.detail },
    "MIP returned an error while reading the package tree: {detail}");
}

// Precedence is PER FIELD — a merge, never a replace: explicit args > the real
// record read from MIP > generated defaults. Passing only packageDescription for
// an existing package must not drop its real packageRootId; that is the point.
function buildPackageRecord(found, explicit, flowPackageId) {
  // "" means "not supplied", not "clear it": MCP clients routinely emit "" for
  // untouched optional strings, and erasing an existing package's name is not a
  // use case worth that data-loss risk.
  const pick = (...v) => v.find((x) => typeof x === "string" && x !== "");
  const rec = {
    packageId: flowPackageId,
    packageName: pick(explicit.packageName, found?.packageName, flowPackageId),
    // MIP's own convention for a fresh package is description == id.
    packageDescription: pick(explicit.packageDescription, found?.packageDescription, flowPackageId),
  };
  const root = pick(explicit.packageRootId, found?.packageRootId);
  if (root) rec.packageRootId = root; // built conditionally so the key is absent, not null, at root level
  return rec;
}

// Which explicit fields actually changed something. Reporting only.
function overriddenFields(found, explicit) {
  return PACKAGE_FIELDS.filter((f) => {
    const v = explicit[f];
    return typeof v === "string" && v !== "" && v !== found?.[f];
  });
}

const MAX_LISTED_FLOW_IDS = 10;

const handlers = {
    // ── Integration Flow ─────────────────────────────────────────────────────
    mip_export_packages_and_flows: async (args, headers) => {
      const flowIds = Array.isArray(args.flowIds) ? args.flowIds : [];
      // packageIds:[null] means "ALL PACKAGES" to MIP and it OVERRIDES the flowIds
      // filter — asking for one flow while that fallback is in place exports every
      // flow in the system (verified live: 65 vs 1). So the fallback may only fire
      // when the caller asked for nothing at all; a flowIds-only call must send [].
      const packageIds =
        args.packageIds == null
          ? (flowIds.length ? [] : [null])
          : args.packageIds;
      const body = { packageIds, flowIds };

      const res = await axios.post(`${BASE_URL}/api/packages/flows/export`, body, {
        headers: { ...headers, "Content-Type": "application/json" },
        responseType: "arraybuffer",
      });
      const buffer = Buffer.from(res.data);
      const filename = extractFilename(res.headers, `exported-packages-and-flows.zip`);
      const filePath = saveFile(buffer, filename);

      // Report what actually landed in the zip: that zip is the blast radius of a
      // later mip_import_packages_and_flows, and a silent 1-vs-65 mismatch is
      // exactly the failure this tool used to hide.
      const exported = await readExportedFlowIds(buffer);
      let summary, warning = "";
      if (exported === null) {
        summary = t("flows.exportUncounted", null,
          "Packages and flows exported (zip content could not be inspected)");
      } else {
        const rest = exported.length - MAX_LISTED_FLOW_IDS;
        const ids = exported.slice(0, MAX_LISTED_FLOW_IDS).join(", ") + (rest > 0 ? `, … (+${rest})` : "");
        summary = t("flows.exportCount", { count: exported.length, ids }, "{count} flow(s) exported: {ids}");
        if (flowIds.length && exported.length > flowIds.length) {
          warning = t("flows.exportWiderThanRequested", {
            requested: flowIds.length,
            got: exported.length,
            requestedIds: flowIds.join(", "),
          },
            "\n\n⚠ WARNING: {requested} flow(s) requested but the zip holds {got}. " +
            "Importing this zip would write flows you did not ask for. Requested: {requestedIds}");
        }
      }
      return t("flows.exportDone", { summary, path: filePath, warning }, "{summary}\n{path}{warning}");
    },

    mip_import_packages_and_flows: async (args, headers) => {
      if (!fs.existsSync(args.filePath)) {
        throw err.fileNotFound(args.filePath);
      }
      const form = new FormData();
      form.append("filename", fs.createReadStream(args.filePath));
      const res = await axios.post(`${BASE_URL}/api/packages/flows/import`, form, {
        headers: { ...headers, ...form.getHeaders() },
      });
      return t("flows.importDone", { detail: JSON.stringify(res.data) }, "Import completed: {detail}");
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
        throw err.at("flows.logLevelInvalid", null, "logLevel must be 1 (Only I/O Payload) or 2 (All Steps).");
      }
      const res = await axios.put(
        `${BASE_URL}/api/flows/${args.flowId}/update-log-level?logLevel=${args.logLevel}`,
        null,
        { headers }
      );
      return msg.updated("Log level", res.data);
    },
    // ── Flow Schema & Builder ────────────────────────────────────────────────
    mip_get_flow_schema: async (args, headers) => {
      const section = args.section ?? "all";
      if (section === "all") return JSON.stringify(MIP_FLOW_SCHEMA, null, 2);
      if (MIP_FLOW_SCHEMA[section]) return JSON.stringify(MIP_FLOW_SCHEMA[section], null, 2);
      return JSON.stringify({
        error: t("flows.unknownSection", { section, valid: Object.keys(MIP_FLOW_SCHEMA).join(", ") },
          "Unknown section: {section}. Valid values: {valid}"),
      });
    },

    mip_create_and_import_flow: async (args, headers) => {
      const flowDef = args.flow;
      if (!flowDef.flowId || !flowDef.flowName || !flowDef.flowPackageId) {
        throw new Error("flow.flowId, flow.flowName ve flow.flowPackageId zorunludur.");
      }

      // Two different package ids in one call is always a mistake: silently
      // picking one either creates a stray package or leaves the flow pointing at
      // a package that never gets written.
      const explicitPackage = (args.package && typeof args.package === "object") ? args.package : {};
      if (explicitPackage.packageId && explicitPackage.packageId !== flowDef.flowPackageId) {
        throw err.at("flows.packageIdMismatch",
          { given: explicitPackage.packageId, expected: flowDef.flowPackageId },
          "package.packageId ('{given}') does not match flow.flowPackageId ('{expected}'). " +
          "Send one package id only — the flow's package is flow.flowPackageId.");
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
          throw err.at("flows.graphicalMappingMissing", { missing: missing.join(", ") },
            "Graphical mapping ERROR — not imported: no flowMappings definition was given for these processGraphicalMapping mappingNames: {missing}. " +
            "Add { name, sourceSchema, targetSchema, links } to flowMappings for each one and send the schema files via resources. " +
            "(Pass skipValidation:true to skip this deliberately.)");
        }
      }

      // Import ONCESI dogrulama — deploy'da patlayan edge/condition hatalarini yakala.
      // args.skipValidation === true ile atlanabilir.
      if (args.skipValidation !== true) {
        const { errors, warnings } = validateFlow(flowDef.flowData);
        if (errors.length > 0) {
          throw err.at("flows.validationFailed", {
            errors: errors.map(e => "  ✗ " + e).join("\n"),
            warnings: warnings.length
              ? t("flows.validationWarningsHeader", null, "\n\nWarnings:\n") + warnings.map(w => "  ! " + w).join("\n")
              : "",
          },
            "Flow validation ERROR — not imported (so it does not blow up at deploy time). " +
            "Fix it and try again, or call mip_get_flow_schema('flowTemplates') to see the correct structure.\n" +
            "{errors}{warnings}\n\n(Pass skipValidation:true to skip this deliberately.)");
        }
        if (warnings.length > 0) {
          console.error(t("flows.validationWarningsLog", { warnings: warnings.map(w => "  ! " + w).join("\n") },
            "[mip_create_and_import_flow] Validation warnings:\n{warnings}"));
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
      zip.folder("flows").file(`flows.${ts}.json`, JSON.stringify([flowDef]));

      // PACKAGE RECORD -- this used to fabricate {packageId, packageName: id,
      // packageDescription: `${id} paketi`}, and importing that OVERWROTE the real
      // record of an EXISTING package: packageRootId was never sent, so a nested
      // package was orphaned out of its tree, and a real name/description (these
      // are genuinely human-authored — "E-Ticaret Sipariş İşleme") was replaced.
      // So: read the real record first and re-send it unchanged (merged with any
      // explicit args.package fields); when it cannot be read, write NO packages/
      // entry at all. A filtered export also ships without a packages/ folder and
      // imports fine (see readExportedFlowIds above), which is what makes omission
      // the proven-safe way to say "leave this package alone".
      const lookup = await findPackageRecord(flowDef.flowPackageId, headers);
      const hasExplicitPackage = PACKAGE_FIELDS.some(
        (f) => typeof explicitPackage[f] === "string" && explicitPackage[f] !== ""
      );
      let packageMsg;
      if (lookup.status === "unknown") {
        // zip.folder("packages") is deliberately NOT called: JSZip materialises the
        // directory entry on the .folder() call itself, so even an unwritten folder
        // would ship an empty packages/ dir.
        packageMsg = t("flows.packageLeftUntouched", {
          packageId: flowDef.flowPackageId,
          reason: lookupReasonText(lookup),
          argsNote: hasExplicitPackage
            ? t("flows.packageArgsIgnored", null,
                " The 'package' fields you supplied were not applied, for the same reason.")
            : "",
        },
          "\n⚠ Package '{packageId}': its record could not be verified ({reason}), so NO packages/ " +
          "entry was written — any existing record is left untouched.{argsNote} If '{packageId}' is a new " +
          "package it has not been created; re-run this tool once MIP responds.");
      } else {
        const found = lookup.status === "found" ? lookup.record : null;
        const record = buildPackageRecord(found, explicitPackage, flowDef.flowPackageId);
        zip.folder("packages").file(`packages.${ts}.json`, JSON.stringify([record]));
        const rootText = record.packageRootId || t("flows.packageRootNone", null, "(root)");
        if (found) {
          const changed = overriddenFields(found, explicitPackage);
          packageMsg = t("flows.packageReused", {
            packageId: record.packageId,
            packageName: record.packageName,
            packageRootId: rootText,
            overrides: changed.length
              ? t("flows.packageOverridden", { fields: changed.join(", ") }, " Overridden from args: {fields}.")
              : "",
          },
            "\nPackage '{packageId}': the existing record was read from MIP and re-sent unchanged " +
            "(name='{packageName}', parent={packageRootId}) — it was NOT overwritten.{overrides}");
        } else {
          packageMsg = t("flows.packageCreated", {
            packageId: record.packageId,
            packageName: record.packageName,
            packageRootId: rootText,
          },
            "\nPackage '{packageId}': not found in MIP, so a new record was created " +
            "(name='{packageName}', parent={packageRootId}).");
        }
      }

      // resources/: verilen schema/xslt/groovy/wsdl dosyalarini base64 gomerek paketle
      // (graphical mapping'in kaynak/hedef sema'lari da buradan gelir).
      const resourceObjs = [];
      for (const r of (Array.isArray(args.resources) ? args.resources : [])) {
        if (!r || !r.filePath) throw err.at("flows.resourceFilePathRequired", null, "resources[].filePath is required.");
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
          if (sid == null)
            throw err.at("flows.sourceSchemaNotImported", { name: fm.name, resource: fm.sourceSchemaResource.name },
              "flowMapping '{name}': source schema resource '{resource}' is not among the imported resources. Make sure you send it via 'resources'.");
          if (tid == null)
            throw err.at("flows.targetSchemaNotFound", { name: fm.name, resource: fm.targetSchemaResource.name },
              "flowMapping '{name}': target schema resource '{resource}' not found.");
          fm.sourceSchemaResourceId = sid;
          fm.targetSchemaResourceId = tid;
          await axios.post(`${BASE_URL}/api/flow-mappings`, fm, { headers });
          created.push(`${fm.name} (src#${sid} -> tgt#${tid})`);
        }
        mappingMsg = t("flows.mappingsCreated", { names: created.join(", ") }, "\nGraphical mapping(s) created: {names}");
      }

      return t("flows.importSuccess",
        { flowId: flowDef.flowId, packageMsg, mappingMsg, detail: JSON.stringify(res.data) },
        "Flow '{flowId}' was created and imported into MIP successfully.{packageMsg}{mappingMsg}\nResult: {detail}");
    },
};

// Test-only seam. registry.js consumes the default export, so this is invisible
// to the server; it exists because the budget branches of findPackageRecord
// cannot otherwise be reached without a 1000-package fixture or a 20s wait.
export const __test = { findPackageRecord, buildPackageRecord, overriddenFields };

export default { tools, handlers };
