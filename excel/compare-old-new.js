const ExcelJS = require('exceljs');
const path = require('path');

const OLD_FILE = path.join(__dirname, 'output', 'Audit Report 2026-03-01 to 2026-03-17 (7).xlsx');
const NEW_FILE = path.join(__dirname, 'output', 'Audit Report 2026-03-01 to 2026-03-17 (8).xlsx');

function normalizeSheetName(name) {
  // Strip leading numbers/dots/arrows, collapse whitespace, lowercase
  return name
    .replace(/^\d+\.\s*/, '')
    .replace(/>>/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getCellValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  const v = cell.value;
  // Handle rich text
  if (v && typeof v === 'object' && v.richText) {
    return v.richText.map(r => r.text).join('');
  }
  // Handle formula results
  if (v && typeof v === 'object' && v.formula) {
    return v.result !== undefined ? v.result : `=FORMULA(${v.formula})`;
  }
  if (v && typeof v === 'object' && v.sharedFormula) {
    return v.result !== undefined ? v.result : `=SHARED()`;
  }
  // Handle dates
  if (v instanceof Date) {
    return v.toISOString();
  }
  // Handle error values
  if (v && typeof v === 'object' && v.error) {
    return `#ERROR:${v.error}`;
  }
  return v;
}

function formatValue(v) {
  if (v === null || v === undefined) return '(empty)';
  if (typeof v === 'number') return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (typeof v === 'string' && v.length > 60) return v.substring(0, 60) + '...';
  return String(v);
}

function getSheetData(sheet) {
  const data = {};
  let maxRow = 0;
  let maxCol = 0;

  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    row.eachCell({ includeEmpty: false }, (cell, colNum) => {
      const val = getCellValue(cell);
      if (val !== null && val !== undefined && val !== '') {
        const addr = `${columnLetter(colNum)}${rowNum}`;
        data[addr] = val;
        if (rowNum > maxRow) maxRow = rowNum;
        if (colNum > maxCol) maxCol = colNum;
      }
    });
  });

  return { data, maxRow, maxCol };
}

function columnLetter(col) {
  let s = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

function numericClose(a, b, tolerance = 0.01) {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= tolerance;
  }
  return false;
}

