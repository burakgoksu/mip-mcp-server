// ─── Tool metadata overlay ────────────────────────────────────────────────────
// English lives in the tool objects; translations live in one flat JSON keyed by
// dotted path. This walker applies the catalog so translating a language means
// editing one file, not 673 code lines.
//
// Key grammar (must match _verify.mjs and the extractor exactly):
//   mip_create_counter                       tool description
//   mip_create_counter.name                  inputSchema.properties.name
//   mip_x.flow.flowId                        nested object property
//   mip_update_alert_rules.rules             the array's own description
//   mip_update_alert_rules.rules[].component array item property
//   mip_x.tags[]                             array-of-scalars items.description
//
// Scope: TOOLS only. Never run this over MIP_FLOW_SCHEMA — that KB object has
// keys resembling schema properties and the walker would corrupt it.

export function newStats() {
  return { hit: [], miss: [], seen: new Set() };
}

function take(obj, field, key, catalog, stats) {
  stats.seen.add(key);
  const hit = catalog[key];
  if (typeof hit === "string" && hit.length) {
    obj[field] = hit;
    stats.hit.push(key);
  } else if (obj[field]) {
    stats.miss.push(key); // falls back to the English source string
  }
}

function walk(node, prefix, catalog, stats) {
  const props = node?.properties;
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    const key = `${prefix}.${k}`;
    take(v, "description", key, catalog, stats);
    if (v.properties) {
      walk(v, key, catalog, stats); // nested object
    } else if (v.items) {
      const ik = `${key}[]`;
      if (v.items.properties) walk(v.items, ik, catalog, stats); // array of objects
      else take(v.items, "description", ik, catalog, stats); // array of scalars
    }
  }
}

// Clones before mutating: the tool arrays are module-scope constants shared by
// reference, so mutating them would make the overlay order-dependent and
// unrepeatable across imports. One structuredClone of ~46KB at startup, once.
export function applyOverlay(tools, catalog, stats = newStats()) {
  const out = structuredClone(tools);
  for (const tool of out) {
    take(tool, "description", tool.name, catalog, stats);
    walk(tool.inputSchema, tool.name, catalog, stats);
  }
  if (process.env.MIP_I18N_DEBUG) {
    process.stderr.write(
      `i18n: ${stats.hit.length} translated, ${stats.miss.length} fell back to English.\n` +
        (stats.miss.length ? `i18n: missing keys: ${stats.miss.slice(0, 20).join(", ")}\n` : "")
    );
  }
  return out;
}

// ─── Knowledge-base overlay ───────────────────────────────────────────────────
// A DIFFERENT walker from applyOverlay above, and the two must not be swapped.
// applyOverlay understands JSON Schema (properties/items/description); the KB is
// free-form nested data, so this one walks every string leaf and keys it by a
// plain dotted path with [i] for array indices:
//   description                                    top-level prose
//   nodeTypes.processStart.description             nested object
//   importantNotes[3]                              array item
//   flowTemplates.conditionFlow.flowData[2].data.label
//
// Deliberately catalog-driven rather than translate-everything: most KB leaves
// are literal flow data the model copies verbatim ('buttonedge', 'normal-source',
// objectType names, canonical node labels). Only paths present in the catalog are
// replaced, so a leaf with no entry can never be corrupted by a translation pass.
export function applyKbOverlay(kb, catalog, stats = newStats()) {
  if (!catalog || !Object.keys(catalog).length) return kb;
  const out = structuredClone(kb);
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => {
        const key = `${path}[${i}]`;
        if (typeof v === "string") {
          const hit = catalog[key];
          if (typeof hit === "string" && hit.length) { node[i] = hit; stats.hit.push(key); }
        } else walk(v, key);
      });
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      const key = path ? `${path}.${k}` : k;
      if (typeof v === "string") {
        const hit = catalog[key];
        if (typeof hit === "string" && hit.length) { node[k] = hit; stats.hit.push(key); }
      } else walk(v, key);
    }
  };
  walk(out, "");
  if (process.env.MIP_I18N_DEBUG) {
    const dead = Object.keys(catalog).filter((k) => !stats.hit.includes(k));
    process.stderr.write(
      `i18n: kb ${stats.hit.length}/${Object.keys(catalog).length} leaves translated.\n` +
        (dead.length ? `i18n: kb dead keys: ${dead.slice(0, 10).join(", ")}\n` : "")
    );
  }
  return out;
}
