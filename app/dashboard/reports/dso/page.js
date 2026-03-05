'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

const TABS = ['Sales', 'Inventory', 'Consumption', 'Lodgement', 'Summary']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function DSOReportPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab] = useState('Sales')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/dso?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [year, month])

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) } else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) } else setMonth(month + 1)
  }

  return (
    <div className="max-w-full px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Daily Sales Operation</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium text-gray-900 min-w-[140px] text-center">{MONTHS[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data ? (
        <p className="text-sm text-gray-500">Failed to load report.</p>
      ) : (
        <div className="overflow-x-auto">
          {tab === 'Sales' && <SalesTab data={data} />}
          {tab === 'Inventory' && <InventoryTab data={data} />}
          {tab === 'Consumption' && <ConsumptionTab data={data} />}
          {tab === 'Lodgement' && <LodgementTab data={data} />}
          {tab === 'Summary' && <SummaryTab data={data} />}
        </div>
      )}
    </div>
  )
}

// Helper: get daily record for a date
function getDailyForDate(data, day) {
  const dateStr = `${data.year}-${String(data.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return data.daily.find((d) => d.entry_date === dateStr)
}

function n(val) { return Number(val) || 0 }
function fmt(val) { return n(val).toLocaleString() }

const thClass = 'px-2 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 whitespace-nowrap'
const tdClass = 'px-2 py-1.5 text-xs text-gray-900 border border-gray-200 text-right font-mono'
const tdLabelClass = 'px-2 py-1.5 text-xs text-gray-700 border border-gray-200 whitespace-nowrap'
const tdTotalClass = 'px-2 py-1.5 text-xs font-bold text-gray-900 border border-gray-200 text-right font-mono bg-gray-50'

// ============================================
// SALES TAB
// ============================================
function SalesTab({ data }) {
  const { config, daysInMonth } = data
  const fuelTypes = ['PMS', 'AGO', 'DPK']
  const pumpsByFuel = {}
  fuelTypes.forEach((ft) => { pumpsByFuel[ft] = config.pumps.filter((p) => p.fuel_type === ft) })

  const rows = useMemo(() => {
    const result = []
    for (let day = 1; day <= daysInMonth; day++) {
      const daily = getDailyForDate(data, day)
      const row = { day, date: `${day}-${data.month}-${data.year}` }
      fuelTypes.forEach((ft) => {
        const pumps = pumpsByFuel[ft]
        let totalDispensed = 0
        let price = 0
        pumps.forEach((pump) => {
          const reading = daily ? data.pumpReadings.find((r) => r.daily_id === daily.id && r.pump_id === pump.id) : null
          totalDispensed += n(reading?.closing) - n(reading?.opening)
          if (reading?.price) price = n(reading.price)
        })
        const consumed = daily ? data.consumption.filter((c) => {
          const cat = config.consumptionCategories.find((cc) => cc.id === c.category_id)
          return c.daily_id === daily.id && cat?.fuel_type === ft
        }).reduce((sum, c) => sum + n(c.quantity), 0) : 0
        const actual = totalDispensed - consumed
        row[`${ft}_volume`] = totalDispensed
        row[`${ft}_consumed`] = consumed
        row[`${ft}_actual`] = actual
        row[`${ft}_price`] = price
        row[`${ft}_amount`] = actual * price
      })
      result.push(row)
    }
    return result
  }, [data, daysInMonth])

  const totals = {}
  fuelTypes.forEach((ft) => {
    totals[`${ft}_volume`] = rows.reduce((s, r) => s + n(r[`${ft}_volume`]), 0)
    totals[`${ft}_actual`] = rows.reduce((s, r) => s + n(r[`${ft}_actual`]), 0)
    totals[`${ft}_amount`] = rows.reduce((s, r) => s + n(r[`${ft}_amount`]), 0)
  })

  return (
    <table className="border-collapse w-full">
      <thead>
        <tr>
          <th className={thClass}>Day</th>
          <th className={thClass}>Date</th>
          {fuelTypes.map((ft) => (
            <th key={ft} colSpan={3} className={`${thClass} text-center`}>{ft}</th>
          ))}
        </tr>
        <tr>
          <th className={thClass}></th>
          <th className={thClass}></th>
          {fuelTypes.map((ft) => (
            [
              <th key={`${ft}-vol`} className={thClass}>Dispensed</th>,
              <th key={`${ft}-price`} className={thClass}>Price</th>,
              <th key={`${ft}-amt`} className={thClass}>Amount</th>,
            ]
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.day}>
            <td className={tdLabelClass}>{row.day}</td>
            <td className={tdLabelClass}>{row.date}</td>
            {fuelTypes.map((ft) => (
              [
                <td key={`${ft}-vol`} className={tdClass}>{fmt(row[`${ft}_volume`])}</td>,
                <td key={`${ft}-price`} className={tdClass}>{fmt(row[`${ft}_price`])}</td>,
                <td key={`${ft}-amt`} className={tdClass}>{fmt(row[`${ft}_amount`])}</td>,
              ]
            ))}
          </tr>
        ))}
        <tr className="font-bold">
          <td colSpan={2} className={tdTotalClass}>TOTAL</td>
          {fuelTypes.map((ft) => (
            [
              <td key={`${ft}-vol`} className={tdTotalClass}>{fmt(totals[`${ft}_volume`])}</td>,
              <td key={`${ft}-price`} className={tdTotalClass}></td>,
              <td key={`${ft}-amt`} className={tdTotalClass}>{fmt(totals[`${ft}_amount`])}</td>,
            ]
          ))}
        </tr>
      </tbody>
    </table>
  )
}

// ============================================
// INVENTORY TAB
// ============================================
function InventoryTab({ data }) {
  const { config, daysInMonth } = data
  const tanks = config.tanks
  const fuelTypes = [...new Set(tanks.map((t) => t.fuel_type))]

  const rows = useMemo(() => {
    const result = []
    for (let day = 1; day <= daysInMonth; day++) {
      const daily = getDailyForDate(data, day)
      const row = { day, date: `${day}-${data.month}-${data.year}` }

      fuelTypes.forEach((ft) => {
        const ftTanks = tanks.filter((t) => t.fuel_type === ft)
        let totalClosing = 0
        let totalWaybill = 0
        let totalActualSupply = 0

        ftTanks.forEach((tank) => {
          const reading = daily ? data.tankReadings.find((r) => r.daily_id === daily.id && r.tank_id === tank.id) : null
          totalClosing += n(reading?.closing)
          totalWaybill += n(reading?.waybill_supply)
          totalActualSupply += n(reading?.actual_supply)
        })

        // Dispensed for this fuel type from pumps
        const ftPumps = config.pumps.filter((p) => p.fuel_type === ft)
        let totalDispensed = 0
        ftPumps.forEach((pump) => {
          const reading = daily ? data.pumpReadings.find((r) => r.daily_id === daily.id && r.pump_id === pump.id) : null
          totalDispensed += n(reading?.closing) - n(reading?.opening)
        })

        // Opening = prev day closing (or tank capacity for day 1 if no data)
        const prevDaily = day > 1 ? getDailyForDate(data, day - 1) : null
        let totalOpening = 0
        ftTanks.forEach((tank) => {
          if (prevDaily) {
            const prevReading = data.tankReadings.find((r) => r.daily_id === prevDaily.id && r.tank_id === tank.id)
            totalOpening += n(prevReading?.closing)
          } else {
            totalOpening += n(tank.capacity)
          }
        })

        const ovsh = totalClosing - (totalOpening + totalActualSupply - totalDispensed)
        const driverShortage = totalWaybill - totalActualSupply

        row[`${ft}_opening`] = totalOpening
        row[`${ft}_closing`] = totalClosing
        row[`${ft}_waybill`] = totalWaybill
        row[`${ft}_actual_supply`] = totalActualSupply
        row[`${ft}_dispensed`] = totalDispensed
        row[`${ft}_ovsh`] = ovsh
        row[`${ft}_driver_shortage`] = driverShortage
      })
      result.push(row)
    }
    return result
  }, [data, daysInMonth])

  return (
    <table className="border-collapse w-full">
      <thead>
        <tr>
          <th className={thClass}>Day</th>
          <th className={thClass}>Date</th>
          {fuelTypes.map((ft) => (
            <th key={ft} colSpan={5} className={`${thClass} text-center`}>{ft}</th>
          ))}
        </tr>
        <tr>
          <th className={thClass}></th>
          <th className={thClass}></th>
          {fuelTypes.map((ft) => (
            [
              <th key={`${ft}-cl`} className={thClass}>Closing</th>,
              <th key={`${ft}-ov`} className={thClass}>OV/SH</th>,
              <th key={`${ft}-disp`} className={thClass}>Dispensed</th>,
              <th key={`${ft}-sup`} className={thClass}>Supply</th>,
              <th key={`${ft}-ds`} className={thClass}>Dr. Short</th>,
            ]
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.day}>
            <td className={tdLabelClass}>{row.day}</td>
            <td className={tdLabelClass}>{row.date}</td>
            {fuelTypes.map((ft) => (
              [
                <td key={`${ft}-cl`} className={tdClass}>{fmt(row[`${ft}_closing`])}</td>,
                <td key={`${ft}-ov`} className={`${tdClass} ${n(row[`${ft}_ovsh`]) < 0 ? 'text-red-600' : ''}`}>{fmt(row[`${ft}_ovsh`])}</td>,
                <td key={`${ft}-disp`} className={tdClass}>{fmt(row[`${ft}_dispensed`])}</td>,
                <td key={`${ft}-sup`} className={tdClass}>{fmt(row[`${ft}_actual_supply`])}</td>,
                <td key={`${ft}-ds`} className={`${tdClass} ${n(row[`${ft}_driver_shortage`]) > 0 ? 'text-red-600' : ''}`}>{fmt(row[`${ft}_driver_shortage`])}</td>,
              ]
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ============================================
// CONSUMPTION TAB
// ============================================
function ConsumptionTab({ data }) {
  const { config, daysInMonth } = data
  const fuelTypes = ['PMS', 'AGO', 'DPK']
  const catsByFuel = {}
  fuelTypes.forEach((ft) => {
    catsByFuel[ft] = config.consumptionCategories.filter((c) => c.fuel_type === ft)
  })

  const rows = useMemo(() => {
    const result = []
    for (let day = 1; day <= daysInMonth; day++) {
      const daily = getDailyForDate(data, day)
      const row = { day, date: `${day}-${data.month}-${data.year}` }
      fuelTypes.forEach((ft) => {
        catsByFuel[ft].forEach((cat) => {
          const entry = daily ? data.consumption.find((c) => c.daily_id === daily.id && c.category_id === cat.id) : null
          row[`${ft}_${cat.id}`] = n(entry?.quantity)
        })
      })
      result.push(row)
    }
    return result
  }, [data, daysInMonth])

  const totals = {}
  fuelTypes.forEach((ft) => {
    catsByFuel[ft].forEach((cat) => {
      totals[`${ft}_${cat.id}`] = rows.reduce((s, r) => s + n(r[`${ft}_${cat.id}`]), 0)
    })
  })

  return (
    <table className="border-collapse w-full">
      <thead>
        <tr>
          <th className={thClass}>Day</th>
          {fuelTypes.map((ft) => {
            const cats = catsByFuel[ft]
            return cats.length > 0 ? (
              <th key={ft} colSpan={cats.length} className={`${thClass} text-center`}>{ft} Consumption</th>
            ) : null
          })}
        </tr>
        <tr>
          <th className={thClass}></th>
          {fuelTypes.map((ft) =>
            catsByFuel[ft].map((cat) => (
              <th key={cat.id} className={thClass}>{cat.category_name}</th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.day}>
            <td className={tdLabelClass}>{row.day}</td>
            {fuelTypes.map((ft) =>
              catsByFuel[ft].map((cat) => (
                <td key={cat.id} className={tdClass}>{fmt(row[`${ft}_${cat.id}`])}</td>
              ))
            )}
          </tr>
        ))}
        <tr className="font-bold">
          <td className={tdTotalClass}>TOTAL</td>
          {fuelTypes.map((ft) =>
            catsByFuel[ft].map((cat) => (
              <td key={cat.id} className={tdTotalClass}>{fmt(totals[`${ft}_${cat.id}`])}</td>
            ))
          )}
        </tr>
      </tbody>
    </table>
  )
}

// ============================================
// LODGEMENT TAB
// ============================================
function LodgementTab({ data }) {
  const { config, daysInMonth } = data
  const banks = config.banks

  const rows = useMemo(() => {
    const result = []
    for (let day = 1; day <= daysInMonth; day++) {
      const daily = getDailyForDate(data, day)
      const row = { day, date: `${day}-${data.month}-${data.year}`, totalSales: 0, totalPOS: 0, lodgement: n(daily?.lodgement_amount) }

      // Total sales = sum of all pump amounts
      const fuelTypes = ['PMS', 'AGO', 'DPK']
      fuelTypes.forEach((ft) => {
        const pumps = config.pumps.filter((p) => p.fuel_type === ft)
        pumps.forEach((pump) => {
          const reading = daily ? data.pumpReadings.find((r) => r.daily_id === daily.id && r.pump_id === pump.id) : null
          const dispensed = n(reading?.closing) - n(reading?.opening)
          const consumed = daily ? data.consumption.filter((c) => {
            const cat = config.consumptionCategories.find((cc) => cc.id === c.category_id)
            return c.daily_id === daily.id && cat?.fuel_type === ft
          }).reduce((s, c) => s + n(c.quantity), 0) : 0
          const actual = dispensed - consumed
          row.totalSales += actual * n(reading?.price)
        })
      })

      banks.forEach((bank) => {
        const posEntry = daily ? data.pos.find((p) => p.daily_id === daily.id && p.bank_id === bank.id) : null
        row[`bank_${bank.id}`] = n(posEntry?.amount)
        row.totalPOS += n(posEntry?.amount)
      })

      row.cash = row.totalSales - row.totalPOS
      result.push(row)
    }
    return result
  }, [data, daysInMonth])

  const totals = {
    totalSales: rows.reduce((s, r) => s + r.totalSales, 0),
    totalPOS: rows.reduce((s, r) => s + r.totalPOS, 0),
    lodgement: rows.reduce((s, r) => s + r.lodgement, 0),
    cash: rows.reduce((s, r) => s + r.cash, 0),
  }
  banks.forEach((bank) => {
    totals[`bank_${bank.id}`] = rows.reduce((s, r) => s + n(r[`bank_${bank.id}`]), 0)
  })

  return (
    <table className="border-collapse w-full">
      <thead>
        <tr>
          <th className={thClass}>Day</th>
          <th className={thClass}>Date</th>
          <th className={thClass}>Total Sales</th>
          <th className={thClass}>Expected</th>
          {banks.map((b) => <th key={b.id} className={thClass}>{b.bank_name}</th>)}
          <th className={thClass}>Total POS</th>
          <th className={thClass}>Cash</th>
          <th className={thClass}>Lodgement</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.day}>
            <td className={tdLabelClass}>{row.day}</td>
            <td className={tdLabelClass}>{row.date}</td>
            <td className={tdClass}>{fmt(row.totalSales)}</td>
            <td className={tdClass}>{fmt(row.totalSales)}</td>
            {banks.map((b) => <td key={b.id} className={tdClass}>{fmt(row[`bank_${b.id}`])}</td>)}
            <td className={tdClass}>{fmt(row.totalPOS)}</td>
            <td className={tdClass}>{fmt(row.cash)}</td>
            <td className={tdClass}>{fmt(row.lodgement)}</td>
          </tr>
        ))}
        <tr className="font-bold">
          <td colSpan={2} className={tdTotalClass}>TOTAL</td>
          <td className={tdTotalClass}>{fmt(totals.totalSales)}</td>
          <td className={tdTotalClass}>{fmt(totals.totalSales)}</td>
          {banks.map((b) => <td key={b.id} className={tdTotalClass}>{fmt(totals[`bank_${b.id}`])}</td>)}
          <td className={tdTotalClass}>{fmt(totals.totalPOS)}</td>
          <td className={tdTotalClass}>{fmt(totals.cash)}</td>
          <td className={tdTotalClass}>{fmt(totals.lodgement)}</td>
        </tr>
      </tbody>
    </table>
  )
}

// ============================================
// SUMMARY TAB
// ============================================
function SummaryTab({ data }) {
  const { config, daysInMonth } = data
  const fuelTypes = ['PMS', 'AGO', 'DPK']

  const summary = useMemo(() => {
    const result = {}
    fuelTypes.forEach((ft) => {
      let totalDispensed = 0
      let totalConsumed = 0
      let totalAmount = 0
      let totalPOS = 0
      let totalSupply = 0

      for (let day = 1; day <= daysInMonth; day++) {
        const daily = getDailyForDate(data, day)
        if (!daily) continue

        const pumps = config.pumps.filter((p) => p.fuel_type === ft)
        pumps.forEach((pump) => {
          const reading = data.pumpReadings.find((r) => r.daily_id === daily.id && r.pump_id === pump.id)
          const disp = n(reading?.closing) - n(reading?.opening)
          totalDispensed += disp
          totalAmount += disp * n(reading?.price)
        })

        const consumed = data.consumption.filter((c) => {
          const cat = config.consumptionCategories.find((cc) => cc.id === c.category_id)
          return c.daily_id === daily.id && cat?.fuel_type === ft
        }).reduce((s, c) => s + n(c.quantity), 0)
        totalConsumed += consumed

        const tanks = config.tanks.filter((t) => t.fuel_type === ft)
        tanks.forEach((tank) => {
          const reading = data.tankReadings.find((r) => r.daily_id === daily.id && r.tank_id === tank.id)
          totalSupply += n(reading?.actual_supply)
        })
      }

      result[ft] = {
        dispensed: totalDispensed,
        consumed: totalConsumed,
        actual: totalDispensed - totalConsumed,
        amount: totalAmount,
        supply: totalSupply,
      }
    })

    // POS total
    let totalPOS = 0
    let totalLodgement = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const daily = getDailyForDate(data, day)
      if (!daily) continue
      totalPOS += data.pos.filter((p) => p.daily_id === daily.id).reduce((s, p) => s + n(p.amount), 0)
      totalLodgement += n(daily.lodgement_amount)
    }
    result.totalPOS = totalPOS
    result.totalLodgement = totalLodgement
    result.totalSales = fuelTypes.reduce((s, ft) => s + result[ft].amount, 0)
    result.totalCash = result.totalSales - totalPOS

    return result
  }, [data, daysInMonth])

  return (
    <div className="max-w-lg space-y-6">
      {/* Sales Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Sales Summary</h3>
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className={thClass}>Fuel</th>
              <th className={thClass}>Dispensed</th>
              <th className={thClass}>Consumed</th>
              <th className={thClass}>Actual</th>
              <th className={thClass}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {fuelTypes.map((ft) => (
              <tr key={ft}>
                <td className={`${tdLabelClass} font-medium`}>{ft}</td>
                <td className={tdClass}>{fmt(summary[ft].dispensed)}</td>
                <td className={tdClass}>{fmt(summary[ft].consumed)}</td>
                <td className={tdClass}>{fmt(summary[ft].actual)}</td>
                <td className={tdClass}>{fmt(summary[ft].amount)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={tdTotalClass}>TOTAL</td>
              <td className={tdTotalClass}>{fmt(fuelTypes.reduce((s, ft) => s + summary[ft].dispensed, 0))}</td>
              <td className={tdTotalClass}>{fmt(fuelTypes.reduce((s, ft) => s + summary[ft].consumed, 0))}</td>
              <td className={tdTotalClass}>{fmt(fuelTypes.reduce((s, ft) => s + summary[ft].actual, 0))}</td>
              <td className={tdTotalClass}>{fmt(summary.totalSales)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Payment Summary</h3>
        <div className="space-y-2">
          {[
            { label: 'Total Sales', value: summary.totalSales },
            { label: 'POS', value: summary.totalPOS },
            { label: 'Cash', value: summary.totalCash },
            { label: 'Lodgement', value: summary.totalLodgement },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-600">{label}</span>
              <span className="font-mono font-medium text-gray-900">{fmt(value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Supply Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Supply Summary</h3>
        <div className="space-y-2">
          {fuelTypes.map((ft) => (
            <div key={ft} className="flex justify-between py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-600">{ft} Supply</span>
              <span className="font-mono font-medium text-gray-900">{fmt(summary[ft].supply)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