async function main() {
  const oldWb = new ExcelJS.Workbook();
  const newWb = new ExcelJS.Workbook();

  await oldWb.xlsx.readFile(OLD_FILE);
  await newWb.xlsx.readFile(NEW_FILE);

  console.log('=' .repeat(90));
  console.log('EXCEL COMPARISON: OLD (template-based, 81KB) vs NEW (direct export, 29KB)');
  console.log('=' .repeat(90));

  // List all sheets
  console.log('\n--- SHEET INVENTORY ---');
  console.log('\nOLD file sheets:');
  oldWb.worksheets.forEach((ws, i) => console.log(`  ${i+1}. "${ws.name}"`));
  console.log('\nNEW file sheets:');
  newWb.worksheets.forEach((ws, i) => console.log(`  ${i+1}. "${ws.name}"`));

  // Build matching map
  const newSheetsByNorm = {};
  newWb.worksheets.forEach(ws => {
    newSheetsByNorm[normalizeSheetName(ws.name)] = ws;
  });

  const matched = [];
  const unmatched = [];

  for (const oldSheet of oldWb.worksheets) {
    const normOld = normalizeSheetName(oldSheet.name);
    const newSheet = newSheetsByNorm[normOld];
    if (newSheet) {
      matched.push({ oldSheet, newSheet });
      delete newSheetsByNorm[normOld];
    } else {
      // Try partial matching
      let found = null;
      for (const [normNew, ws] of Object.entries(newSheetsByNorm)) {
        if (normNew.includes(normOld) || normOld.includes(normNew)) {
          found = { key: normNew, ws };
          break;
        }
        // Try matching on significant words
        const oldWords = normOld.split(' ').filter(w => w.length > 2);
        const newWords = normNew.split(' ').filter(w => w.length > 2);
        const common = oldWords.filter(w => newWords.includes(w));
        if (common.length >= 2) {
          found = { key: normNew, ws };
          break;
        }
      }
      if (found) {
        matched.push({ oldSheet, newSheet: found.ws });
        delete newSheetsByNorm[found.key];
      } else {
        unmatched.push(oldSheet);
      }
    }
  }

  console.log('\n--- SHEET MATCHING ---');
  matched.forEach(({ oldSheet, newSheet }) => {
    console.log(`  OLD: "${oldSheet.name}"  <=>  NEW: "${newSheet.name}"`);
  });
  if (unmatched.length) {
    console.log('\n  UNMATCHED old sheets (no corresponding new sheet):');
    unmatched.forEach(ws => console.log(`    - "${ws.name}"`));
  }
  const leftoverNew = Object.values(newSheetsByNorm);
  if (leftoverNew.length) {
    console.log('\n  EXTRA new sheets (no corresponding old sheet):');
    leftoverNew.forEach(ws => console.log(`    - "${ws.name}"`));
  }

  // Compare each matched pair
  let totalMatches = 0;
  let totalMismatches = 0;
  let totalOldOnly = 0;
  let totalNewOnly = 0;

  for (const { oldSheet, newSheet } of matched) {
    console.log('\n' + '='.repeat(90));
    console.log(`COMPARING: "${oldSheet.name}" vs "${newSheet.name}"`);
    console.log('='.repeat(90));

    const oldData = getSheetData(oldSheet);
    const newData = getSheetData(newSheet);

    console.log(`  Old: ${Object.keys(oldData.data).length} cells, ${oldData.maxRow} rows x ${oldData.maxCol} cols`);
    console.log(`  New: ${Object.keys(newData.data).length} cells, ${newData.maxRow} rows x ${newData.maxCol} cols`);

    const allAddrs = new Set([...Object.keys(oldData.data), ...Object.keys(newData.data)]);

    let sheetMatch = 0;
    let sheetMismatch = 0;
    let sheetOldOnly = 0;
    let sheetNewOnly = 0;
    const diffs = [];
    const numericDiffs = [];

    for (const addr of allAddrs) {
      const oldVal = oldData.data[addr];
      const newVal = newData.data[addr];

      const oldExists = oldVal !== undefined && oldVal !== null && oldVal !== '';
      const newExists = newVal !== undefined && newVal !== null && newVal !== '';

      if (oldExists && newExists) {
        // Both have values — compare
        let match = false;
        if (oldVal === newVal) {
          match = true;
        } else if (numericClose(oldVal, newVal)) {
          match = true; // close enough (rounding)
        } else if (String(oldVal).trim() === String(newVal).trim()) {
          match = true;
        }

        if (match) {
          sheetMatch++;
        } else {
          sheetMismatch++;
          const diffEntry = { addr, old: oldVal, new: newVal };
          diffs.push(diffEntry);
          if (typeof oldVal === 'number' || typeof newVal === 'number') {
            numericDiffs.push(diffEntry);
          }
        }
      } else if (oldExists && !newExists) {
        sheetOldOnly++;
        diffs.push({ addr, old: oldVal, new: '(missing)' });
      } else if (!oldExists && newExists) {
        sheetNewOnly++;
        diffs.push({ addr, old: '(missing)', new: newVal });
      }
    }

    totalMatches += sheetMatch;
    totalMismatches += sheetMismatch;
    totalOldOnly += sheetOldOnly;
    totalNewOnly += sheetNewOnly;

    console.log(`\n  RESULTS: ${sheetMatch} match | ${sheetMismatch} mismatch | ${sheetOldOnly} old-only | ${sheetNewOnly} new-only`);

    if (diffs.length === 0) {
      console.log('  *** ALL DATA MATCHES ***');
    } else {
      // Sort diffs by address for readability
      diffs.sort((a, b) => {
        const rowA = parseInt(a.addr.replace(/[A-Z]+/, ''));
        const rowB = parseInt(b.addr.replace(/[A-Z]+/, ''));
        if (rowA !== rowB) return rowA - rowB;
        return a.addr.localeCompare(b.addr);
      });

      // Show numeric differences first (most important)
      if (numericDiffs.length > 0) {
        console.log(`\n  NUMERIC DIFFERENCES (${numericDiffs.length}):`);
        numericDiffs.forEach(d => {
          const oldStr = formatValue(d.old);
          const newStr = formatValue(d.new);
          const delta = (typeof d.old === 'number' && typeof d.new === 'number')
            ? ` (delta: ${(d.new - d.old).toLocaleString('en-US', { maximumFractionDigits: 4 })})`
            : '';
          console.log(`    ${d.addr}: OLD=${oldStr}  NEW=${newStr}${delta}`);
        });
      }

      // Show all differences (cap at 50 to avoid flooding)
      const nonNumericDiffs = diffs.filter(d => !numericDiffs.includes(d));
      if (nonNumericDiffs.length > 0) {
        const showCount = Math.min(nonNumericDiffs.length, 50);
        console.log(`\n  OTHER DIFFERENCES (showing ${showCount} of ${nonNumericDiffs.length}):`);
        nonNumericDiffs.slice(0, 50).forEach(d => {
          console.log(`    ${d.addr}: OLD=${formatValue(d.old)}  |  NEW=${formatValue(d.new)}`);
        });
        if (nonNumericDiffs.length > 50) {
          console.log(`    ... and ${nonNumericDiffs.length - 50} more`);
        }
      }
    }
  }

  // Also check unmatched old sheets for data
  for (const ws of unmatched) {
    const data = getSheetData(ws);
    console.log(`\n  UNMATCHED OLD SHEET "${ws.name}": ${Object.keys(data.data).length} cells (no comparison possible)`);
  }

  // Grand summary
  console.log('\n' + '='.repeat(90));
  console.log('GRAND SUMMARY');
  console.log('='.repeat(90));
  console.log(`  Sheets compared: ${matched.length}`);
  console.log(`  Old sheets unmatched: ${unmatched.length}`);
  console.log(`  New sheets extra: ${leftoverNew.length}`);
  console.log(`  Total cells matching: ${totalMatches}`);
  console.log(`  Total cells mismatched: ${totalMismatches}`);
  console.log(`  Total cells old-only: ${totalOldOnly}`);
  console.log(`  Total cells new-only: ${totalNewOnly}`);
  console.log(`  Match rate: ${((totalMatches / (totalMatches + totalMismatches + totalOldOnly + totalNewOnly)) * 100).toFixed(1)}%`);
}

main().catch(err => { console.error(err); process.exit(1); });
