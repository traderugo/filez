const ExcelJS = require('exceljs')
const path = require('path')

async function inspect() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path.join(__dirname, '..', '..', 'DOCS', 'LUCKY WAY STATION DAILY SALES REPORT AUGUST 2023.xlsx'))
  const sheet = wb.getWorksheet('01.08')

  // Scan all cells in rows 1-50, cols 1-11 for fill colors
  const fillsByColor = {}
  for (let r = 1; r <= 50; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = sheet.getCell(r, c)
      const f = cell.fill
      if (f && f.pattern === 'solid' && f.fgColor) {
        const argb = f.fgColor.argb || `theme:${f.fgColor.theme}/tint:${f.fgColor.tint}`
        if (!fillsByColor[argb]) fillsByColor[argb] = []
        fillsByColor[argb].push(`R${r}C${c}`)
      }
    }
  }

  console.log('=== Cells grouped by fill color ===')
  for (const [color, cells] of Object.entries(fillsByColor)) {
    console.log(`\n${color}: ${cells.length} cells`)
    console.log('  ', cells.join(', '))
  }
}

inspect().catch(e => { console.error(e); process.exit(1) })
