// ─── Tool Kayıt Defteri ───────────────────────────────────────────────────────
// Her domain modülü default olarak { tools: [...şemalar], handlers: { name: fn } }
// export eder. Yeni domain eklerken: yukarıya import ekle + MODULES dizisine koy.
// (Modülerleştirme sürerken domain'ler buraya taşındıkça dolacak.)

import license from "./tools/license.js";
import counters from "./tools/counters.js";

const MODULES = [
  counters,
  license,
];

export const tools = MODULES.flatMap((m) => m.tools);
export const handlers = Object.assign({}, ...MODULES.map((m) => m.handlers));
