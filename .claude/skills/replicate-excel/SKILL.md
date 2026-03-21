---
name: replicate-excel
description: Replicate an Excel file identically using ExcelJS. Use when the user wants to generate an Excel file that matches a reference file exactly — structure, styling, formulas, views, and all.
argument-hint: [path-to-reference-xlsx]
disable-model-invocation: true
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, Agent
---

# Replicate Excel File

Generate JavaScript/ExcelJS code that produces an Excel file **identical** to the reference file at `$ARGUMENTS`.

## Phase 1: Deep Inspection

Create and run Node.js inspection scripts (using ExcelJS) in the project's `excel/` directory to extract **everything** from the reference file. Run these in parallel where possible.

### Script 1: Structure & Layout
For each sheet, extract:
- Sheet name, visibility (visible/hidden), tab color
- Total rows, total columns used
- Column widths (every column)
- Row heights (non-default only)
- Merged cell ranges
- Default row height, default column width

### Script 2: Cell Content & Formulas
For each sheet, extract:
- Every cell with a value: row, column, value, type (string/number/date/formula/richText)
- Formula cells: the formula string, number format
- Rich text cells: the full richText array with font runs
- Number formats used (unique list per sheet)

### Script 3: Styling — Fonts, Fills, Borders, Alignment
For each sheet, extract:
- Every unique font combination used (name, size, bold, italic, underline, color)
- Every unique fill (pattern type, fgColor, bgColor)
- Every unique border combination (top/bottom/left/right style and color)
- Every unique alignment (horizontal, vertical, wrapText, indent)
- Map each unique style to the cells that use it

### Script 4: Views, Page Setup, Protection
For each sheet, extract:
- `views` array: freeze panes (state, xSplit, ySplit, topLeftCell), view mode (pageBreakPreview/normal), zoomScale, zoomScaleNormal, showGridLines, showRowColHeaders
- `pageSetup`: orientation, paperSize, scale, fitToPage, fitToWidth, fitToHeight, printArea, margins (all 6), horizontalCentered, verticalCentered
- Protection: is sheet protected? What options?
- Header/footer strings

Save all output to `excel/output/reference-analysis.md` for future reference.

## Phase 2: Generate Style Summary

From the inspection data, create a concise style reference document (`excel/output/style-summary.md`) that captures:
- Global font/fill/border/alignment patterns (shared across sheets)
- Per-sheet deviations from the global pattern
- Number format catalog
- Border pattern rules (header rows, data rows, total rows, edge columns)

## Phase 3: Write the ExcelJS Export Function

Create or update the export function following these rules:

### Constants & Helpers
Define reusable constants at the top:
```js
// Fonts — one const per unique font combo
const FONT = { name: 'Corbel', size: 11, color: { theme: 1 } }
const FONT_BOLD = { name: 'Corbel', size: 11, bold: true, color: { theme: 1 } }

// Fills
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }

// Border patterns
// DATA rows: bottom+left+right only (no top) — typical for most Excel templates
const BORDER_DATA = { bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
// HEADER rows: medium top+bottom, thin left+right
const BORDER_HDR = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } }
// TOTAL rows: thin top, double bottom
const BORDER_TOTAL = { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }

// Number formats
const ACCT_FMT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-'
```

### Grid Filling Helpers
**Critical**: Empty cells must still receive borders and fonts. Use helpers:
```js
function fillGrid(ws, startRow, endRow, firstCol, lastCol, font) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = firstCol; c <= lastCol; c++) {
      const cell = ws.getRow(r).getCell(c)
      const hasBorder = cell.border && Object.keys(cell.border).length > 0
      if (!hasBorder) {
        let border = { ...BORDER_DATA }
        if (c === firstCol) border = { ...border, left: { style: 'medium' } }
        if (c === lastCol) border = { ...border, right: { style: 'medium' } }
        cell.border = border
        if (!cell.font || !cell.font.name) cell.font = font
      } else {
        if (c === firstCol) cell.border = { ...cell.border, left: { style: 'medium' } }
        if (c === lastCol) cell.border = { ...cell.border, right: { style: 'medium' } }
      }
    }
  }
}

function fillHeaderRow(ws, row, firstCol, lastCol, font) {
  for (let c = firstCol; c <= lastCol; c++) {
    const cell = ws.getRow(row).getCell(c)
    const hasBorder = cell.border && Object.keys(cell.border).length > 0
    if (!hasBorder) {
      let border = { ...BORDER_HDR }
      if (c === firstCol) border = { ...border, left: { style: 'medium' } }
      if (c === lastCol) border = { ...border, right: { style: 'medium' } }
      cell.border = border
      if (font && (!cell.font || !cell.font.name)) cell.font = font
    } else {
      if (c === firstCol) cell.border = { ...cell.border, left: { style: 'medium' } }
      if (c === lastCol) cell.border = { ...cell.border, right: { style: 'medium' } }
    }
  }
}
```

