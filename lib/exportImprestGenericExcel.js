import ExcelJS from 'exceljs'
import { addBlock, autoWidth, num, downloadWorkbook, safeName } from '@/lib/exportPlain'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * An imprest sheet as a plain workbook, for stations outside the Rainoil group.
 *
 * exportImprestExcel.js is a replica of Rainoil's petty cash form: navy, peach and grey fills
 * at fixed hex values, medium borders, one sheet called "Sheet1", with the signature blocks the
 * paper carries. That form stays untouched. This is the same figures without it.
 *
 * The reconciliation stays in the order the sheet is read in: what was floated, what went out,
 * what should be left. That ordering is the point of an imprest, so it is a block of its own
 * rather than three cells appended to the entries table.
 */
export async function exportImprestGenericExcel({
  month, year, imprestAmount, custodianName, formNumber,
  entries, totalSpent, balance, stationName, preparedBy, paidBy,
}) {
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  const ws = wb.addWorksheet('Imprest')

  const monthName = MONTHS[Number(month) - 1] || month || ''
  const period = [monthName, year].filter(Boolean).join(' ')

  ws.addRow([stationName || 'Station']).font = { bold: true, size: 14 }
  ws.addRow([`Imprest${period ? `, ${period}` : ''}`]).font = { size: 10 }
  ws.addRow([])

  addBlock(ws, {
    header: ['Field', 'Value'],
    rows: [
      ['Form number', formNumber || ''],
      ['Custodian', custodianName || ''],
      ['Prepared by', preparedBy || ''],
      ['Paid by', paidBy || ''],
    ],
  })

  addBlock(ws, {
    title: 'Entries',
    header: ['Date', 'Beneficiary', 'Details', 'Account code', 'Amount'],
    rows: (entries || []).map((e) => [
      e.entry_date || '',
      e.beneficiary || '',
      e.transaction_details || '',
      e.account_code || '',
      num(e.amount),
    ]),
    total: ['Total', '', '', '', num(totalSpent)],
  })

  addBlock(ws, {
    title: 'Reconciliation',
    header: ['Item', 'Amount'],
    rows: [
      ['Imprest amount', num(imprestAmount)],
      ['Total spent', num(totalSpent)],
      ['Balance', num(balance)],
    ],
  })

  autoWidth(ws)

  const name = safeName(stationName)
  return downloadWorkbook(wb, `Imprest ${name}${period ? ` ${period}` : ''}.xlsx`)
}
