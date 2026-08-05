// ─── Tool Kayıt Defteri ───────────────────────────────────────────────────────
// Her domain modülü default olarak { tools: [...şemalar], handlers: { name: fn } }
// export eder. Yeni domain eklerken: yukarıya import ekle + MODULES dizisine koy.
// (Modülerleştirme sürerken domain'ler buraya taşındıkça dolacak.)

const MODULES = [
  // örn: (import edildikçe) counters, editors, license, ...
];

export const tools = MODULES.flatMap((m) => m.tools);
export const handlers = Object.assign({}, ...MODULES.map((m) => m.handlers));