### Per-Sheet Writer Functions
One function per sheet. Each must:
1. Set column widths exactly matching reference
2. Set non-default row heights
3. Apply merged cells
4. Write all cell values with correct styles
5. Use **Excel formulas** (not pre-computed values) where reference has formulas
6. Use **cross-sheet formula references** where reference does (e.g., `'SheetName'!C8`)
7. Call `fillGrid()` at the end to fill empty cells with borders
8. Call `fillHeaderRow()` for header rows
9. Set views (freeze panes, page break preview, grid lines, zoom)
10. Set page setup (orientation, scale, print area, margins)
11. Set tab color if applicable
12. Set sheet protection if applicable
13. Set sheet visibility (hidden/visible) if applicable

### Formula Rules
- Use Excel formula strings, NOT computed values: `{ formula: 'D10-C10' }`
- Cross-sheet references: `{ formula: "'Sheet Name'!C8" }`
- Sheet names with apostrophes must be escaped: `"'Customers'' Ledger'!C43"`
- SUM ranges for totals: `'SUM(E7:E37)'`
- Yellow fill on all formula/computed cells (if reference does this)

### Dynamic Row Allocation
When template sections have a fixed minimum number of rows but data may exceed it:
```js
const allocated = Math.max(TEMPLATE_MIN, actualData.length)
```
This ensures the layout grows dynamically while maintaining the template minimum.

## Phase 4: Comparison & Verification

Create a comparison script that loads both the reference and app output files side-by-side and reports differences:

### What to compare per cell:
- **Value**: exact match (for strings/numbers), formula string match (for formulas)
- **Border**: all 4 sides — style and color
- **Fill**: pattern, fgColor, bgColor
- **Font**: name, size, bold, italic, underline, color
- **Number format**: exact string match
- **Alignment**: horizontal, vertical, wrapText

### What to compare per sheet:
- Column widths (within 0.5 tolerance)
- Row heights (non-default, within 1.0 tolerance)
- Merged cells (exact match)
- Views/freeze panes
- Sheet visibility
- Tab color

### Output format:
```
=== SheetName ===
MATCH: 450 cells identical
DIFF borders: 12 cells (list first 5)
DIFF fonts: 3 cells (list all)
MISSING values: 0
EXTRA values: 2 (list all)
Column width diffs: D (ref=22.57, app=22.00)
```

## Phase 5: Iterate

Re-run comparison after each fix. Target: **zero differences** across all sheets.

## Common Pitfalls

1. **Empty cells get no borders** — ALWAYS call `fillGrid()` after writing data
2. **Data rows have top border** — Most Excel templates use bottom+left+right only on data rows (no top). Check the reference carefully.
3. **Edge columns need medium borders** — First and last columns of a grid section need `left: medium` and `right: medium`
4. **Merged cell interiors need borders** — Interior cells of merged headers need `top: medium, bottom: medium` only (no left/right)
5. **Grid lines hidden = white appearance** — Set `showGridLines: false` in views, NOT explicit white fill
6. **ExcelJS pageSetup.printArea** — Use cell range string like `'A1:Z175'`
7. **Sheet protection** — `ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })` for basic protection
8. **Hidden sheets** — `wb.addWorksheet('Name', { state: 'hidden' })`
9. **Tab colors** — `wb.addWorksheet('Name', { properties: { tabColor: { argb: 'FFFFFF00' } } })`
10. **Rich text** — Use `{ richText: [{ font: {...}, text: '...' }, ...] }` for mixed formatting in one cell
11. **Date values** — Use `new Date(dateStr + 'T00:00:00')` to avoid timezone issues
12. **Number format strings** — Copy EXACTLY from reference including spaces and special chars

## ExcelJS API Quick Reference

### Worksheet creation
```js
const ws = wb.addWorksheet('Name', {
  state: 'visible', // or 'hidden'
  properties: {
    tabColor: { argb: 'FFFFFF00' },
    defaultRowHeight: 15,
    defaultColWidth: 9.29,
  }
})
```

### Views
```js
ws.views = [{
  state: 'frozen',        // 'frozen' or omit for no freeze
  xSplit: 0,              // columns frozen
  ySplit: 8,              // rows frozen
  topLeftCell: 'A9',      // first unfrozen cell
  style: 'pageBreakPreview', // or omit for normal
  zoomScale: 100,
  zoomScaleNormal: 100,
  showGridLines: false,
}]
```

### Page Setup
```js
ws.pageSetup = {
  orientation: 'portrait', // or 'landscape'
  paperSize: 9,            // A4
  scale: 100,              // print scale percentage
  fitToPage: false,
  fitToWidth: 1,
  fitToHeight: 1,
  printArea: 'A1:Z175',
  margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  horizontalCentered: false,
  verticalCentered: false,
}
```

### Protection
```js
ws.protect('password', {
  selectLockedCells: true,
  selectUnlockedCells: true,
})
```

### Column letter helper
```js
function colLetter(c) {
  if (c <= 26) return String.fromCharCode(64 + c)
  return String.fromCharCode(64 + Math.floor((c - 1) / 26)) + String.fromCharCode(65 + ((c - 1) % 26))
}
```
