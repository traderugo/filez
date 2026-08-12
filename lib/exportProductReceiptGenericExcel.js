import ExcelJS from 'exceljs'
import { addBlock, autoWidth, num, downloadWorkbook, safeName } from '@/lib/exportPlain'

/**
 * A product receipt as a plain workbook, for stations outside the Rainoil group.
 *
 * exportProductReceiptExcel.js is a replica of Rainoil's discharge certificate: peach and
 * yellow fills at fixed hex values, Corbel, medium borders, one sheet called "Sheet1". That is
 * their form and it stays untouched. This carries the same figures with nothing borrowed from
 * the paper.
 *
 * A receipt is one delivery into up to three compartments, so the three are laid out as rows of
 * a table rather than as the fixed grid the certificate uses. A tanker discharging into one
 * compartment produces one row here instead of two empty columns.
 */
export async function exportProductReceiptGenericExcel(delivery) {
  if (!delivery) throw new Error('No delivery data')

  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  const ws = wb.addWorksheet('Product Receipt')

  ws.addRow([`Product Receipt: ${delivery.product || 'Fuel'}`]).font = { bold: true, size: 14 }
  ws.addRow([])

  addBlock(ws, {
    header: ['Field', 'Value'],
    rows: [
      ['Product', delivery.product || ''],
      ['Waybill number', delivery.waybillNumber || ''],
      ['Ticket number', delivery.ticketNumber || ''],
      ['Truck number', delivery.truckNumber || ''],
      ['Driver', delivery.driverName || ''],
      ['Depot', delivery.depotName || ''],
      ['Loaded', delivery.loadedDate || ''],
      ['Discharged', delivery.entryDate || ''],
      ['Arrived', delivery.arrivalTime || ''],
      ['Left', delivery.exitTime || ''],
    ],
  })

  /**
   * Compartments. Each of these arrives as an array of three, one slot per compartment, and a
   * slot is only real if something was measured in it. Rows are emitted for the compartments
   * that carry a figure, so a single-compartment discharge is one row rather than three with
   * two of them blank.
   */
  const at = (arr, i) => (Array.isArray(arr) ? arr[i] : undefined)
  const used = [0, 1, 2].filter((i) =>
    [delivery.highVol, delivery.lowVol, delivery.stationUllage, delivery.depotUllage]
      .some((arr) => {
        const v = at(arr, i)
        return v !== undefined && v !== null && v !== '' && Number(v) !== 0
      })
  )

  addBlock(ws, {
    title: 'Compartments',
    header: [
      'Compartment', 'Chart high ullage', 'Chart low ullage', 'Chart liquid height',
      'Station ullage', 'Station liquid height', 'Depot ullage', 'Depot liquid height',
      'High volume', 'Low volume',
    ],
    rows: (used.length ? used : [0]).map((i) => [
      i + 1,
      num(at(delivery.chartHighUllage, i)),
      num(at(delivery.chartLowUllage, i)),
      num(at(delivery.chartLiquidHeight, i)),
      num(at(delivery.stationUllage, i)),
      num(at(delivery.stationLiquidHeight, i)),
      num(at(delivery.depotUllage, i)),
      num(at(delivery.depotLiquidHeight, i)),
      num(at(delivery.highVol, i)),
      num(at(delivery.lowVol, i)),
    ]),
  })

  addBlock(ws, {
    header: ['Measure', 'Litres'],
    rows: [['Quantity received', num(delivery.qtyReceived)]],
  })

  autoWidth(ws)

  const label = safeName(delivery.waybillNumber || delivery.truckNumber || delivery.product, 'Receipt')
  const when = delivery.entryDate || delivery.loadedDate || ''
  return downloadWorkbook(wb, `Product Receipt ${label}${when ? ` ${when}` : ''}.xlsx`)
}
