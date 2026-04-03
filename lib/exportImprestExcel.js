import ExcelJS from 'exceljs'

// ── Styles ───────────���───────────────────────────────────────────────────────
const NAVY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' }, bgColor: { indexed: 64 } }
const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' }, bgColor: { argb: 'FF000000' } }
const YELLOW_FILL = { type: 'pattern', pattern: 'solid', fgColor: { indexed: 9 }, bgColor: { indexed: 64 } }
const GRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' }, bgColor: { indexed: 64 } }
const PEACH_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBE4D5' }, bgColor: { indexed: 64 } }
const LTGRAY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' }, bgColor: { indexed: 64 } }
const NO_FILL = { type: 'pattern', pattern: 'none' }

const MED = (c) => ({ style: 'medium', color: c || { indexed: 64 } })
const THIN = (c) => ({ style: 'thin', color: c || { indexed: 64 } })

const FONT_CORBEL = { name: 'Corbel', family: 2, size: 12 }
const FONT_CORBEL_BOLD = { ...FONT_CORBEL, bold: true }
const FONT_CORBEL_NAVY = { name: 'Corbel', family: 2, size: 12, bold: true, color: { argb: 'FF002060' } }
const FONT_CORBEL_NAVY_ADDR = { name: 'Corbel', family: 2, size: 12, color: { indexed: 56 } }
const FONT_CORBEL_NAVY_ADDR_BOLD = { name: 'Corbel', family: 2, size: 12, bold: true, color: { indexed: 56 } }
const FONT_CORBEL_WHITE = { name: 'Corbel', family: 2, size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
const FONT_CORBEL_UL = { name: 'Corbel', family: 2, size: 12, bold: true, underline: true, color: { indexed: 8 } }
const FONT_CALIBRI = { name: 'Calibri', family: 2, size: 11, color: { argb: 'FF000000' } }

const ALIGN_CM = { horizontal: 'center', vertical: 'middle' }
const ALIGN_LM = { horizontal: 'left', vertical: 'middle' }
const ALIGN_LM_WRAP = { horizontal: 'left', vertical: 'middle', wrapText: true }
const ALIGN_LM_WRAP_IN = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 }
const ALIGN_LT_WRAP_IN = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 }
const ALIGN_CM_WRAP = { horizontal: 'center', vertical: 'middle', wrapText: true }
const ALIGN_RM = { horizontal: 'right', vertical: 'middle' }
const ALIGN_RM_WRAP = { horizontal: 'right', vertical: 'middle', wrapText: true }

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

function sc(ws, r, c, value, font, fill, alignment, border) {
  const cell = ws.getCell(r, c)
  cell.value = value ?? null
  if (font) cell.font = font
  if (fill) cell.fill = fill
  if (alignment) cell.alignment = alignment
  if (border) cell.border = border
  return cell
}

