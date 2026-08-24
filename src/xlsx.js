// ─── Excel (.xlsx) OOXML üreticileri — jszip dinamik import edilir ───────────────

// ─── System Health Excel Builder (SABIT/STANDART şablon) ──────────────────────
// pods: { podName -> {cpu:[], mem:[], inflight:[]} } ; sampleRows: [{sample,pod,cpu,mem,inflight}]
// meta: { ts, samples, intervalMs }. Her çağrıda birebir aynı 2-sayfalı düzen üretir.
import { t, NUMBER_LOCALE } from "./i18n/index.js";

// Sheet names are referenced from both the sheet part and workbook.xml, so
// resolve each one once - a mismatch between the two corrupts the workbook.
const SHEET_SUMMARY = t("xlsx.sheetSummary", null, "Summary");
const SHEET_SAMPLES = t("xlsx.sheetSamples", null, "Samples");

export async function buildSystemHealthXlsx(pods, sampleRows, meta) {
  const JSZip = (await import("jszip")).default;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const colName = (n) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const S = (v, st) => ({ t: "s", v, s: st });
  const N = (v, st) => ({ t: "n", v, s: st });
  const rowXml = (cells, r) => {
    let x = `<row r="${r}">`;
    cells.forEach((c, i) => {
      if (c == null) return;
      const ref = `${colName(i)}${r}`;
      const st = c.s ? ` s="${c.s}"` : "";
      if (c.t === "n") x += `<c r="${ref}"${st}><v>${c.v}</v></c>`;
      else x += `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
    });
    return x + `</row>`;
  };
  const sheetXml = (rows, widths) => {
    let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`;
    if (widths) { x += `<cols>`; widths.forEach((w, i) => (x += `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)); x += `</cols>`; }
    x += `<sheetData>`;
    rows.forEach((cells, idx) => (x += rowXml(cells, idx + 1)));
    return x + `</sheetData></worksheet>`;
  };

  const stat = (a) => { const v = a.filter((x) => Number.isFinite(x)); if (!v.length) return { min: 0, avg: 0, max: 0 }; return { min: Math.min(...v), avg: v.reduce((s, x) => s + x, 0) / v.length, max: Math.max(...v) }; };
  const r2 = (x) => Math.round(x * 100) / 100;

  // Sheet 1: Ozet
  const s1 = [];
  s1.push([S(t("xlsx.healthTitle", null, "MIP System Health Report"), 1)]);
  s1.push([S(t("xlsx.time", null, "Time"), 3), S(meta.ts)]);
  s1.push([S(t("xlsx.sampling", null, "Sampling"), 3),
           S(t("xlsx.samplingValue", { samples: meta.samples, intervalMs: meta.intervalMs }, "{samples} samples x {intervalMs} ms"))]);
  s1.push([S(t("xlsx.podCount", null, "Pod count"), 3), N(Object.keys(pods).length)]);
  s1.push([]);
  s1.push([
    t("xlsx.pod", null, "Pod"),
    t("xlsx.cpuMin", null, "CPU Min %"), t("xlsx.cpuAvg", null, "CPU Avg %"), t("xlsx.cpuMax", null, "CPU Max %"),
    t("xlsx.memMin", null, "Memory Min (MB)"), t("xlsx.memAvg", null, "Memory Avg (MB)"), t("xlsx.memMax", null, "Memory Max (MB)"),
    t("xlsx.inflightMin", null, "Inflight Min"), t("xlsx.inflightAvg", null, "Inflight Avg"), t("xlsx.inflightMax", null, "Inflight Max"),
    t("xlsx.status", null, "Status"),
  ].map((h) => S(h, 2)));
  for (const [name, d] of Object.entries(pods)) {
    const c = stat(d.cpu), m = stat(d.mem), f = stat(d.inflight);
    const warn = c.max * 100 > 80 || m.max / 1024 > 8 || f.max > 1000;
    s1.push([
      S(name), N(r2(c.min * 100)), N(r2(c.avg * 100)), N(r2(c.max * 100)),
      N(Math.round(m.min)), N(Math.round(m.avg)), N(Math.round(m.max)),
      N(f.min), N(r2(f.avg)), N(f.max), S(warn ? t("xlsx.warning", null, "WARNING") : "OK", warn ? 4 : 0),
    ]);
  }

  // Sheet 2: Ornekler (ham)
  const s2 = [[
    t("xlsx.sampleNo", null, "Sample #"), t("xlsx.pod", null, "Pod"),
    t("xlsx.cpuPct", null, "CPU %"), t("xlsx.memoryMb", null, "Memory (MB)"), "Inflight",
  ].map((h) => S(h, 2))];
  for (const row of sampleRows) s2.push([N(row.sample), S(row.pod), N(r2(row.cpu * 100)), N(Math.round(row.mem)), N(row.inflight)]);

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FF203864"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF305496"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(SHEET_SUMMARY)}" sheetId="1" r:id="rId1"/><sheet name="${esc(SHEET_SAMPLES)}" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", styles);
  zip.file("xl/worksheets/sheet1.xml", sheetXml(s1, [26, 12, 12, 12, 16, 16, 16, 12, 12, 12, 10]));
  zip.file("xl/worksheets/sheet2.xml", sheetXml(s2, [10, 26, 12, 16, 12]));
  return await zip.generateAsync({ type: "nodebuffer" });
}

// ─── Monitoring Excel Report Builder ──────────────────────────────────────────
// Toplanmış aggregate'i çok sayfalı .xlsx'e (OOXML) çevirir. Harici Excel
// kütüphanesi gerektirmez; jszip ile zip + el-yazımı XML üretir.
// agg: { hour:[24]{s,e,d}, byDate:{date:n}, dateHour:{date:[24]}, flowHour:{flow:[24]}, flowTotals:{flow:{s,e,d}}, grandTotal }
// meta: { startDate, endDate, startTime, endTime, flowCount, statuses[], grandTotal, truncated }
export async function buildMonitoringReportXlsx(agg, meta) {
  const JSZip = (await import("jszip")).default;
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const colName = (n) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const N = (v, s) => ({ v, t: "n", s });
  const S = (v, s) => ({ v, t: "s", s });
  const tot = (h) => h.s + h.e + h.d;
  const grand = meta.grandTotal || 0;

  // cellXfs: 0 default | 1 header | 2 yeşil(min) | 3 kırmızı(max) | 4 percent | 5 bold | 6-9 heat
  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="9">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFCC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEE391"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFEC44F"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFB6A4A"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="7" borderId="0" xfId="0" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="8" borderId="0" xfId="0" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const heat = (v, max) => { if (!v || !max) return 0; const r = v / max; if (r < 0.15) return 6; if (r < 0.4) return 7; if (r < 0.7) return 8; return 9; };
  const cellXml = (addr, c) => {
    if (c == null) return "";
    const s = c.s ? ` s="${c.s}"` : "";
    if (c.t === "s") return `<c r="${addr}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
    return `<c r="${addr}"${s}><v>${c.v}</v></c>`;
  };
  const sheetXml = (rows, cols) => {
    let body = "";
    rows.forEach((row, ri) => {
      let cellsX = "";
      row.forEach((c, ci) => { if (c != null) cellsX += cellXml(`${colName(ci)}${ri + 1}`, c); });
      body += `<row r="${ri + 1}">${cellsX}</row>`;
    });
    const colsX = cols ? `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${colsX}<sheetData>${body}</sheetData></worksheet>`;
  };

  // hangi saatler gösterilecek (saat filtresi varsa onunla sınırla)
  const fromH = meta.startTime ? parseInt(meta.startTime.slice(0, 2), 10) : 0;
  const toH = meta.endTime ? parseInt(meta.endTime.slice(0, 2), 10) : 23;
  const hours = [];
  for (let h = fromH; h <= toH; h++) hours.push(h);

  const sheets = [];

  // 1) Özet
  {
    const totals = hours.map((h) => tot(agg.hour[h]));
    const withVal = hours.map((h, i) => [h, totals[i]]).filter((x) => x[1] > 0).sort((a, b) => a[1] - b[1]);
    const minH = withVal[0], maxH = withVal[withVal.length - 1];
    const rows = [
      [S(t("xlsx.reportTitle", null, "MIP MONITORING VOLUME REPORT"), 5)],
      [S(t("xlsx.dateRange", { start: meta.startDate, end: meta.endDate }, "Date range: {start} → {end}"))],
      [S(t("xlsx.timeRange", { start: meta.startTime || "00:00", end: meta.endTime || "23:59" }, "Time range: {start} - {end}"))],
      [S(t("xlsx.statuses", { statuses: meta.statuses.join(", ") }, "Statuses: {statuses}"))],
      [S(t("xlsx.totalMessages", { total: grand.toLocaleString(NUMBER_LOCALE), flows: meta.flowCount },
        "Total messages: {total}   |   Flow count: {flows}"))],
      [],
    ];
    if (minH && maxH) {
      rows.push([S(t("xlsx.quietestHour", null, "Quietest hour"), 2), S(`${String(minH[0]).padStart(2, "0")}:00`, 2), N(minH[1], 2)]);
      rows.push([S(t("xlsx.busiestHour", null, "Busiest hour"), 3), S(`${String(maxH[0]).padStart(2, "0")}:00`, 3), N(maxH[1], 3)]);
    } else {
      rows.push([S(t("xlsx.noRecords", null, "No records found in the selected range."))]);
    }
    if (meta.truncated)
      rows.push([], [S(t("xlsx.truncated", null,
        "WARNING: the safety limit was exceeded; the report holds partial data. Choose a narrower range."), 3)]);
    sheets.push({ name: SHEET_SUMMARY, rows, cols: [18, 16, 12] });
  }

  // 2) Saat
  {
    const totals = hours.map((h) => tot(agg.hour[h]));
    const max = Math.max(1, ...totals);
    const nz = totals.filter((t) => t > 0);
    const min = nz.length ? Math.min(...nz) : 0;
    const rows = [[
      S(t("xlsx.colHour", null, "Hour"), 1), S(t("xlsx.colTotal", null, "Total"), 1),
      S(t("xlsx.colSuccess", null, "Successful"), 1), S(t("xlsx.colError", null, "Error"), 1),
      S(t("xlsx.delivering", null, "Delivering"), 1), S(t("xlsx.colShare", null, "Share %"), 1),
      S(t("xlsx.colChart", null, "Chart"), 1),
    ]];
    hours.forEach((h) => {
      const c = agg.hour[h], t = tot(c);
      const hi = t > 0 && t === min ? 2 : t === max ? 3 : 0;
      rows.push([
        S(`${String(h).padStart(2, "0")}:00`, hi),
        N(t, hi), N(c.s), N(c.e), N(c.d),
        { v: grand ? t / grand : 0, t: "n", s: 4 },
        S("█".repeat(Math.round((t / max) * 40))),
      ]);
    });
    rows.push([S(t("xlsx.grandTotal", null, "GRAND TOTAL"), 5), N(totals.reduce((a, b) => a + b, 0), 5)]);
    sheets.push({ name: t("xlsx.sheetHour", null, "Hour"), rows, cols: [10, 10, 10, 8, 10, 9, 46] });
  }

  // 3) Gün x Saat (heatmap)
  {
    const dates = Object.keys(agg.dateHour).sort();
    const maxCell = Math.max(1, ...dates.flatMap((d) => hours.map((h) => agg.dateHour[d][h])));
    const rows = [[S(t("xlsx.colDate", null, "Date"), 1), S(t("xlsx.colTotal", null, "Total"), 1), ...hours.map((h) => S(String(h).padStart(2, "0"), 1))]];
    for (const d of dates) {
      const arr = agg.dateHour[d];
      const t = hours.reduce((a, h) => a + arr[h], 0);
      rows.push([S(d), N(t), ...hours.map((h) => N(arr[h], heat(arr[h], maxCell)))]);
    }
    sheets.push({ name: t("xlsx.sheetDayHour", null, "Day x Hour"), rows, cols: [12, 9, ...hours.map(() => 5)] });
  }

  // 4) Flow x Saat (heatmap)
  {
    const flowIds = Object.keys(agg.flowHour).sort((a, b) => agg.flowHour[b].reduce((x, y) => x + y, 0) - agg.flowHour[a].reduce((x, y) => x + y, 0));
    const maxCell = Math.max(1, ...flowIds.flatMap((f) => hours.map((h) => agg.flowHour[f][h])));
    const rows = [[S(t("xlsx.flow", null, "Flow"), 1), S(t("xlsx.colTotal", null, "Total"), 1), ...hours.map((h) => S(String(h).padStart(2, "0"), 1))]];
    for (const f of flowIds) {
      const arr = agg.flowHour[f];
      const t = hours.reduce((a, h) => a + arr[h], 0);
      rows.push([S(f), N(t), ...hours.map((h) => N(arr[h], heat(arr[h], maxCell)))]);
    }
    sheets.push({ name: t("xlsx.sheetFlowHour", null, "Flow x Hour"), rows, cols: [44, 9, ...hours.map(() => 5)] });
  }

  // 5) Günlük Toplam
  {
    const dates = Object.keys(agg.byDate).sort();
    const rows = [[S(t("xlsx.colDate", null, "Date"), 1), S(t("xlsx.colTotalMessages", null, "Total messages"), 1)]];
    dates.forEach((d) => rows.push([S(d), N(agg.byDate[d])]));
    sheets.push({ name: t("xlsx.sheetDailyTotal", null, "Daily Total"), rows, cols: [14, 14] });
  }

  // 6) Flow Özet
  {
    const ids = Object.keys(agg.flowTotals).sort((a, b) => {
      const T = (x) => agg.flowTotals[x].s + agg.flowTotals[x].e + agg.flowTotals[x].d;
      return T(b) - T(a);
    });
    const rows = [[
      S(t("xlsx.flow", null, "Flow"), 1), S(t("xlsx.colSuccess", null, "Successful"), 1),
      S(t("xlsx.colError", null, "Error"), 1), S(t("xlsx.delivering", null, "Delivering"), 1),
      S(t("xlsx.colTotal", null, "Total"), 1),
    ]];
    ids.forEach((f) => {
      const v = agg.flowTotals[f];
      rows.push([S(f), N(v.s), N(v.e), N(v.d), N(v.s + v.e + v.d)]);
    });
    sheets.push({ name: t("xlsx.sheetFlowSummary", null, "Flow Summary"), rows, cols: [44, 10, 8, 10, 10] });
  }

  // zip / xlsx
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  const xl = zip.folder("xl");
  xl.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  xl.folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  xl.file("styles.xml", STYLES);
  const ws = xl.folder("worksheets");
  sheets.forEach((s, i) => ws.file(`sheet${i + 1}.xml`, sheetXml(s.rows, s.cols)));
  return zip.generateAsync({ type: "nodebuffer" });
}
