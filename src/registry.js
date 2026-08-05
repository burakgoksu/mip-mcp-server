// ─── Tool Kayıt Defteri ───────────────────────────────────────────────────────
// Her domain modülü default olarak { tools: [...şemalar], handlers: { name: fn } }
// export eder. Yeni domain eklerken: yukarıya import ekle + MODULES dizisine koy.
// (Modülerleştirme sürerken domain'ler buraya taşındıkça dolacak.)

import license from "./tools/license.js";
import counters from "./tools/counters.js";
import globalFlowConfigs from "./tools/globalFlowConfigs.js";
import searchMessage from "./tools/searchMessage.js";
import messageSearchRules from "./tools/messageSearchRules.js";
import alerts from "./tools/alerts.js";

const MODULES = [
  counters,
  globalFlowConfigs,
  searchMessage,
  messageSearchRules,
  alerts,
  license,
];

export const tools = MODULES.flatMap((m) => m.tools);
export const handlers = Object.assign({}, ...MODULES.map((m) => m.handlers));
