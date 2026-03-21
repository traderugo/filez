const ExcelJS = require('exceljs');

function borderStr(b) {
  if (!b) return '';
  return ['top','bottom','left','right'].map(s => b[s]?.style ? `${s[0]}:${b[s].style}` : '').filter(Boolean).join('|');
}

function fontStr(f) {
  if (!f) return '';
  const parts = [];
  if (f.name) parts.push(f.name);
  if (f.size) parts.push(`sz${f.size}`);
  if (f.bold) parts.push('B');
  if (f.italic) parts.push('I');
  if (f.underline) parts.push('U');
  if (f.color?.argb) parts.push(`#${f.color.argb}`);
  else if (f.color?.theme != null) parts.push(`th${f.color.theme}`);
  return parts.join(',');
}

function fillStr(f) {
  if (!f || f.type !== 'pattern') return '';
  return f.fgColor?.argb || f.fgColor?.theme?.toString() || '';
}

function alignStr(a) {
  if (!a) return '';
  const parts = [];
  if (a.horizontal) parts.push(`h:${a.horizontal}`);
  if (a.vertical && a.vertical !== 'top') parts.push(`v:${a.vertical}`);
  if (a.wrapText) parts.push('wrap');
  return parts.join(',');
}

async function compareSheet(refWb, expWb, sheetName) {
  const ref = refWb.getWorksheet(sheetName);
  const exp = expWb.getWorksheet(sheetName);
  if (!ref) { console.log(`  REF MISSING: ${sheetName}`); return; }
  if (!exp) { console.log(`  EXP MISSING: ${sheetName}`); return; }
  
  const diffs = [];
  
  // Column widths
  const maxCol = Math.max(ref.columnCount || 0, exp.columnCount || 0, 20);
  for (let c = 1; c <= maxCol; c++) {
    const rw = ref.getColumn(c).width;
    const ew = exp.getColumn(c).width;
    if (rw && ew && Math.abs(rw - ew) > 0.5) {
      diffs.push(`  Col ${c} width: ref=${rw?.toFixed(2)} exp=${ew?.toFixed(2)}`);
    } else if (rw && !ew) {
      diffs.push(`  Col ${c} width: ref=${rw?.toFixed(2)} exp=default`);
    }
  }
  
  // Merged cells
  const refMerges = new Set((ref._merges ? Object.values(ref._merges) : []).map(String));
  const expMerges = new Set((exp._merges ? Object.values(exp._merges) : []).map(String));
  for (const m of refMerges) { if (!expMerges.has(m)) diffs.push(`  Merge in ref only: ${m}`); }
  for (const m of expMerges) { if (!refMerges.has(m)) diffs.push(`  Merge in exp only: ${m}`); }

  // Cell-level comparison
  const maxRow = Math.max(ref.rowCount || 0, exp.rowCount || 0);
  for (let r = 1; r <= maxRow; r++) {
    const refRow = ref.getRow(r);
    const expRow = exp.getRow(r);
    
    // Row height
    const rh = refRow.height;
    const eh = expRow.height;
    if (rh && eh && Math.abs(rh - eh) > 1) {
      diffs.push(`  Row ${r} height: ref=${rh} exp=${eh}`);
    }
    
    for (let c = 1; c <= maxCol; c++) {
      const rc = refRow.getCell(c);
      const ec = expRow.getCell(c);
      
      const rv = rc.value;
      const ev = ec.value;
      const hasRefVal = rv != null && rv !== '';
      const hasExpVal = ev != null && ev !== '';
      
      // Only compare cells where at least one has content or styling
      if (!hasRefVal && !hasExpVal) {
        // Check if either has borders/font set
        const rb = borderStr(rc.border);
        const eb = borderStr(ec.border);
        if (rb && !eb) diffs.push(`  ${rc.address} border: ref=${rb} exp=none`);
        else if (!rb && eb) diffs.push(`  ${rc.address} border: ref=none exp=${eb}`);
        continue;
      }
      
      // Font
      const rf = fontStr(rc.font);
      const ef = fontStr(ec.font);
      if (rf !== ef) diffs.push(`  ${rc.address} font: ref=[${rf}] exp=[${ef}]`);
      
      // Border
      const rb = borderStr(rc.border);
      const eb = borderStr(ec.border);
      if (rb !== eb) diffs.push(`  ${rc.address} border: ref=[${rb}] exp=[${eb}]`);
      
      // Fill
      const rfl = fillStr(rc.fill);
      const efl = fillStr(ec.fill);
      if (rfl !== efl) diffs.push(`  ${rc.address} fill: ref=[${rfl}] exp=[${efl}]`);
      
      // Alignment
      const ra = alignStr(rc.alignment);
      const ea = alignStr(ec.alignment);
      if (ra !== ea) diffs.push(`  ${rc.address} align: ref=[${ra}] exp=[${ea}]`);
      
      // NumFmt
      if (rc.numFmt !== ec.numFmt && rc.numFmt && ec.numFmt) {
        diffs.push(`  ${rc.address} numFmt: ref=[${rc.numFmt}] exp=[${ec.numFmt}]`);
      }
    }
  }
  
  if (diffs.length === 0) {
    console.log(`  ✓ No differences found`);
  } else {
    diffs.slice(0, 60).forEach(d => console.log(d));
    if (diffs.length > 60) console.log(`  ... and ${diffs.length - 60} more`);
  }
}

(async () => {
  const ref = new ExcelJS.Workbook();
  const exp = new ExcelJS.Workbook();
  await ref.xlsx.readFile('LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx');
  await exp.xlsx.readFile('Audit Report 2026-03-01 to 2026-03-17.xlsx');
  
  const skip = ['5.PMS Consumption', '6.AGO Consumption', '7.DPK Consumption'];
  for (const ws of ref.worksheets) {
    if (skip.some(s => ws.name.includes(s))) continue;
    console.log(`\n=== ${ws.name} ===`);
    await compareSheet(ref, exp, ws.name);
  }
})();
