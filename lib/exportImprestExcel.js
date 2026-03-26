import ExcelJS from 'exceljs'

// ── Styles ───────────────────────────────────────────────────────────────────
const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' }, bgColor: { indexed: 64 } }
const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' }, bgColor: { indexed: 64 } }
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' }, bgColor: { indexed: 64 } }
const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' }, bgColor: { indexed: 64 } }
const PEACH_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBE4D5' }, bgColor: { indexed: 64 } }
const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E3F3' }, bgColor: { indexed: 64 } }
const NO_FILL = { type: 'pattern', pattern: 'none' }

const MED = (argb) => ({ style: 'medium', color: { argb } })
const THIN = (argb) => ({ style: 'thin', color: { argb } })
const BORDER_MED = { top: MED('FF000000'), left: MED('FF000000'), bottom: MED('FF000000'), right: MED('FF000000') }
const BORDER_THIN = { top: THIN('FF000000'), left: THIN('FF000000'), bottom: THIN('FF000000'), right: THIN('FF000000') }
const BORDER_MIX = { top: MED('FF000000'), left: MED('FF000000'), bottom: THIN('FF000000'), right: MED('FF000000') }

const FONT_CORBEL = { name: 'Corbel', family: 2, size: 12, color: { theme: 1 } }
const FONT_CORBEL_BOLD = { ...FONT_CORBEL, bold: true }
const FONT_CORBEL_NAVY = { name: 'Corbel', family: 2, size: 12, bold: true, color: { argb: 'FF002060' } }
const FONT_CORBEL_WHITE = { name: 'Corbel', family: 2, size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
const FONT_CALIBRI = { name: 'Calibri', family: 2, size: 11, color: { argb: 'FF000000' } }
const FONT_CALIBRI_BOLD = { ...FONT_CALIBRI, bold: true }

const ALIGN_CM = { horizontal: 'center', vertical: 'middle' }
const ALIGN_LM = { horizontal: 'left', vertical: 'middle' }
const ALIGN_RM = { horizontal: 'right', vertical: 'middle' }
const ALIGN_LT = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 }

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

function sc(ws, r, c, value, font, fill, alignment, border) {
  const cell = ws.getCell(r, c)
  cell.value = value ?? null
  cell.font = font || FONT_CORBEL
  cell.fill = fill || NO_FILL
  cell.alignment = alignment || ALIGN_CM
  cell.border = border || BORDER_MED
  return cell
}

function fmtDateDDMMYYYY(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function numberToWords(n) {
  if (n === 0) return 'ZERO NAIRA ONLY'
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
  const scales = ['', 'THOUSAND', 'MILLION', 'BILLION']

  const num = Math.abs(Math.round(n))
  if (num === 0) return 'ZERO NAIRA ONLY'

  const chunks = []
  let temp = num
  while (temp > 0) {
    chunks.push(temp % 1000)
    temp = Math.floor(temp / 1000)
  }

  const parts = []
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i]
    if (chunk === 0) continue
    const h = Math.floor(chunk / 100)
    const rem = chunk % 100
    let s = ''
    if (h > 0) s += ones[h] + ' HUNDRED'
    if (rem > 0) {
      if (h > 0) s += ' AND '
      if (rem < 20) s += ones[rem]
      else {
        s += tens[Math.floor(rem / 10)]
        if (rem % 10 > 0) s += '-' + ones[rem % 10]
      }
    }
    if (scales[i]) s += ' ' + scales[i]
    parts.push(s)
  }

  return parts.join(', ') + ' NAIRA ONLY'
}

/**
 * Export imprest data as Excel matching the reference template exactly.
 */
