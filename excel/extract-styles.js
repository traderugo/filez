const ExcelJS = require('exceljs');
const path = require('path');

const FILE = path.join(__dirname, 'Audit Report 2026-03-01 to 2026-03-17.xlsx');
const MAX_ROWS = 30;

function truncate(val, len = 50) {
  if (val == null) return '';
  const s = String(val);
  return s.length > len ? s.slice(0, len) + '...' : s;
}

function describeFont(font) {
  if (!font) return null;
  const parts = [];
  if (font.name) parts.push(`name="${font.name}"`);
  if (font.size) parts.push(`size=${font.size}`);
  if (font.bold) parts.push('BOLD');
  if (font.italic) parts.push('ITALIC');
  if (font.underline) parts.push(`underline=${font.underline}`);
  if (font.strike) parts.push('STRIKE');
  if (font.color) {
    if (font.color.argb) parts.push(`color=ARGB(${font.color.argb})`);
    else if (font.color.theme != null) parts.push(`color=theme(${font.color.theme})`);
  }
  return parts.length ? parts.join(', ') : null;
}

function describeFill(fill) {
  if (!fill || fill.type === 'none') return null;
  const parts = [`type="${fill.type || fill.pattern}"`];
  if (fill.pattern) parts.push(`pattern="${fill.pattern}"`);
  if (fill.fgColor) {
    if (fill.fgColor.argb) parts.push(`fgColor=ARGB(${fill.fgColor.argb})`);
    else if (fill.fgColor.theme != null) parts.push(`fgColor=theme(${fill.fgColor.theme})`);
  }
  if (fill.bgColor) {
    if (fill.bgColor.argb) parts.push(`bgColor=ARGB(${fill.bgColor.argb})`);
    else if (fill.bgColor.theme != null) parts.push(`bgColor=theme(${fill.bgColor.theme})`);
  }
  return parts.join(', ');
}

function describeBorder(border) {
  if (!border) return null;
  const sides = ['top', 'bottom', 'left', 'right'];
  const parts = [];
  for (const side of sides) {
    const b = border[side];
    if (b && b.style && b.style !== 'none') {
      let desc = `${side}=${b.style}`;
      if (b.color && b.color.argb) desc += `(ARGB:${b.color.argb})`;
      else if (b.color && b.color.theme != null) desc += `(theme:${b.color.theme})`;
      parts.push(desc);
    }
  }
  return parts.length ? parts.join(', ') : null;
}

function describeAlignment(alignment) {
  if (!alignment) return null;
  const parts = [];
  if (alignment.horizontal) parts.push(`h=${alignment.horizontal}`);
  if (alignment.vertical) parts.push(`v=${alignment.vertical}`);
  if (alignment.wrapText) parts.push('wrapText');
  if (alignment.indent) parts.push(`indent=${alignment.indent}`);
  if (alignment.textRotation) parts.push(`rotation=${alignment.textRotation}`);
  return parts.length ? parts.join(', ') : null;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`FILE: ${path.basename(FILE)}`);
  console.log(`Sheets: ${wb.worksheets.map(s => s.name).join(', ')}`);
  console.log(`${'='.repeat(80)}\n`);

  for (const ws of wb.worksheets) {
    console.log(`\n${'#'.repeat(80)}`);
    console.log(`## SHEET: "${ws.name}"  (rows=${ws.rowCount}, cols=${ws.columnCount})`);
    console.log(`${'#'.repeat(80)}\n`);

    // --- Column widths ---
    console.log('### COLUMN WIDTHS');
    for (let c = 1; c <= ws.columnCount; c++) {
      const col = ws.getColumn(c);
      const letter = col.letter;
      const w = col.width;
      if (w) {
        console.log(`  ${letter} (col ${c}): width=${w}`);
      }
    }
    console.log('');

    // --- Row heights ---
    console.log('### NON-DEFAULT ROW HEIGHTS (first 50 rows)');
    const limit = Math.min(ws.rowCount, 50);
    for (let r = 1; r <= limit; r++) {
      const row = ws.getRow(r);
      if (row.height && row.height !== 15) {
        console.log(`  Row ${r}: height=${row.height}`);
      }
    }
    console.log('');

    // --- Merged cells ---
    console.log('### MERGED CELLS');
    const merges = ws.model.merges || [];
    if (merges.length === 0) {
      console.log('  (none)');
    } else {
      for (const m of merges) {
        console.log(`  ${m}`);
      }
    }
    console.log('');

    // --- Cell styles for first MAX_ROWS rows ---
    console.log(`### CELL STYLES (first ${MAX_ROWS} rows)`);
    const rowLimit = Math.min(ws.rowCount, MAX_ROWS);
    for (let r = 1; r <= rowLimit; r++) {
      const row = ws.getRow(r);
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        cells.push(cell);
      });
      if (cells.length === 0) continue;

      console.log(`\n  --- Row ${r} ${row.height && row.height !== 15 ? `(height=${row.height})` : ''} ---`);
      for (const cell of cells) {
        const addr = cell.address;
        const val = cell.value;
        let displayVal;
        if (val && typeof val === 'object') {
          if (val.formula) displayVal = `FORMULA: =${truncate(val.formula, 40)} → ${truncate(val.result, 30)}`;
          else if (val.sharedFormula) displayVal = `SHARED: =${truncate(val.sharedFormula, 40)} → ${truncate(val.result, 30)}`;
          else if (val.richText) displayVal = `RICHTEXT: ${truncate(val.richText.map(t => t.text).join(''), 40)}`;
          else displayVal = truncate(JSON.stringify(val), 50);
        } else {
          displayVal = truncate(val);
        }

        const font = describeFont(cell.font);
        const fill = describeFill(cell.fill);
        const border = describeBorder(cell.border);
        const align = describeAlignment(cell.alignment);
        const numFmt = cell.numFmt && cell.numFmt !== 'General' ? cell.numFmt : null;

        // Always print value, then only non-null style properties
        console.log(`    [${addr}] value: ${displayVal}`);
        if (font) console.log(`           font: ${font}`);
        if (fill) console.log(`           fill: ${fill}`);
        if (border) console.log(`           border: ${border}`);
        if (align) console.log(`           alignment: ${align}`);
        if (numFmt) console.log(`           numFmt: "${numFmt}"`);
      }
    }

    // --- Summary: unique fills, fonts, numFmts across all rows ---
    console.log(`\n### STYLE SUMMARY (across ALL rows)`);
    const fills = new Set();
    const fonts = new Set();
    const numFmts = new Set();
    const borders = new Set();
    ws.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const f = describeFill(cell.fill);
        if (f) fills.add(f);
        const fn = describeFont(cell.font);
        if (fn) fonts.add(fn);
        if (cell.numFmt && cell.numFmt !== 'General') numFmts.add(cell.numFmt);
        const b = describeBorder(cell.border);
        if (b) borders.add(b);
      });
    });
    console.log('  Unique fills:');
    for (const f of fills) console.log(`    - ${f}`);
    console.log('  Unique fonts:');
    for (const f of fonts) console.log(`    - ${f}`);
    console.log('  Unique numFmts:');
    for (const f of numFmts) console.log(`    - "${f}"`);
    console.log('  Unique border combos:');
    for (const b of borders) console.log(`    - ${b}`);
    console.log('');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
