const ExcelJS = require('exceljs');
const path = require('path');

const FILE = path.join(__dirname, 'output', 'LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx');

function printSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
}

function printSubSection(title) {
  console.log('\n--- ' + title + ' ---');
}

function safeJSON(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(FILE);

  console.log('File:', FILE);
  console.log('Sheets:', workbook.worksheets.map(s => s.name));
  console.log('Total sheets:', workbook.worksheets.length);

  for (const sheet of workbook.worksheets) {
    printSection(`SHEET: "${sheet.name}" (id=${sheet.id}, state=${sheet.state})`);

    // 1. Views
    printSubSection('1. Views');
    if (sheet.views && sheet.views.length > 0) {
      for (let i = 0; i < sheet.views.length; i++) {
        const v = sheet.views[i];
        console.log(`  View[${i}]:`, safeJSON(v));
      }
    } else {
      console.log('  No views defined');
    }

    // 2. Page Setup
    printSubSection('2. Page Setup');
    const ps = sheet.pageSetup || {};
    console.log('  orientation:', ps.orientation);
    console.log('  paperSize:', ps.paperSize);
    console.log('  fitToPage:', ps.fitToPage);
    console.log('  fitToWidth:', ps.fitToWidth);
    console.log('  fitToHeight:', ps.fitToHeight);
    console.log('  printArea:', ps.printArea);
    console.log('  horizontalCentered:', ps.horizontalCentered);
    console.log('  verticalCentered:', ps.verticalCentered);
    console.log('  blackAndWhite:', ps.blackAndWhite);
    console.log('  scale:', ps.scale);
    console.log('  margins:', safeJSON(ps.margins));
    console.log('  Full pageSetup:', safeJSON(ps));

    // 3. Sheet Properties
    printSubSection('3. Sheet Properties');
    const props = sheet.properties || {};
    console.log('  tabColor:', safeJSON(props.tabColor));
    console.log('  defaultRowHeight:', props.defaultRowHeight);
    console.log('  defaultColWidth:', props.defaultColWidth);
    console.log('  showGridLines:', props.showGridLines);
    console.log('  Full properties:', safeJSON(props));

    // 4. Header/Footer
    printSubSection('4. Header/Footer');
    const hf = sheet.headerFooter || {};
    console.log('  oddHeader:', hf.oddHeader);
    console.log('  oddFooter:', hf.oddFooter);
    console.log('  evenHeader:', hf.evenHeader);
    console.log('  evenFooter:', hf.evenFooter);
    console.log('  firstHeader:', hf.firstHeader);
    console.log('  firstFooter:', hf.firstFooter);
    console.log('  Full headerFooter:', safeJSON(hf));

    // 5. Fill Analysis
    printSubSection('5. Fill Analysis');
    const fillCounts = {
      noFill: 0,
      patternNone: 0,
      whiteExplicit: 0,
      yellow: 0,
      other: 0,
    };
    const fillExamples = {
      noFill: [],
      patternNone: [],
      whiteExplicit: [],
      yellow: [],
      other: [],
    };
    const MAX_EXAMPLES = 5;

    let totalCells = 0;

    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        totalCells++;
        const fill = cell.fill;
        const addr = cell.address;

        if (!fill || !fill.type) {
          fillCounts.noFill++;
          if (fillExamples.noFill.length < MAX_EXAMPLES) {
            fillExamples.noFill.push(addr);
          }
        } else if (fill.type === 'pattern' && fill.pattern === 'none') {
          fillCounts.patternNone++;
          if (fillExamples.patternNone.length < MAX_EXAMPLES) {
            fillExamples.patternNone.push(addr);
          }
        } else if (fill.type === 'pattern') {
          const fg = fill.fgColor || {};
          const argb = (fg.argb || '').toUpperCase();
          const theme = fg.theme;
          const tint = fg.tint;

          // Check for white: theme:0 with no tint, or argb FFFFFFFF / 00FFFFFF
          const isWhite =
            (theme === 0 && (tint === undefined || tint === null || tint === 0)) ||
            argb === 'FFFFFFFF' ||
            argb === '00FFFFFF';

          // Check for yellow: argb contains FFFF00 or theme:0 with specific tint, etc.
          const isYellow =
            argb.includes('FFFF00') ||
            argb === 'FFFFFF00' ||
            argb === '00FFFF00';

          if (isWhite) {
            fillCounts.whiteExplicit++;
            if (fillExamples.whiteExplicit.length < MAX_EXAMPLES) {
              fillExamples.whiteExplicit.push(`${addr} (${safeJSON(fill)})`);
            }
          } else if (isYellow) {
            fillCounts.yellow++;
            if (fillExamples.yellow.length < MAX_EXAMPLES) {
              fillExamples.yellow.push(`${addr} (${safeJSON(fill)})`);
            }
          } else {
            fillCounts.other++;
            if (fillExamples.other.length < MAX_EXAMPLES) {
              fillExamples.other.push(`${addr} (${safeJSON(fill)})`);
            }
          }
        } else {
          // gradient or other fill type
          fillCounts.other++;
          if (fillExamples.other.length < MAX_EXAMPLES) {
            fillExamples.other.push(`${addr} (${safeJSON(fill)})`);
          }
        }
      });
    });

    console.log(`  Total cells scanned: ${totalCells}`);
    console.log(`  No fill:          ${fillCounts.noFill}  examples: ${fillExamples.noFill.join(', ')}`);
    console.log(`  Pattern 'none':   ${fillCounts.patternNone}  examples: ${fillExamples.patternNone.join(', ')}`);
    console.log(`  Explicit white:   ${fillCounts.whiteExplicit}  examples: ${fillExamples.whiteExplicit.join(', ')}`);
    console.log(`  Yellow:           ${fillCounts.yellow}  examples: ${fillExamples.yellow.join(', ')}`);
    console.log(`  Other fills:      ${fillCounts.other}  examples: ${fillExamples.other.join(', ')}`);

    // Collect unique fill signatures for "other"
    const uniqueOtherFills = new Map();
    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      row.eachCell({ includeEmpty: false }, (cell, colNum) => {
        const fill = cell.fill;
        if (!fill || !fill.type) return;
        if (fill.type === 'pattern' && fill.pattern === 'none') return;
        if (fill.type === 'pattern') {
          const fg = fill.fgColor || {};
          const argb = (fg.argb || '').toUpperCase();
          const theme = fg.theme;
          const tint = fg.tint;
          const isWhite =
            (theme === 0 && (tint === undefined || tint === null || tint === 0)) ||
            argb === 'FFFFFFFF' ||
            argb === '00FFFFFF';
          const isYellow =
            argb.includes('FFFF00') ||
            argb === 'FFFFFF00' ||
            argb === '00FFFF00';
          if (!isWhite && !isYellow) {
            const key = safeJSON(fill);
            if (!uniqueOtherFills.has(key)) {
              uniqueOtherFills.set(key, { count: 0, example: cell.address });
            }
            uniqueOtherFills.get(key).count++;
          }
        }
      });
    });
    if (uniqueOtherFills.size > 0) {
      console.log(`  Unique "other" fill patterns (${uniqueOtherFills.size}):`);
      for (const [key, val] of uniqueOtherFills) {
        console.log(`    count=${val.count}, example=${val.example}, fill=${key}`);
      }
    }

    // 6. Print Area
    printSubSection('6. Print Area');
    console.log('  printArea:', ps.printArea || 'none');

    // 7. Row/Column Breaks
    printSubSection('7. Row/Column Breaks (Page Breaks)');
    const rowBreaks = sheet.rowBreaks || [];
    const colBreaks = sheet.colBreaks || [];
    // Also check via pageSetup
    console.log('  rowBreaks:', safeJSON(rowBreaks));
    console.log('  colBreaks:', safeJSON(colBreaks));
    // Try alternative access
    if (sheet._rows) {
      let breakRows = [];
      sheet.eachRow((row, rowNum) => {
        if (row.hasOwnProperty('_outlineLevel') || row.pageBreak) {
          breakRows.push(rowNum);
        }
      });
      if (breakRows.length > 0) {
        console.log('  Rows with pageBreak:', breakRows);
      }
    }

    // 8. Protection
    printSubSection('8. Protection');
    const prot = sheet.sheetProtection || {};
    const hasProtection = Object.keys(prot).length > 0;
    console.log('  Protected:', hasProtection);
    if (hasProtection) {
      console.log('  sheetProtection:', safeJSON(prot));
    }

    // Extra: Column info
    printSubSection('Extra: Column Widths');
    const colWidths = [];
    sheet.columns.forEach((col, idx) => {
      if (col.width || col.hidden || col.outlineLevel) {
        colWidths.push({
          col: idx + 1,
          letter: col.letter,
          width: col.width,
          hidden: col.hidden,
          outlineLevel: col.outlineLevel,
          style: col.style ? 'has style' : 'none',
        });
      }
    });
    if (colWidths.length > 0) {
      console.log('  Columns with explicit width/hidden/outline:');
      for (const c of colWidths) {
        console.log(`    Col ${c.letter} (${c.col}): width=${c.width}, hidden=${c.hidden}, outline=${c.outlineLevel}`);
      }
    } else {
      console.log('  No columns with explicit width');
    }

    // Extra: Row count and range
    printSubSection('Extra: Row Info');
    let rowCount = 0;
    let minRow = Infinity, maxRow = 0;
    sheet.eachRow((row, rowNum) => {
      rowCount++;
      if (rowNum < minRow) minRow = rowNum;
      if (rowNum > maxRow) maxRow = rowNum;
    });
    console.log(`  Row count: ${rowCount}, range: ${minRow}-${maxRow}`);

    // Extra: Merged cells
    printSubSection('Extra: Merged Cells');
    const merges = sheet.model.merges || [];
    console.log(`  Merged ranges: ${merges.length}`);
    if (merges.length > 0 && merges.length <= 50) {
      for (const m of merges) {
        console.log(`    ${m}`);
      }
    } else if (merges.length > 50) {
      console.log('  (showing first 50)');
      for (let i = 0; i < 50; i++) {
        console.log(`    ${merges[i]}`);
      }
    }
  }
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