export async function exportImprestExcel({ month, year, imprestAmount, custodianName, formNumber, entries, totalSpent, balance }) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')

  // Column widths (A=1 through M=13)
  const widths = [7.29, 11.29, 6.71, 29.29, 9.14, 80.71, 9, 7.86, 6, 5.86, 10.86, 9.14, 9.14]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const monthName = MONTHS[month - 1] || ''

  // ── Row 1: Company header (merged A1:M1) ──
  ws.getRow(1).height = 30
  for (let c = 1; c <= 13; c++) sc(ws, 1, c, null, FONT_CORBEL, WHITE_FILL, ALIGN_LT, BORDER_MED)
  ws.mergeCells('A1:M1')
  ws.getCell('A1').value = {
    richText: [
      { text: 'Rainoil Limited\n', font: { ...FONT_CORBEL_NAVY, size: 12 } },
      { text: '7a Adeyemo Alakija Street, Victoria Island, Lagos', font: { name: 'Corbel', family: 2, size: 10, color: { theme: 1 } } },
    ]
  }

  // ── Row 2: Title banner (merged A2:M2) ──
  ws.getRow(2).height = 25
  for (let c = 1; c <= 13; c++) sc(ws, 2, c, 'PETTY CASH REPLENISHMENT FORM', FONT_CORBEL_WHITE, NAVY_FILL, ALIGN_CM, BORDER_MED)
  ws.mergeCells('A2:M2')

  // ── Row 3: Blank separator ──
  ws.getRow(3).height = 10
  for (let c = 1; c <= 13; c++) sc(ws, 3, c, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)
  ws.mergeCells('A3:L3')

  // ── Row 4: Custodian name + date ──
  ws.getRow(4).height = 20
  sc(ws, 4, 1, 'Name of Petty Cash Custodian', FONT_CORBEL_BOLD, WHITE_FILL, ALIGN_LM, BORDER_MED)
  ws.mergeCells('A4:C4')
  sc(ws, 4, 4, custodianName?.toUpperCase() || '', FONT_CORBEL, NO_FILL, ALIGN_LM, BORDER_MED)
  ws.mergeCells('D4:E4')
  for (let c = 6; c <= 8; c++) sc(ws, 4, c, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)
  sc(ws, 4, 9, 'Date:', FONT_CORBEL_BOLD, NO_FILL, ALIGN_RM, BORDER_MED)
  ws.mergeCells('I4:J4')
  sc(ws, 4, 11, fmtDateDDMMYYYY(`${year}-${String(month).padStart(2, '0')}-01`), FONT_CORBEL, YELLOW_FILL, ALIGN_CM, BORDER_MED)
  sc(ws, 4, 12, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)
  sc(ws, 4, 13, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)

  // ── Row 5: Blank ──
  ws.getRow(5).height = 10
  for (let c = 1; c <= 13; c++) sc(ws, 5, c, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)

  // ── Row 6: Station + form number ──
  ws.getRow(6).height = 20
  sc(ws, 6, 1, 'Station:', FONT_CORBEL_BOLD, NO_FILL, ALIGN_LM, BORDER_MED)
  ws.mergeCells('A6:C6')
  sc(ws, 6, 4, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)
  sc(ws, 6, 5, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)
  for (let c = 6; c <= 8; c++) sc(ws, 6, c, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)
  sc(ws, 6, 9, 'Form no:', FONT_CORBEL_BOLD, NO_FILL, ALIGN_RM, BORDER_MED)
  ws.mergeCells('I6:J6')
  sc(ws, 6, 11, formNumber || '', FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)
  ws.mergeCells('K6:L6')
  sc(ws, 6, 13, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)

  // ── Row 7: Spacer ──
  ws.getRow(7).height = 8.25

  // ── Row 8: Table headers ──
  ws.getRow(8).height = 30
  const headers = [
    [1, 1, 'S/N'],
    [2, 3, 'Date(dd-mm-yy)'],
    [4, 4, 'Beneficiary Name'],
    [5, 6, 'Transaction Details'],
    [7, 8, 'Amount(N)'],
    [9, 10, 'Account Code'],
    [11, 12, 'PCV Number'],
  ]
  for (const [startC, endC, label] of headers) {
    for (let c = startC; c <= endC; c++) sc(ws, 8, c, label, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, BORDER_MED)
    if (startC !== endC) ws.mergeCells(8, startC, 8, endC)
  }
  sc(ws, 8, 13, null, FONT_CORBEL, NO_FILL, ALIGN_CM, BORDER_MED)

  // ── Rows 9-35: Data rows (up to 27 entries) ──
  const DATA_START = 9
  const DATA_END = 35
  const dataRowCount = DATA_END - DATA_START + 1

  for (let i = 0; i < dataRowCount; i++) {
    const r = DATA_START + i
    const entry = entries[i] || null
    ws.getRow(r).height = entry ? 25.5 : 16.5
    const font = entry ? FONT_CORBEL : FONT_CALIBRI
    const border = BORDER_THIN

    sc(ws, r, 1, entry ? i + 1 : null, font, NO_FILL, ALIGN_CM, border)
    // Date (B:C merged)
    sc(ws, r, 2, entry ? fmtDateDDMMYYYY(entry.entry_date) : null, font, NO_FILL, ALIGN_CM, border)
    sc(ws, r, 3, null, font, NO_FILL, ALIGN_CM, border)
    ws.mergeCells(r, 2, r, 3)
    // Beneficiary
    sc(ws, r, 4, entry?.beneficiary || null, font, NO_FILL, ALIGN_LM, border)
    // Transaction details (E:F merged)
    sc(ws, r, 5, entry?.transaction_details || null, font, NO_FILL, ALIGN_LM, border)
    sc(ws, r, 6, null, font, NO_FILL, ALIGN_LM, border)
    ws.mergeCells(r, 5, r, 6)
    // Amount (G:H merged)
    const amt = entry ? Number(entry.amount) || 0 : null
    const amtCell = sc(ws, r, 7, amt, font, NO_FILL, ALIGN_RM, border)
    sc(ws, r, 8, null, font, NO_FILL, ALIGN_RM, border)
    ws.mergeCells(r, 7, r, 8)
    if (amt != null) amtCell.numFmt = '#,##0'
    // Account code (I:J merged)
    sc(ws, r, 9, entry?.account_code || null, font, NO_FILL, ALIGN_CM, border)
    sc(ws, r, 10, null, font, NO_FILL, ALIGN_CM, border)
    ws.mergeCells(r, 9, r, 10)
    // PCV number (K:L merged)
    sc(ws, r, 11, entry?.pcv_number || null, font, NO_FILL, ALIGN_CM, border)
    sc(ws, r, 12, null, font, NO_FILL, ALIGN_CM, border)
    ws.mergeCells(r, 11, r, 12)
    // M
    sc(ws, r, 13, null, font, NO_FILL, ALIGN_CM, border)
  }

  // ── Rows 36-39: Summary ──
  // Row 36: blank
  ws.getRow(36).height = 16.5
  for (let c = 1; c <= 13; c++) sc(ws, 36, c, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)

  // Row 37: Balance
  ws.getRow(37).height = 16.5
  sc(ws, 37, 1, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  sc(ws, 37, 2, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  sc(ws, 37, 3, 'BALANCE', FONT_CORBEL_BOLD, NO_FILL, ALIGN_LM, BORDER_THIN)
  for (let c = 4; c <= 7; c++) sc(ws, 37, c, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  ws.mergeCells('C37:G37')
  const balCell = sc(ws, 37, 8, balance, FONT_CORBEL_BOLD, NO_FILL, ALIGN_RM, BORDER_THIN)
  balCell.numFmt = '_(* #,##0_);_(* (#,##0);_(* "-"_);_(@_)'
  sc(ws, 37, 9, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  ws.mergeCells('H37:I37')
  for (let c = 10; c <= 13; c++) sc(ws, 37, c, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)

  // Row 38: Imprest amount
  ws.getRow(38).height = 16.5
  sc(ws, 38, 1, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  sc(ws, 38, 2, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  sc(ws, 38, 3, 'IMPREST AMOUNT', FONT_CORBEL_BOLD, GRAY_FILL, ALIGN_LM, BORDER_THIN)
  for (let c = 4; c <= 7; c++) sc(ws, 38, c, null, FONT_CALIBRI, GRAY_FILL, ALIGN_CM, BORDER_THIN)
  ws.mergeCells('C38:G38')
  const impCell = sc(ws, 38, 8, imprestAmount, FONT_CORBEL_BOLD, GRAY_FILL, ALIGN_RM, BORDER_THIN)
  impCell.numFmt = '#,##0'
  sc(ws, 38, 9, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  ws.mergeCells('H38:I38')
  for (let c = 10; c <= 13; c++) sc(ws, 38, c, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)

  // Row 39: Total spent
  ws.getRow(39).height = 16.5
  sc(ws, 39, 1, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  sc(ws, 39, 2, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  sc(ws, 39, 3, 'TOTAL AMOUNT SPENT', FONT_CORBEL_BOLD, PEACH_FILL, ALIGN_LM, BORDER_THIN)
  for (let c = 4; c <= 7; c++) sc(ws, 39, c, null, FONT_CALIBRI, PEACH_FILL, ALIGN_CM, BORDER_THIN)
  ws.mergeCells('C39:G39')
  const spentCell = sc(ws, 39, 8, { formula: `SUM(G${DATA_START}:H${DATA_END})` }, FONT_CORBEL_BOLD, PEACH_FILL, ALIGN_RM, BORDER_THIN)
  spentCell.numFmt = '#,##0'
  sc(ws, 39, 9, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)
  ws.mergeCells('H39:I39')
  for (let c = 10; c <= 13; c++) sc(ws, 39, c, null, FONT_CALIBRI, NO_FILL, ALIGN_CM, BORDER_THIN)

  // ── Rows 40-41: Blank ──
  for (let r = 40; r <= 41; r++) {
    ws.getRow(r).height = 15
  }

  // ── Row 42: Amount in words ──
  ws.getRow(42).height = 20
  sc(ws, 42, 4, numberToWords(totalSpent), FONT_CORBEL_BOLD, YELLOW_FILL, ALIGN_LM)

  // ── Rows 44-52: Signature block ──
  ws.getRow(44).height = 15
  sc(ws, 44, 12, 'Approved By:', FONT_CORBEL_BOLD, NO_FILL, ALIGN_LM)
  ws.mergeCells('L44:N44')

  // Prepared by
  ws.getRow(45).height = 16.5
  sc(ws, 45, 3, 'Prepared by:', FONT_CORBEL_BOLD, NO_FILL, ALIGN_LM)
  ws.mergeCells('C45:D45')
  sc(ws, 45, 12, '', FONT_CORBEL, YELLOW_FILL, ALIGN_CM)
  ws.mergeCells('L45:N45')

  // Names
  ws.getRow(46).height = 16.5
  sc(ws, 46, 3, '', FONT_CORBEL, YELLOW_FILL, ALIGN_CM)
  ws.mergeCells('C46:D46')
  sc(ws, 46, 12, '', FONT_CORBEL, NO_FILL, ALIGN_CM)
  ws.mergeCells('L46:N46')

  // Dates
  ws.getRow(47).height = 16.5
  sc(ws, 47, 3, '', FONT_CORBEL, NO_FILL, ALIGN_CM)
  ws.mergeCells('C47:D47')
  sc(ws, 47, 12, '', FONT_CORBEL, NO_FILL, ALIGN_CM)
  ws.mergeCells('L47:N47')

  // Row 49: blank
  // Row 50: Custodian
  ws.getRow(50).height = 16.5
  sc(ws, 50, 3, custodianName?.toUpperCase() || '', FONT_CORBEL, YELLOW_FILL, ALIGN_CM)
  ws.mergeCells('C50:D50')

  ws.getRow(51).height = 16.5
  sc(ws, 51, 3, 'Petty Cash Custodian', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM)
  ws.mergeCells('C51:D51')
  sc(ws, 51, 13, 'Manager', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM)
  ws.mergeCells('M51:N51')

  ws.getRow(52).height = 16.5
  sc(ws, 52, 3, '', FONT_CORBEL, NO_FILL, ALIGN_CM)
  ws.mergeCells('C52:D52')
  sc(ws, 52, 13, '', FONT_CORBEL, NO_FILL, ALIGN_CM)
  ws.mergeCells('M52:N52')

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `IMPREST FOR THE MONTH OF ${monthName} ${year}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
