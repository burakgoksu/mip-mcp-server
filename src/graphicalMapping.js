// ─── Graphical Mapping builder ────────────────────────────────────────────────
// MIP v1.16 "graphical mapping" (gorsel alan eslemesi) nesnesi uretir. Node
// (processGraphicalMapping) sadece mappingName tasir; asil esleme AYRI bir
// flow-mapping nesnesinde durur: kaynak/hedef sema referansi + data grafi.
// Gercek export formatina birebir (bkz. F_GRAPHICAL_MAPPING* ornekleri).

const leaf = (p) => String(p).split("/").pop();

// links -> { mappings:[...], transformations:[...] } (gorsel graf).
// Her link { sourcePath, targetPath, targetIsArray? } bir kaynak->hedef alan baglantisidir.
export function buildMappingData(links = []) {
  const mappings = [];
  const transformations = [];
  for (const l of links) {
    if (!l || !l.sourcePath || !l.targetPath) continue;
    const sh = `${l.sourcePath}-source`;
    const th = `${l.targetPath}-target`;
    const id = `${sh}--${th}`;
    mappings.push({
      id, type: "custom", source: "source-file", target: "target-file",
      selected: false, markerEnd: { type: "arrow" },
      sourceHandle: sh, targetHandle: th, targetIsArray: !!l.targetIsArray,
    });
    transformations.push({
      id: th,
      edges: [{ id, source: sh, target: th, markerEnd: { type: "arrow" } }],
      nodes: [
        { id: sh, data: { label: leaf(l.sourcePath), connectorType: "source" }, type: "fieldNode", width: 160, height: 40, position: { x: 0, y: 0 }, sourcePosition: "right" },
        { id: th, data: { label: leaf(l.targetPath), connectorType: "target" }, type: "fieldNode", width: 160, height: 40, position: { x: 400, y: 0 }, targetPosition: "left" },
      ],
    });
  }
  return { mappings, transformations };
}

// Tam flow-mapping nesnesi. sourceSchema/targetSchema: { name, resourceType(xsd|xml|json) }.
// data verilirse (fonksiyonel/karmasik esleme) links yok sayilir. flowId flow ile ayni olmali.
// Audit/id alanlari EKLENMEZ — server atar; schema resource'lari isim+flowId ile cozulur.
export function buildFlowMapping({ name, flowId, sourceSchema, targetSchema, links, data }) {
  if (!name) throw new Error("flowMapping.name zorunlu (processGraphicalMapping.mappingName ile ayni olmali).");
  if (!sourceSchema || !sourceSchema.name) throw new Error(`flowMapping '${name}': sourceSchema.name zorunlu.`);
  if (!targetSchema || !targetSchema.name) throw new Error(`flowMapping '${name}': targetSchema.name zorunlu.`);
  return {
    name,
    flowId,
    version: 1,
    sourceSchemaResource: { name: sourceSchema.name, flowId, resourceType: sourceSchema.resourceType || inferType(sourceSchema.name) },
    targetSchemaResource: { name: targetSchema.name, flowId, resourceType: targetSchema.resourceType || inferType(targetSchema.name) },
    data: data || buildMappingData(links || []),
  };
}

// Dosya adindan resourceType/dataFormat tahmini.
export function inferType(fileName = "") {
  const ext = String(fileName).toLowerCase().split(".").pop();
  if (ext === "xsd") return "xsd";
  if (ext === "wsdl") return "wsdl";
  if (ext === "json") return "json";
  if (ext === "xslt" || ext === "xsl") return "xslt";
  if (ext === "groovy") return "groovy";
  return "xml";
}
export function inferDataFormat(resourceType = "") {
  if (resourceType === "json") return "JSON";
  if (["xsd", "xml", "wsdl"].includes(resourceType)) return "XML";
  return "NONE";
}

// ─── Node id normalize (DEPLOY-BREAKER FIX) ───────────────────────────────────
// MIP v1.16 deploy derleyicisi node id'lerinin `dndnode_<sayi>` formatinda olmasini
// ZORUNLU kilar; 'start1'/'cond1' gibi id'ler deploy'da "Flow can not deploy. Cause
// is :" (bos sebep) 500 verir. Bu fonksiyon uygun olmayan tum node id'lerini
// yeniden yazar VE tum referanslari (edge source/target/id/conditionId,
// conditionsRows[].edgeId, parentNode) tutarli sekilde gunceller.
const DND = /^dndnode_\d+$/;
const splitPair = (str) => { const s = String(str ?? ""); const i = s.indexOf("--"); return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 2)]; };

export function normalizeNodeIds(flowData) {
  if (!Array.isArray(flowData)) return flowData;
  const nodes = flowData.filter((x) => x && x.data && x.data.objectType);
  let counter = 100000000;
  const map = {};
  for (const n of nodes) map[n.id] = DND.test(n.id) ? n.id : `dndnode_${counter++}`;
  if (nodes.every((n) => map[n.id] === n.id)) return flowData; // hepsi zaten uygun
  const R = (id) => (id in map ? map[id] : id);
  return flowData.map((el) => {
    if (el && el.data && el.data.objectType) {
      const node = { ...el, id: R(el.id) };
      if (node.parentNode) node.parentNode = R(node.parentNode);
      const cs = node.data.connectorData && node.data.connectorData.ConditionState;
      if (cs && Array.isArray(cs.conditionsRows)) {
        node.data = { ...node.data, connectorData: { ...node.data.connectorData, ConditionState: { ...cs,
          conditionsRows: cs.conditionsRows.map((r) => { const [a, b] = splitPair(r.edgeId); return { ...r, edgeId: `${R(a)}--${R(b)}` }; }) } } };
      }
      return node;
    }
    if (el && el.source && el.target) {
      const src = R(el.source), tgt = R(el.target);
      const edge = { ...el, source: src, target: tgt };
      if (el.conditionId) { const [a, b] = splitPair(el.conditionId); edge.conditionId = `${R(a)}--${R(b)}`; }
      edge.id = `reactflow__edge-${src}${el.sourceHandle || ""}-${tgt}`;
      return edge;
    }
    return el;
  });
}
