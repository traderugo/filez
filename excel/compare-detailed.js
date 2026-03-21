const ExcelJS = require('exceljs');
const path = require('path');

const REF_FILE = path.join(__dirname, 'output', 'LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx');
const APP_FILE = path.join(__dirname, 'output', 'app output.xlsx');

function colorToHex(color) {
  if (!color) return 'none';
  if (color.argb) return color.argb;
  if (color.theme !== undefined) return `theme:${color.theme}${color.tint !== undefined ? `:tint=${color.tint}` : ''}`;
  if (color.indexed !== undefined) return `indexed:${color.indexed}`;
  return JSON.stringify(color);
}

function fillToStr(fill) {
  if (!fill || fill.type === 'pattern' && fill.pattern === 'none') return 'none';
  if (!fill.type) return 'none';
  if (fill.type === 'pattern') {
    const fg = colorToHex(fill.fgColor);
    const bg = colorToHex(fill.bgColor);
    return `pattern:${fill.pattern},fg=${fg},bg=${bg}`;
  }
  return JSON.stringify(fill);
}

function isYellow(fill) {
  if (!fill || !fill.fgColor) return false;
  const argb = (fill.fgColor.argb || '').toUpperCase();
  return argb.includes('FFFF00') || argb.includes('FFFF') || argb === 'FFFFFF00';
}

function borderSideToStr(side) {
  if (!side || !side.style) return 'none';
  const col = side.color ? colorToHex(side.color) : 'default';
  return `${side.style}(${col})`;
}

function borderToStr(border) {
  if (!border) return 'none|none|none|none';
  return [
    borderSideToStr(border.top),
    borderSideToStr(border.bottom),
    borderSideToStr(border.left),
    borderSideToStr(border.right),
  ].join('|');
}

function fontToStr(font) {
  if (!font) return 'default';
  const parts = [];
  if (font.name) parts.push(`name=${font.name}`);
  if (font.size) parts.push(`size=${font.size}`);
  if (font.bold) parts.push('bold');
  if (font.italic) parts.push('italic');
  if (font.underline) parts.push(`underline=${font.underline}`);
  if (font.color) parts.push(`color=${colorToHex(font.color)}`);
  return parts.length ? parts.join(',') : 'default';
}

function cellAddr(row, col) {
  let letter = '';
  let c = col;
  while (c > 0) {
    c--;
    letter = String.fromCharCode(65 + (c % 26)) + letter;
    c = Math.floor(c / 26);
  }
  return `${letter}${row}`;
}

