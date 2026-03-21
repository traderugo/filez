const ExcelJS = require('exceljs')
const path = require('path')

const REF_FILE = path.join(__dirname, 'output', 'LUCKY WAY  WEEKLY STATION Report for JULY 10TH- 16TH 2023.xlsx')
const APP_FILE = path.join(__dirname, 'output', 'app output.xlsx')

function fillKey(fill) {
  if (!fill || fill.pattern === 'none' || !fill.pattern) return 'none'
  const fg = fill.fgColor ? (fill.fgColor.argb || `theme:${fill.fgColor.theme}` || 'unknown') : 'none'
  return `${fill.pattern}:${fg}`
}

function borderSide(b) {
  if (!b) return 'none'
  return b.style || 'none'
}

function borderKey(border) {
  if (!border) return 'none|none|none|none'
  return `T:${borderSide(border.top)}|B:${borderSide(border.bottom)}|L:${borderSide(border.left)}|R:${borderSide(border.right)}`
}

function fontKey(font) {
  if (!font) return 'default'
  return `${font.name||'?'}:${font.size||'?'}:${font.bold?'B':''}:${font.color?.argb||font.color?.theme||'?'}`
}

async function main() {
  const refWb = new ExcelJS.Workbook()
  const appWb = new ExcelJS.Workbook()
  await refWb.xlsx.readFile(REF_FILE)
  await appWb.xlsx.readFile(APP_FILE)

  // Map sheets by name
  const refSheets = {}
  for (const ws of refWb.worksheets) refSheets[ws.name] = ws
  const appSheets = {}
  for (const ws of appWb.worksheets) appSheets[ws.name] = ws

  const allNames = new Set([...Object.keys(refSheets), ...Object.keys(appSheets)])

  for (const name of allNames) {
    const ref = refSheets[name]
    const app = appSheets[name]

    console.log(`\n${'='.repeat(70)}`)
    console.log(`SHEET: ${name}`)
    console.log('='.repeat(70))

    if (!ref) { console.log('  MISSING in reference file'); continue }
    if (!app) { console.log('  MISSING in app output'); continue }

    const maxRow = Math.max(ref.rowCount || 0, app.rowCount || 0)
    const maxCol = Math.max(ref.columnCount || 0, app.columnCount || 0)

    // Fills
    const fillDiffs = []
    // Borders
    const borderDiffs = []
    const borderPatterns = {}
    // Fonts
    const fontDiffs = []
    // NumFmts
    const fmtDiffs = []

    for (let r = 1; r <= maxRow; r++) {
      for (let c = 1; c <= maxCol; c++) {
        const refCell = ref.getRow(r).getCell(c)
        const appCell = app.getRow(r).getCell(c)
        const cellRef = `${String.fromCharCode(c <= 26 ? 64+c : 64+Math.floor((c-1)/26))}${c > 26 ? String.fromCharCode(65+((c-1)%26)) : ''}${r}`

        // Fill comparison
        const refFill = fillKey(refCell.fill)
        const appFill = fillKey(appCell.fill)
        if (refFill !== appFill) {
          fillDiffs.push({ cell: cellRef, r, c, ref: refFill, app: appFill })
        }

        // Border comparison
        const refBorder = borderKey(refCell.border)
        const appBorder = borderKey(appCell.border)
        if (refBorder !== appBorder) {
          borderDiffs.push({ cell: cellRef, r, c, ref: refBorder, app: appBorder })
          const pat = `ref=[${refBorder}] vs app=[${appBorder}]`
          borderPatterns[pat] = (borderPatterns[pat] || 0) + 1
        }

        // Font comparison
        const refFont = fontKey(refCell.font)
        const appFont = fontKey(appCell.font)
        if (refFont !== appFont) {
          // Only report if at least one has meaningful content or styling
          const hasValue = refCell.value || appCell.value
          const refHasStyle = refCell.font?.name
          const appHasStyle = appCell.font?.name
          if (hasValue || refHasStyle || appHasStyle) {
            fontDiffs.push({ cell: cellRef, r, c, ref: refFont, app: appFont })
          }
        }

        // NumFmt comparison
        const refFmt = refCell.numFmt || 'General'
        const appFmt = appCell.numFmt || 'General'
        if (refFmt !== appFmt && (refCell.value || appCell.value)) {
          fmtDiffs.push({ cell: cellRef, ref: refFmt, app: appFmt })
        }
      }
    }

    // Print Fill diffs
    console.log(`\n  FILL DIFFS: ${fillDiffs.length}`)
    if (fillDiffs.length > 0) {
      for (const d of fillDiffs.slice(0, 30)) {
        console.log(`    ${d.cell}: ref=${d.ref}  app=${d.app}`)
      }
      if (fillDiffs.length > 30) console.log(`    ... and ${fillDiffs.length - 30} more`)
    }

    // Print Border diffs
    console.log(`\n  BORDER DIFFS: ${borderDiffs.length}`)
    if (borderDiffs.length > 0) {
      console.log('  Border patterns:')
      const sorted = Object.entries(borderPatterns).sort((a,b) => b[1] - a[1])
      for (const [pat, count] of sorted.slice(0, 20)) {
        console.log(`    ${count}x: ${pat}`)
      }
      console.log('  First 15 specific cells:')
      for (const d of borderDiffs.slice(0, 15)) {
        console.log(`    ${d.cell}: ref=[${d.ref}]  app=[${d.app}]`)
      }
    }

    // Print Font diffs
    console.log(`\n  FONT DIFFS: ${fontDiffs.length}`)
    if (fontDiffs.length > 0) {
      for (const d of fontDiffs.slice(0, 15)) {
        console.log(`    ${d.cell}: ref=${d.ref}  app=${d.app}`)
      }
      if (fontDiffs.length > 15) console.log(`    ... and ${fontDiffs.length - 15} more`)
    }

    // Print NumFmt diffs
    console.log(`\n  NUMFMT DIFFS: ${fmtDiffs.length}`)
    if (fmtDiffs.length > 0) {
      for (const d of fmtDiffs.slice(0, 10)) {
        console.log(`    ${d.cell}: ref="${d.ref}"  app="${d.app}"`)
      }
      if (fmtDiffs.length > 10) console.log(`    ... and ${fmtDiffs.length - 10} more`)
    }

    // Column widths
    const colDiffs = []
    for (let c = 1; c <= maxCol; c++) {
      const rw = ref.getColumn(c).width || 0
      const aw = app.getColumn(c).width || 0
      if (Math.abs(rw - aw) > 0.5) {
        colDiffs.push({ col: c, ref: rw, app: aw })
      }
    }
    console.log(`\n  COL WIDTH DIFFS: ${colDiffs.length}`)
    for (const d of colDiffs) {
      console.log(`    Col ${d.col}: ref=${d.ref}  app=${d.app}`)
    }

    // Merged cells
    const refMerges = ref.model?.merges || []
    const appMerges = app.model?.merges || []
    const refSet = new Set(refMerges.map(m => typeof m === 'string' ? m : ''))
    const appSet = new Set(appMerges.map(m => typeof m === 'string' ? m : ''))
    const missingMerges = [...refSet].filter(m => m && !appSet.has(m))
    const extraMerges = [...appSet].filter(m => m && !refSet.has(m))
    if (missingMerges.length || extraMerges.length) {
      console.log(`\n  MERGE DIFFS:`)
      if (missingMerges.length) console.log(`    Missing in app: ${missingMerges.join(', ')}`)
      if (extraMerges.length) console.log(`    Extra in app: ${extraMerges.join(', ')}`)
    }
  }
}

main().catch(console.error)
