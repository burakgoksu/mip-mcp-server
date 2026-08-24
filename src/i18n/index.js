// ─── i18n çekirdeği / i18n core ───────────────────────────────────────────────
// LEAF MODULE: imports nothing from this project (only node:fs). config.js calls
// process.exit(1) during its own evaluation, so it must be able to import t()
// without creating a cycle — that only holds while this file stays a leaf.
//
// English is the canonical source language: every call site passes its English
// string as the fallback, so `en` needs no catalog and a missing translation
// degrades to English instead of rendering blank.
import { readFileSync } from "node:fs";

const DEFAULT_LANG = "tr"; // backward compatible — existing installs keep Turkish
const SUPPORTED = new Set(["tr", "en"]);

function resolveLang() {
  const raw = String(process.env.MIP_LANG || "").trim().toLowerCase().split(/[-_]/)[0];
  if (!raw) return DEFAULT_LANG;
  if (SUPPORTED.has(raw)) return raw;
  // stdout is the MCP protocol channel — diagnostics MUST go to stderr.
  process.stderr.write(
    `MIP_LANG='${process.env.MIP_LANG}' is not supported (tr, en); falling back to '${DEFAULT_LANG}'.\n`
  );
  return DEFAULT_LANG;
}

// Resolved once at module init. process.env is fully populated before any ESM
// module body runs, and stdio MCP is one client per process — so a constant is
// correct here, and it guarantees ListTools and CallTool can never disagree.
export const LANG = resolveLang();
export const NUMBER_LOCALE = LANG === "tr" ? "tr-TR" : "en-US";

const cache = new Map();

// Catalogs load via readFileSync(new URL(..., import.meta.url)) rather than JSON
// import attributes: those need Node 20.10+, and package.json promises >=18.
export function loadCatalog(lang, name) {
  if (lang === "en") return {}; // English is the source; nothing to overlay
  const ck = `${lang}/${name}`;
  if (!cache.has(ck)) {
    try {
      const url = new URL(`./${lang}/${name}.json`, import.meta.url);
      cache.set(ck, JSON.parse(readFileSync(url, "utf8")));
    } catch (e) {
      // Degrade to English rather than killing the server — a packaging mistake
      // should cost translations, not availability.
      process.stderr.write(`i18n: catalog ${ck} unavailable (${e.code || e.message}); using English.\n`);
      cache.set(ck, {});
    }
  }
  return cache.get(ck);
}

const MESSAGES = loadCatalog(LANG, "messages");

// t("msg.created", { entity, detail }, "{entity} created: {detail}")
// A missing param renders the literal {name} — a visible defect beats a silent
// "undefined" leaking into a user-facing string.
export function t(key, params, fallback) {
  const tpl = MESSAGES[key] ?? fallback ?? key;
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (m, p) => (p in params ? String(params[p]) : m));
}

// Entity display names are mostly English loanwords used verbatim in Turkish
// ("Counter", "Credential", "JDBC destination"), so the catalog only carries the
// few that genuinely differ; the rest fall back to the name passed in.
const ent = (name) => t(`entity.${name}`, null, name);
const j = (d) => (typeof d === "string" ? d : JSON.stringify(d));

// ─── Generic confirmation messages ────────────────────────────────────────────
// Turkish passive participles (oluşturuldu/güncellendi/silindi) do not inflect
// for the preceding noun, so one template serves every entity. That collapses
// ~93 near-identical call sites into the handful of keys below.
export const msg = {
  created: (e, d) => t("msg.created", { entity: ent(e), detail: j(d) }, "{entity} created: {detail}"),
  updated: (e, d) => t("msg.updated", { entity: ent(e), detail: j(d) }, "{entity} updated: {detail}"),
  deleted: (e, d) => t("msg.deleted", { entity: ent(e), detail: j(d) }, "{entity} deleted: {detail}"),
  deletedRef: (e, ref, d) =>
    t("msg.deletedRef", { entity: ent(e), ref, detail: j(d) }, "{entity} deleted ({ref}): {detail}"),
  updatedRef: (e, ref, d) =>
    t("msg.updatedRef", { entity: ent(e), ref, detail: j(d) }, "{entity} updated ({ref}): {detail}"),
  addedRef: (e, ref, d) =>
    t("msg.addedRef", { entity: ent(e), ref, detail: j(d) }, "{entity} added ({ref}): {detail}"),
  uploadedRef: (e, ref, d) =>
    t("msg.uploadedRef", { entity: ent(e), ref, detail: j(d) }, "{entity} uploaded ({ref}): {detail}"),
  unsyncedRef: (e, ref, d) =>
    t("msg.unsyncedRef", { entity: ent(e), ref, detail: j(d) }, "{entity} sync removed ({ref}): {detail}"),
  uploaded: (e, d) => t("msg.uploaded", { entity: ent(e), detail: j(d) }, "{entity} uploaded: {detail}"),
  saved: (e, d) => t("msg.saved", { entity: ent(e), detail: j(d) }, "{entity} saved: {detail}"),
  added: (e, d) => t("msg.added", { entity: ent(e), detail: j(d) }, "{entity} added: {detail}"),
  removed: (e, d) => t("msg.removed", { entity: ent(e), detail: j(d) }, "{entity} removed: {detail}"),
  downloaded: (e, p) => t("msg.downloaded", { entity: ent(e), path: p }, "{entity} downloaded: {path}"),
  imported: (e, d) => t("msg.imported", { entity: ent(e), detail: j(d) }, "{entity} imported: {detail}"),
  synced: (e, d) => t("msg.synced", { entity: ent(e), detail: j(d) }, "{entity} synced: {detail}"),
  unsynced: (e, d) => t("msg.unsynced", { entity: ent(e), detail: j(d) }, "{entity} unsynced: {detail}"),
};

// ─── Errors ───────────────────────────────────────────────────────────────────
// Only the two genuinely repeated shapes are generic (fileNotFound appears 8x,
// notFound 10x). Everything else keeps its own key via err.at() — those
// sentences carry real guidance and would be mangled by a generic template.
export const err = {
  fileNotFound: (p) => new Error(t("err.fileNotFound", { path: p }, "File not found: {path}")),
  notFound: (e, id) => new Error(t("err.notFound", { entity: ent(e), id }, "{entity} not found: id {id}")),
  required: (fields) => new Error(t("err.required", { fields }, "{fields} required.")),
  at: (key, params, fallback) => new Error(t(key, params, fallback)),
};