async function main() {
  const refWb = new ExcelJS.Workbook();
  await refWb.xlsx.readFile(REF_FILE);

  const appWb = new ExcelJS.Workbook();
  await appWb.xlsx.readFile(APP_FILE);

  const refSheetNames = refWb.worksheets.map(s => s.name);
  const appSheetNames = appWb.worksheets.map(s => s.name);

  console.log('=== SHEET NAMES ===');
  console.log('REF sheets:', refSheetNames.join(', '));
  console.log('APP sheets:', appSheetNames.join(', '));

  const allSheetNames = [...new Set([...refSheetNames, ...appSheetNames])];
  if (refSheetNames.length !== appSheetNames.length || refSheetNames.some((n, i) => n !== appSheetNames[i])) {
    console.log('MISMATCH: Sheet names or order differ!');
    const onlyRef = refSheetNames.filter(n => !appSheetNames.includes(n));
    const onlyApp = appSheetNames.filter(n => !refSheetNames.includes(n));
    if (onlyRef.length) console.log('  Only in REF:', onlyRef.join(', '));
    if (onlyApp.length) console.log('  Only in APP:', onlyApp.join(', '));
  }

  for (const sheetName of allSheetNames) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`SHEET: "${sheetName}"`);
    console.log('='.repeat(80));

    const refSheet = refWb.getWorksheet(sheetName);
    const appSheet = appWb.getWorksheet(sheetName);

    if (!refSheet) { console.log('  ** MISSING in REF **'); continue; }
    if (!appSheet) { console.log('  ** MISSING in APP **'); continue; }

    const maxRow = Math.max(refSheet.rowCount, appSheet.rowCount);
    const maxCol = Math.max(refSheet.columnCount, appSheet.columnCount);
    console.log(`  REF dimensions: ${refSheet.rowCount} rows x ${refSheet.columnCount} cols`);
    console.log(`  APP dimensions: ${appSheet.rowCount} rows x ${appSheet.columnCount} cols`);

    // 1. FILLS
    console.log(`\n  --- FILLS ---`);
    const fillMismatches = [];
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const refCell = refSheet.getCell(r, c);
        const appCell = appSheet.getCell(r, c);
        const refFill = fillToStr(refCell.fill);
        const appFill = fillToStr(appCell.fill);
        if (refFill !== appFill) {
          fillMismatches.push({ addr: cellAddr(r, c), row: r, col: c, refFill, appFill, refYellow: isYellow(refCell.fill), appYellow: isYellow(appCell.fill) });
        }
      }
    }
    if (fillMismatches.length === 0) {
      console.log('  No fill mismatches.');
    } else {
      console.log(`  ${fillMismatches.length} fill mismatches:`);
      for (const m of fillMismatches) {
        const yellowNote = (m.refYellow && !m.appYellow) ? ' [REF=yellow, APP=not]' :
                           (!m.refYellow && m.appYellow) ? ' [REF=not, APP=yellow]' : '';
        console.log(`    ${m.addr}: REF=${m.refFill} | APP=${m.appFill}${yellowNote}`);
      }
    }

    // 2. BORDERS
    console.log(`\n  --- BORDERS ---`);
    const borderMismatches = [];
    const borderPatterns = {};
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const refCell = refSheet.getCell(r, c);
        const appCell = appSheet.getCell(r, c);
        const refBorder = refCell.border || {};
        const appBorder = appCell.border || {};
        const sides = ['top', 'bottom', 'left', 'right'];
        const diffs = [];
        for (const side of sides) {
          const rs = borderSideToStr(refBorder[side]);
          const as = borderSideToStr(appBorder[side]);
          if (rs !== as) {
            diffs.push({ side, ref: rs, app: as });
          }
        }
        if (diffs.length > 0) {
          borderMismatches.push({ addr: cellAddr(r, c), row: r, col: c, diffs });
          for (const d of diffs) {
            const key = `${d.side}: ref=${d.ref} vs app=${d.app}`;
            borderPatterns[key] = (borderPatterns[key] || 0) + 1;
          }
        }
      }
    }
    if (borderMismatches.length === 0) {
      console.log('  No border mismatches.');
    } else {
      console.log(`  ${borderMismatches.length} cells with border mismatches.`);
      console.log('  Border pattern summary:');
      for (const [pattern, count] of Object.entries(borderPatterns).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${count}x — ${pattern}`);
      }
      console.log(`  First 10 specific border mismatches:`);
      for (const m of borderMismatches.slice(0, 10)) {
        const diffStr = m.diffs.map(d => `${d.side}: ref=${d.ref} app=${d.app}`).join('; ');
        console.log(`    ${m.addr}: ${diffStr}`);
      }
    }

    // 3. FONTS
    console.log(`\n  --- FONTS ---`);
    const fontMismatches = [];
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const refCell = refSheet.getCell(r, c);
        const appCell = appSheet.getCell(r, c);
        const rf = fontToStr(refCell.font);
        const af = fontToStr(appCell.font);
        if (rf !== af) {
          fontMismatches.push({ addr: cellAddr(r, c), refFont: rf, appFont: af });
        }
      }
    }
    if (fontMismatches.length === 0) {
      console.log('  No font mismatches.');
    } else {
      console.log(`  ${fontMismatches.length} font mismatches:`);
      for (const m of fontMismatches) {
        console.log(`    ${m.addr}: REF=${m.refFont} | APP=${m.appFont}`);
      }
    }

    // 4. NUMBER FORMATS
    console.log(`\n  --- NUMBER FORMATS ---`);
    const numFmtMismatches = [];
    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const refCell = refSheet.getCell(r, c);
        const appCell = appSheet.getCell(r, c);
        const rn = refCell.numFmt || 'General';
        const an = appCell.numFmt || 'General';
        if (rn !== an) {
          numFmtMismatches.push({ addr: cellAddr(r, c), refFmt: rn, appFmt: an });
        }
      }
    }
    if (numFmtMismatches.length === 0) {
      console.log('  No number format mismatches.');
    } else {
      console.log(`  ${numFmtMismatches.length} number format mismatches:`);
      for (const m of numFmtMismatches) {
        console.log(`    ${m.addr}: REF="${m.refFmt}" | APP="${m.appFmt}"`);
      }
    }

    // 5. COLUMN WIDTHS
    console.log(`\n  --- COLUMN WIDTHS ---`);
    const widthDiffs = [];
    for (let c = 1; c <= maxCol; c++) {
      const refCol = refSheet.getColumn(c);
      const appCol = appSheet.getColumn(c);
      const rw = refCol.width || 8.43;
      const aw = appCol.width || 8.43;
      if (Math.abs(rw - aw) > 0.5) {
        widthDiffs.push({ col: c, letter: cellAddr(1, c).replace('1', ''), refWidth: rw, appWidth: aw });
      }
    }
    if (widthDiffs.length === 0) {
      console.log('  No column width mismatches (threshold > 0.5).');
    } else {
      console.log(`  ${widthDiffs.length} column width mismatches:`);
      for (const d of widthDiffs) {
        console.log(`    Col ${d.letter} (${d.col}): REF=${d.refWidth.toFixed(2)} | APP=${d.appWidth.toFixed(2)}`);
      }
    }

    // 6. MERGED CELLS
    console.log(`\n  --- MERGED CELLS ---`);
    // ExcelJS stores merges on the worksheet model
    const refMerges = new Set();
    const appMerges = new Set();
    // Access internal merge data
    if (refSheet.model && refSheet.model.merges) {
      for (const m of refSheet.model.merges) refMerges.add(m);
    }
    if (appSheet.model && appSheet.model.merges) {
      for (const m of appSheet.model.merges) appMerges.add(m);
    }
    const onlyRef = [...refMerges].filter(m => !appMerges.has(m));
    const onlyApp = [...appMerges].filter(m => !refMerges.has(m));
    if (onlyRef.length === 0 && onlyApp.length === 0) {
      console.log(`  Merged cells match (${refMerges.size} merges).`);
    } else {
      console.log(`  REF has ${refMerges.size} merges, APP has ${appMerges.size} merges.`);
      if (onlyRef.length) {
        console.log(`  Only in REF (${onlyRef.length}):`);
        for (const m of onlyRef) console.log(`    ${m}`);
      }
      if (onlyApp.length) {
        console.log(`  Only in APP (${onlyApp.length}):`);
        for (const m of onlyApp) console.log(`    ${m}`);
      }
    }

    // 7. ROW HEIGHTS
    console.log(`\n  --- ROW HEIGHTS ---`);
    const heightDiffs = [];
    for (let r = 1; r <= maxRow; r++) {
      const refRow = refSheet.getRow(r);
      const appRow = appSheet.getRow(r);
      const rh = refRow.height || 15;
      const ah = appRow.height || 15;
      if (Math.abs(rh - ah) > 0.5) {
        heightDiffs.push({ row: r, refHeight: rh, appHeight: ah });
      }
    }
    if (heightDiffs.length === 0) {
      console.log('  No row height mismatches (threshold > 0.5).');
    } else {
      console.log(`  ${heightDiffs.length} row height mismatches:`);
      for (const d of heightDiffs) {
        console.log(`    Row ${d.row}: REF=${d.refHeight.toFixed(2)} | APP=${d.appHeight.toFixed(2)}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('COMPARISON COMPLETE');
}

main().catch(err => { console.error(err); process.exit(1); });