function fmtDateDDMMYYYY(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate()
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
export async function exportImprestExcel({ month, year, imprestAmount, custodianName, formNumber, entries, totalSpent, balance, stationName, stationCode }) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')

  // Column widths (A=1 through S=19)
  const widths = [7.29, 11.29, 6.71, 29.29, 9.14, 80.71, 9, 7.86, 6, 5.86, 10.86, 9.14, 9.14, 9.14, 9.14, 9.14, 9.14, 9.14, 9.14]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const monthName = MONTHS[month - 1] || ''
  const lastDay = lastDayOfMonth(year, month)
  const dateStr = `${lastDay}/${String(month).padStart(2, '0')}/${year}`

  // Border helpers for header area
  const B_LTB = { left: MED(), top: MED(), bottom: MED() }
  const B_TB = { top: MED(), bottom: MED() }
  const B_RTB = { right: MED(), top: MED(), bottom: MED() }
  const B_LRTB = { left: MED(), right: MED(), top: MED(), bottom: MED() }

  // ── Row 1: Company header (merged A1:M1) ──
  ws.getRow(1).height = 16.5
  for (let c = 1; c <= 13; c++) {
    const cell = ws.getCell(1, c)
    cell.font = FONT_CORBEL_NAVY
    cell.fill = NO_FILL
    cell.alignment = ALIGN_LT_WRAP_IN
    cell.border = B_LTB
  }
  ws.mergeCells('A1:M1')
  ws.getCell('A1').value = {
    richText: [
      { text: '\nRainoil Limited\n', font: FONT_CORBEL_NAVY },
      { text: '50B Abba Johnson Crescent,\nAkora Estate, Off Adeniyi Jones Avenue, Ikeja.\nTel: 0706 302 9061, 0706 300 1146', font: FONT_CORBEL_NAVY_ADDR },
      { text: '\n', font: FONT_CORBEL_NAVY_ADDR_BOLD },
    ]
  }

  // ── Row 2: Title banner (merged A2:M2) ──
  ws.getRow(2).height = 16.5
  for (let c = 1; c <= 13; c++) sc(ws, 2, c, 'PETTY CASH REPLENISHMENT FORM', FONT_CORBEL_WHITE, NAVY_FILL, { ...ALIGN_CM, wrapText: true }, B_LTB)
  ws.mergeCells('A2:M2')

  // ���─ Row 3: Blank separator ──
  ws.getRow(3).height = 16.5
  for (let c = 1; c <= 13; c++) sc(ws, 3, c, null, FONT_CORBEL, NO_FILL, ALIGN_CM, null)
  ws.mergeCells('A3:L3')

  // ── Row 4: Custodian name + date ──
  ws.getRow(4).height = 32.25
  // A4:C4 - label
  for (let c = 1; c <= 3; c++) sc(ws, 4, c, 'Name of Petty Cash Custodian', FONT_CORBEL_BOLD, WHITE_FILL, ALIGN_LM_WRAP_IN, B_LTB)
  ws.mergeCells('A4:C4')
  // D4:E4 - custodian name
  sc(ws, 4, 4, custodianName?.toUpperCase() || '', FONT_CORBEL, WHITE_FILL, ALIGN_LM_WRAP, B_LRTB)
  sc(ws, 4, 5, null, FONT_CORBEL, WHITE_FILL, ALIGN_LM_WRAP, B_LRTB)
  ws.mergeCells('D4:E4')
  // F4:H4 - blank
  for (let c = 6; c <= 8; c++) sc(ws, 4, c, null, FONT_CORBEL, NO_FILL, ALIGN_CM, B_TB)
  // I4:J4 - Date label
  sc(ws, 4, 9, 'Date', FONT_CORBEL_BOLD, NO_FILL, { vertical: 'middle', wrapText: true }, B_LTB)
  sc(ws, 4, 10, null, FONT_CORBEL_BOLD, NO_FILL, { vertical: 'middle', wrapText: true }, B_TB)
  ws.mergeCells('I4:J4')
  // K4 - date value
  sc(ws, 4, 11, dateStr, FONT_CORBEL, YELLOW_FILL, ALIGN_CM_WRAP, B_TB)
  // L4 - second date field
  sc(ws, 4, 12, null, FONT_CORBEL, YELLOW_FILL, ALIGN_CM_WRAP, B_RTB)
  // M4
  sc(ws, 4, 13, null, FONT_CORBEL, NO_FILL, ALIGN_CM, null)

  // ── Row 5: Blank ��─
  ws.getRow(5).height = 24
  for (let c = 1; c <= 13; c++) sc(ws, 5, c, null, FONT_CORBEL, NO_FILL, ALIGN_CM, null)

  // ── Row 6: Station + form number ──
  ws.getRow(6).height = 16.5
  // A6:C6 - blank (formatted as label area)
  for (let c = 1; c <= 3; c++) sc(ws, 6, c, null, FONT_CORBEL_BOLD, WHITE_FILL, ALIGN_LM_WRAP_IN, B_LTB)
  ws.mergeCells('A6:C6')
  // D6 - station code/name short
  sc(ws, 6, 4, stationCode || '', FONT_CORBEL, WHITE_FILL, ALIGN_LM_WRAP, B_LRTB)
  // E6
  sc(ws, 6, 5, null, FONT_CORBEL, WHITE_FILL, ALIGN_LM_WRAP, null)
  // F6:H6
  for (let c = 6; c <= 8; c++) sc(ws, 6, c, null, FONT_CORBEL_BOLD, WHITE_FILL, ALIGN_LM_WRAP, null)
  // I6:J6 - Form Number label
  sc(ws, 6, 9, 'Form Number', FONT_CORBEL_BOLD, NO_FILL, { vertical: 'middle', wrapText: true }, B_LTB)
  sc(ws, 6, 10, null, FONT_CORBEL_BOLD, NO_FILL, { vertical: 'middle', wrapText: true }, B_TB)
  ws.mergeCells('I6:J6')
  // K6:L6 - form number value
  sc(ws, 6, 11, formNumber || '', FONT_CORBEL, YELLOW_FILL, ALIGN_CM_WRAP, B_LTB)
  sc(ws, 6, 12, null, FONT_CORBEL, YELLOW_FILL, ALIGN_CM_WRAP, B_TB)
  ws.mergeCells('K6:L6')
  // M6
  sc(ws, 6, 13, null, FONT_CORBEL, NO_FILL, ALIGN_CM, null)

  // ���─ Row 7: Spacer ──
  ws.getRow(7).height = 8.25

  // ── Row 8: Table headers ──
  ws.getRow(8).height = 16.5
  // S/N (A8)
  sc(ws, 8, 1, 'S/N', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, { left: MED(), right: THIN(), top: MED(), bottom: MED() })
  // Date (B8:C8)
  sc(ws, 8, 2, 'Date\n(dd-mm-yy)', FONT_CORBEL_BOLD, NO_FILL, ALIGN_LM_WRAP, { left: THIN(), top: MED(), bottom: MED() })
  sc(ws, 8, 3, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_LM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('B8:C8')
  // Beneficiary Name (D8)
  sc(ws, 8, 4, 'Beneficiary Name', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, { left: THIN(), right: THIN(), top: MED(), bottom: MED() })
  // Transaction Details (E8:F8)
  sc(ws, 8, 5, 'Transaction Details', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, { left: THIN(), top: MED(), bottom: MED() })
  sc(ws, 8, 6, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, { top: MED(), bottom: MED() })
  ws.mergeCells('E8:F8')
  // Amount (N) (G8:H8)
  sc(ws, 8, 7, 'Amount (N)', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, { left: THIN(), top: MED() })
  sc(ws, 8, 8, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, { top: MED() })
  ws.mergeCells('G8:H8')
  // Account Code (I8:J8)
  sc(ws, 8, 9, 'Account Code', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { left: MED(), top: MED(), bottom: THIN() })
  sc(ws, 8, 10, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { top: MED(), bottom: THIN() })
  ws.mergeCells('I8:J8')
  // PCV Number (K8:L8)
  sc(ws, 8, 11, 'PCV Number', FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { left: MED(), top: MED(), bottom: THIN() })
  sc(ws, 8, 12, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { top: MED(), bottom: THIN() })
  ws.mergeCells('K8:L8')
  // M8
  sc(ws, 8, 13, null, FONT_CORBEL, NO_FILL, ALIGN_CM, null)

  // ── Rows 9-25: Data rows (up to 17 entries with single-height rows) ──
  const DATA_START = 9
  const SINGLE_ROW_END = 25 // rows 9-25 = 17 single-height data rows
  const PAIRED_ROW_START = 26
  const PAIRED_ROW_END = 35 // rows 26-35 = 5 paired (2-row) data rows = 10 rows
  const TOTAL_DATA_SLOTS = 17 + 5 // 22 entry slots total (matching reference S/N up to 22)

  // Fill single-height data rows (9-25)
  for (let i = 0; i < 17; i++) {
    const r = DATA_START + i
    const entry = entries[i] || null
    ws.getRow(r).height = entry ? 31.5 : 24

    const font = entry ? FONT_CORBEL : FONT_CORBEL
    // S/N
    sc(ws, r, 1, entry ? i + 1 : null, font, NO_FILL, ALIGN_CM_WRAP, { left: MED(), right: THIN(), bottom: THIN() })
    // Date (B:C merged)
    sc(ws, r, 2, entry ? fmtDateDDMMYYYY(entry.entry_date) : null, font, NO_FILL, ALIGN_CM_WRAP, { left: THIN(), right: THIN(), top: THIN(), bottom: THIN() })
    sc(ws, r, 3, null, font, NO_FILL, ALIGN_CM_WRAP, { top: THIN(), bottom: THIN() })
    ws.mergeCells(r, 2, r, 3)
    // Beneficiary
    sc(ws, r, 4, entry?.beneficiary || null, font, NO_FILL, ALIGN_LM_WRAP, { left: THIN(), right: THIN(), bottom: THIN() })
    // Transaction details (E:F merged)
    sc(ws, r, 5, entry?.transaction_details || null, font, NO_FILL, ALIGN_LM_WRAP, { left: THIN(), top: MED(), bottom: THIN() })
    sc(ws, r, 6, null, font, NO_FILL, ALIGN_LM_WRAP, { bottom: THIN() })
    ws.mergeCells(r, 5, r, 6)
    // Amount (G:H merged)
    const amt = entry ? Number(entry.amount) || 0 : null
    const amtCell = sc(ws, r, 7, amt, font, NO_FILL, ALIGN_RM_WRAP, { left: THIN(), top: THIN(), bottom: THIN() })
    sc(ws, r, 8, null, font, NO_FILL, ALIGN_RM_WRAP, { top: THIN(), bottom: THIN() })
    ws.mergeCells(r, 7, r, 8)
    if (amt != null) amtCell.numFmt = '#,##0'
    // Account code (I:J)
    sc(ws, r, 9, entry?.account_code || null, font, NO_FILL, ALIGN_CM, { left: THIN(), right: THIN(), bottom: THIN() })
    sc(ws, r, 10, null, font, NO_FILL, ALIGN_CM, { right: THIN(), bottom: THIN() })
    // PCV number (K:L)
    sc(ws, r, 11, entry?.pcv_number || null, font, NO_FILL, ALIGN_CM, { left: THIN(), right: THIN(), bottom: THIN() })
    sc(ws, r, 12, null, font, NO_FILL, ALIGN_CM, { right: THIN(), bottom: THIN() })
    // M
    sc(ws, r, 13, null, FONT_CORBEL, NO_FILL, ALIGN_CM, null)
  }

  // ── Rows 26-35: Paired (2-row-high) data rows ──
  for (let i = 0; i < 5; i++) {
    const r = PAIRED_ROW_START + i * 2
    const entryIdx = 17 + i
    const entry = entries[entryIdx] || null
    const sn = entryIdx + 1

    // Both rows of the pair
    for (let row = r; row <= r + 1; row++) {
      ws.getRow(row).height = undefined // default height
    }

    // S/N (A merged over 2 rows)
    sc(ws, r, 1, entry ? sn : sn, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN(), top: THIN() })
    sc(ws, r + 1, 1, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN() })
    ws.mergeCells(r, 1, r + 1, 1)

    // Date (B merged over 2 rows)
    sc(ws, r, 2, entry ? fmtDateDDMMYYYY(entry.entry_date) : null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN(), top: THIN() })
    sc(ws, r + 1, 2, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN() })
    ws.mergeCells(r, 2, r + 1, 2)

    // C merged over 2 rows
    sc(ws, r, 3, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { top: THIN() })
    sc(ws, r + 1, 3, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, null)
    ws.mergeCells(r, 3, r + 1, 3)

    // Beneficiary (D merged over 2 rows)
    sc(ws, r, 4, entry?.beneficiary || null, FONT_CALIBRI, NO_FILL, { horizontal: 'left' }, { left: THIN(), right: THIN(), top: THIN() })
    sc(ws, r + 1, 4, null, FONT_CALIBRI, NO_FILL, { horizontal: 'left' }, { left: THIN(), right: THIN() })
    ws.mergeCells(r, 4, r + 1, 4)

    // Transaction details (E:F merged over 2 rows)
    sc(ws, r, 5, entry?.transaction_details || null, FONT_CALIBRI, NO_FILL, { horizontal: 'left' }, { left: THIN(), top: THIN() })
    sc(ws, r, 6, null, FONT_CALIBRI, NO_FILL, { horizontal: 'left' }, { right: THIN(), top: THIN() })
    sc(ws, r + 1, 5, null, FONT_CALIBRI, NO_FILL, { horizontal: 'left' }, { left: THIN() })
    sc(ws, r + 1, 6, null, FONT_CALIBRI, NO_FILL, { horizontal: 'left' }, { right: THIN() })
    ws.mergeCells(r, 5, r + 1, 6)

    // Amount (G:H merged over 2 rows)
    const amt = entry ? Number(entry.amount) || 0 : null
    const amtCell = sc(ws, r, 7, amt, FONT_CALIBRI, NO_FILL, { horizontal: 'right' }, { left: THIN(), top: THIN() })
    sc(ws, r, 8, null, FONT_CALIBRI, NO_FILL, { horizontal: 'right' }, { right: THIN(), top: THIN() })
    sc(ws, r + 1, 7, null, FONT_CALIBRI, NO_FILL, { horizontal: 'right' }, { left: THIN() })
    sc(ws, r + 1, 8, null, FONT_CALIBRI, NO_FILL, { horizontal: 'right' }, { right: THIN() })
    ws.mergeCells(r, 7, r + 1, 8)
    if (amt != null) amtCell.numFmt = '#,##0'

    // Account code (I merged, J merged)
    sc(ws, r, 9, entry?.account_code || null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN(), top: THIN() })
    sc(ws, r + 1, 9, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN() })
    ws.mergeCells(r, 9, r + 1, 9)
    sc(ws, r, 10, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { right: THIN(), top: THIN() })
    sc(ws, r + 1, 10, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { right: THIN() })
    ws.mergeCells(r, 10, r + 1, 10)

    // PCV (K merged, L merged)
    sc(ws, r, 11, entry?.pcv_number || null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN(), top: THIN() })
    sc(ws, r + 1, 11, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { left: THIN(), right: THIN() })
    ws.mergeCells(r, 11, r + 1, 11)
    sc(ws, r, 12, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { right: THIN(), top: THIN() })
    sc(ws, r + 1, 12, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, { right: THIN() })
    ws.mergeCells(r, 12, r + 1, 12)

    // M merged
    sc(ws, r, 13, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, null)
    sc(ws, r + 1, 13, null, FONT_CALIBRI, NO_FILL, { horizontal: 'center' }, null)
    ws.mergeCells(r, 13, r + 1, 13)
  }

  // ── Row 36: Blank separator ──
  ws.getRow(36).height = 16.5
  // C36:G36 merged
  sc(ws, 36, 3, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { bottom: MED() })
  for (let c = 4; c <= 7; c++) sc(ws, 36, c, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { bottom: MED() })
  ws.mergeCells('C36:G36')
  // H36:I36
  sc(ws, 36, 8, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, null)
  sc(ws, 36, 9, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM, null)
  ws.mergeCells('H36:I36')

  // ── Row 37: Balance (formula = imprest - spent) ──
  ws.getRow(37).height = 16.5
  sc(ws, 37, 3, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { bottom: MED() })
  for (let c = 4; c <= 7; c++) sc(ws, 37, c, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { bottom: MED() })
  ws.mergeCells('C37:G37')
  sc(ws, 37, 8, { formula: 'H38-H39', result: balance }, FONT_CORBEL_BOLD, NO_FILL, { horizontal: 'center' }, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 37, 9, null, FONT_CORBEL_BOLD, NO_FILL, { horizontal: 'center' }, { top: MED(), bottom: MED() })
  ws.mergeCells('H37:I37')

  // ── Row 38: Imprest Amount ──
  ws.getRow(38).height = 16.5
  sc(ws, 38, 3, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { top: MED(), bottom: MED() })
  for (let c = 4; c <= 7; c++) sc(ws, 38, c, null, FONT_CORBEL_BOLD, NO_FILL, ALIGN_CM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('C38:G38')
  const impCell = sc(ws, 38, 8, imprestAmount, FONT_CORBEL_BOLD, GRAY_FILL, { horizontal: 'center' }, { left: MED(), top: MED(), bottom: MED() })
  impCell.numFmt = '#,##0'
  sc(ws, 38, 9, null, FONT_CORBEL_BOLD, GRAY_FILL, { horizontal: 'center' }, { top: MED(), bottom: MED() })
  ws.mergeCells('H38:I38')

  // ── Row 39: Total Amount Spent (SUM formula) ──
  ws.getRow(39).height = 16.5
  sc(ws, 39, 3, null, FONT_CORBEL, NO_FILL, null, { top: MED(), bottom: MED() })
  for (let c = 4; c <= 7; c++) sc(ws, 39, c, null, FONT_CORBEL, NO_FILL, null, { top: MED(), bottom: MED() })
  ws.mergeCells('C39:G39')
  const spentCell = sc(ws, 39, 8, { formula: `SUM(G${DATA_START}:H${PAIRED_ROW_END})`, result: totalSpent }, FONT_CORBEL_BOLD, PEACH_FILL, { horizontal: 'center' }, { left: MED(), top: MED(), bottom: MED() })
  spentCell.numFmt = '#,##0'
  sc(ws, 39, 9, null, FONT_CORBEL_BOLD, PEACH_FILL, { horizontal: 'center' }, { top: MED(), bottom: MED() })
  ws.mergeCells('H39:I39')

  // ── Rows 40-41: Blank ──
  // default

  // ── Row 42: Amount in words ──
  ws.getRow(42).height = 16.5
  sc(ws, 42, 4, numberToWords(totalSpent), FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle' }, { bottom: MED() })

  // ── Row 43: blank ──
  ws.getRow(43).height = 16.5

  // ── Rows 44-52: Signature block ──
  // Row 44: "Paid By:" label on right
  ws.getRow(44).height = 16.5
  sc(ws, 44, 12, 'Paid By:', FONT_CORBEL_BOLD, LTGRAY_FILL, { vertical: 'middle' }, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 44, 13, null, FONT_CORBEL_BOLD, LTGRAY_FILL, { vertical: 'middle' }, { top: MED(), bottom: MED() })
  sc(ws, 44, 14, null, FONT_CORBEL_BOLD, LTGRAY_FILL, { vertical: 'middle' }, { top: MED(), bottom: MED() })
  ws.mergeCells('L44:N44')

  // Row 45: Preparer name (left) + "Name" label (right)
  ws.getRow(45).height = 16.5
  sc(ws, 45, 3, '', FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 45, 4, null, FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('C45:D45')
  sc(ws, 45, 12, 'Name', FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle' }, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 45, 13, null, FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle' }, { top: MED(), bottom: MED() })
  sc(ws, 45, 14, null, FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle' }, { top: MED(), bottom: MED() })
  ws.mergeCells('L45:N45')
  // O45:S45 (extra columns in reference)
  for (let c = 15; c <= 19; c++) sc(ws, 45, c, null, FONT_CORBEL, NO_FILL, null, null)
  ws.mergeCells('O45:S45')

  // Row 46: Signature area (left) + "Signature" label (right)
  ws.getRow(46).height = 16.5
  sc(ws, 46, 3, '', FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 46, 4, null, FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('C46:D46')
  sc(ws, 46, 12, 'Signature', FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle' }, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 46, 13, null, FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle' }, { top: MED(), bottom: MED() })
  sc(ws, 46, 14, null, FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle' }, { top: MED(), bottom: MED() })
  ws.mergeCells('L46:N46')
  for (let c = 15; c <= 19; c++) sc(ws, 46, c, null, FONT_CORBEL, NO_FILL, null, null)
  ws.mergeCells('O46:S46')

  // Row 47: Date (left) + "Date (dd/mm/yy)" label (right)
  ws.getRow(47).height = 16.5
  sc(ws, 47, 3, '', FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 47, 4, null, FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('C47:D47')
  sc(ws, 47, 12, 'Date (dd/mm/yy)', FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle', wrapText: true }, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 47, 13, null, FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle', wrapText: true }, { top: MED(), bottom: MED() })
  sc(ws, 47, 14, null, FONT_CORBEL_BOLD, YELLOW_FILL, { vertical: 'middle', wrapText: true }, { top: MED(), bottom: MED() })
  ws.mergeCells('L47:N47')
  for (let c = 15; c <= 19; c++) sc(ws, 47, c, null, FONT_CORBEL, NO_FILL, null, null)
  ws.mergeCells('O47:S47')

  // Row 48-49: blank
  ws.getRow(48).height = 15.75
  ws.getRow(49).height = 16.5

  // Row 50: Custodian name
  ws.getRow(50).height = 16.5
  sc(ws, 50, 3, custodianName?.toUpperCase() || '', FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 50, 4, null, FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('C50:D50')

  // Row 51: blank cells (custodian title area)
  ws.getRow(51).height = 16.5
  sc(ws, 51, 3, null, FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 51, 4, null, FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('C51:D51')
  sc(ws, 51, 13, null, FONT_CORBEL_UL, YELLOW_FILL, { horizontal: 'center' }, null)
  sc(ws, 51, 14, null, FONT_CORBEL_UL, YELLOW_FILL, { horizontal: 'center' }, null)
  ws.mergeCells('M51:N51')

  // Row 52: Date
  ws.getRow(52).height = 16.5
  sc(ws, 52, 3, '', FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { left: MED(), top: MED(), bottom: MED() })
  sc(ws, 52, 4, null, FONT_CORBEL, YELLOW_FILL, ALIGN_LM_WRAP, { top: MED(), bottom: MED() })
  ws.mergeCells('C52:D52')
  sc(ws, 52, 13, null, FONT_CORBEL, YELLOW_FILL, { horizontal: 'center' }, null)
  sc(ws, 52, 14, null, FONT_CORBEL, YELLOW_FILL, { horizontal: 'center' }, null)
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
