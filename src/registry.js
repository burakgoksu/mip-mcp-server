// ─── Tool Kayıt Defteri ───────────────────────────────────────────────────────
// Her domain modülü default olarak { tools: [...şemalar], handlers: { name: fn } }
// export eder. Yeni domain eklerken: yukarıya import ekle + MODULES dizisine koy.
// (Modülerleştirme sürerken domain'ler buraya taşındıkça dolacak.)

import license from "./tools/license.js";
import resources from "./tools/resources.js";
import flows from "./tools/flows.js";
import certsKeystores from "./tools/certsKeystores.js";
import mappings from "./tools/mappings.js";
import monitoring from "./tools/monitoring.js";
import serviceUsers from "./tools/serviceUsers.js";
import credentials from "./tools/credentials.js";
import counters from "./tools/counters.js";
import alertConfig from "./tools/alertConfig.js";
import managementHealth from "./tools/managementHealth.js";
import editors from "./tools/editors.js";
import oftp2 from "./tools/oftp2.js";
import mcpServers from "./tools/mcpServers.js";
import destinationsRfc from "./tools/destinationsRfc.js";
import destinationsJdbc from "./tools/destinationsJdbc.js";
import globalFlowConfigs from "./tools/globalFlowConfigs.js";
import searchMessage from "./tools/searchMessage.js";
import messageSearchRules from "./tools/messageSearchRules.js";
import alerts from "./tools/alerts.js";

const MODULES = [
  counters,
  alertConfig,
  managementHealth,
  editors,
  oftp2,
  mcpServers,
  destinationsRfc,
  destinationsJdbc,
  globalFlowConfigs,
  searchMessage,
  messageSearchRules,
  alerts,
  license,
  resources,
  flows,
  certsKeystores,
  mappings,
  monitoring,
  serviceUsers,
  credentials,
];

export const tools = MODULES.flatMap((m) => m.tools);
export const handlers = Object.assign({}, ...MODULES.map((m) => m.handlers));
