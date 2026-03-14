# Report Page & Helper Function Skill Reference

Use this file when building new report pages or calculation helpers for the station-portal project.

---

## 1. Architecture Overview

Reports follow a three-layer architecture:

```
Helper Functions (lib/*Calculations.js)
    ↓ pure data in → structured data out
Builder Functions (lib/build*Report.js)
    ↓ combines multiple helpers → complete report object
Report Pages (app/dashboard/reports/*/page.js)
    ↓ useMemo(builder) → renders tables/charts
```

**Helpers** are reusable across multiple builders. **Builders** are 1:1 with report pages. **Pages** only render — no business logic.

---

## 2. Available Helper Functions

### `lib/salesCalculations.js`
- **`calculateDateRangeNozzles(sales, nozzles, startDate, endDate, tanks)`**
- Nozzle meter readings: opening, closing, dispensed per nozzle per entry
- Groups by fuel type, chains entries (prev closing → next opening)
- Returns: `{ dates: [{ date, entries, hasEntry, entryCount }], fuelTypes }`
- Each entry has `fuelGroups[ft].nozzles[]` and `fuelGroups[ft].totals.dispensed`

### `lib/lodgementCalculations.js`
- **`calculateDateRangeLodgements(lodgements, banks, startDate, endDate)`**
- Bank lodgement running balances: opening, deposited, closing per bank
- Groups by lodgement type (POS, bank_deposit, cash, other)
- Returns: `{ dates: [{ date, bankRows, totalPOS, totalDeposits, totalCash, totalOther, totalAll }], bankIds }`

### `lib/receiptCalculations.js`
- **`calculateDateRangeReceipts(receipts, tanks, startDate, endDate)`**
- Product receipt volumes per tank, enriched with tank info
- Returns: `{ dates: [{ date, receipts, supplyByTankId, fuelBreakdown, totalVolume }], fuelTypes }`

### `lib/consumptionCalculations.js`
- **`calculateDateRangeConsumption(consumption, startDate, endDate)`**
- Consumption and pour-back entries grouped by date and fuel type
- Each entry has `isPourBack` boolean
- Returns: `{ dates: [{ date, entries, byFuelType: { PMS: { consumed, pourBack, entries } }, totalConsumed, totalPourBack }] }`

---

## 3. Builder Function Pattern (`lib/build*Report.js`)

### Purpose

A builder is a **pure function** that:
1. Calls multiple helpers with raw data
2. Indexes helper results by date for O(1) lookup
3. Iterates over the date range, combining all data sources per date
4. Returns a complete report object ready for rendering

### Reference Implementation: `lib/buildDailyReport.js`

```js
import { calculateDateRangeNozzles } from './salesCalculations'
import { calculateDateRangeLodgements } from './lodgementCalculations'
import { calculateDateRangeReceipts } from './receiptCalculations'
import { calculateDateRangeConsumption } from './consumptionCalculations'

export function buildDailyReport({ sales, receipts, lodgements, consumption, nozzles, tanks, banks, startDate, endDate }) {
  if (!nozzles.length) return null

  // 1. Run helpers
  const rangeResult = calculateDateRangeNozzles(sales, nozzles, startDate, endDate, tanks)
  const lodgementResult = calculateDateRangeLodgements(lodgements, banks, startDate, endDate)
  const receiptResult = calculateDateRangeReceipts(receipts, tanks, startDate, endDate)
  const consumptionResult = calculateDateRangeConsumption(consumption, startDate, endDate)

  // 2. Index by date
  const lodgementByDate = {}, receiptByDate = {}, consumptionByDate = {}
  for (const ld of lodgementResult.dates) lodgementByDate[ld.date] = ld
  for (const rd of receiptResult.dates) receiptByDate[rd.date] = rd
  for (const cd of consumptionResult.dates) consumptionByDate[cd.date] = cd

  // 3. Build per-date reports
  const dateReports = rangeResult.dates.map(({ date, ... }) => {
    // Combine all data sources for this date
    // Return complete date report object
  })

  return { dateReports, fuelTypes }
}
```

### Builder Output Shape (Daily Sales Report)

Each `dateReport` contains:

```js
{
  date,                    // 'YYYY-MM-DD'
  entryGroups,             // [{ entryIndex, entryId, nozzleRows, fuelTotals }]
  dayFuelTotals,           // { PMS: { dispensed, consumed, actual, price, amount, pourBack }, ... }
  tankSummaryRows,         // [{ fuelType, tanks, totalOpening, totalClosing, totalSupply, totalDispensed, totalDiff, totalOvsh }]
  tanksByFuel,             // { PMS: { tanks: [...], totalOpening, totalClosing, ... }, ... }
  lodgement,               // { bankRows, totalPOS, totalDeposits, totalCash, totalOther, totalAll }
  consumption,             // { entries, byFuelType, totalConsumed, totalPourBack }
  consumptionComparison,   // { PMS: { nozzleConsumed, entryConsumed, consumedMatch, nozzlePourBack, entryPourBack, pourBackMatch } }
  editIds,                 // { receipt, lodgement, consumption } — first entry ID per type for edit links
  totalSales,              // sum of all fuel amounts
  cashBalance,             // totalSales - totalPOS
  hasEntry,                // boolean
  entryCount,              // number of daily sales entries
}
```

### Reference Implementation 2: `lib/buildAuditReport.js`

The audit report is a **period-level** report (not per-date like the daily report). It groups data across a date range into summaries.

```js
import { sortEntries, getFuelTypes, getNozzlesForFuel } from './salesCalculations'
import { calculateDateRangeLodgements } from './lodgementCalculations'
import { calculateDateRangeConsumption } from './consumptionCalculations'

export function buildAuditReport({ sales, lodgements, consumption, nozzles, banks, customers, startDate, endDate }) {
  if (!nozzles.length) return null

  const fuelTypes = getFuelTypes(nozzles)

  // Build meter reading rows per fuel type (grouped by price period)
  const fuelData = {}
  for (const ft of fuelTypes) {
    fuelData[ft] = buildFuelMeterRows(ft, nozzles, sorted, prevEntry, dateStrings, entriesByDate)
  }

  // Build price-by-date lookup, then price consumption/pour back per date
  // ... (see consumption pricing section below)

  // Build per-fuel summary: A (total sales) → B (pour back) → C (net) → D (consumption) → E (expected)
  // Cash reconciliation: expected vs lodgements vs POS → overage/shortage

  return { fuelTypes, salesCash: { fuelSummaries, cashReconciliation } }
}
```

**Meter rows group by price period** — a new row is emitted when the daily sales price changes. Each row has: `{ pumps, dispensed, price, amount }`.

**Audit report output shape:**
```js
{
  fuelTypes: ['PMS', 'AGO', 'DPK'],
  salesCash: {
    fuelSummaries: {
      PMS: {
        rows: [{ pumps, dispensed, price, amount }],   // meter reading rows by price period
        totalDispensed, totalAmount,                    // A: total sales
        totalPourBackQty, totalPourBackAmt,             // B: pour back
        netSalesQty, netSalesAmt,                       // C = A - B
        totalConsumedQty, totalConsumedAmt,             // D: consumption
        expectedSalesQty, expectedSalesAmt,             // E = C - D
        consumption: {
          consumed: [{ name, qty, amt }],               // per-customer consumption
          pourBack: [{ name, qty, amt }],               // per-customer pour back
        }
      }
    },
    cashReconciliation: {
      expectedSalesTotal,   // sum of E across all fuels
      totalLodgement,       // bank deposits + cash + other
      totalPOS,
      overshort,            // expected - lodgement - POS
    }
  }
}
```

### Consumption Pricing by Date

Consumption and pour back entries do NOT have a price field. The price comes from the daily sales entry for the same date.

```js
// Build price-by-date lookup from daily sales entries
const priceByDate = {}
for (const e of rangeEntries) {
  if (!e.prices) continue
  priceByDate[e.entryDate] = priceByDate[e.entryDate] || {}
  for (const ft of fuelTypes) {
    const p = Number(e.prices[ft] || 0)
    if (p) priceByDate[e.entryDate][ft] = p
  }
}

// Helper: get the active price for a fuel type on a given date
// Falls back to nearest earlier date, then nearest later date
function getPriceForDate(fuelType, date) {
  if (priceByDate[date]?.[fuelType]) return priceByDate[date][fuelType]
  for (let i = dateStrings.indexOf(date) - 1; i >= 0; i--) {
    if (priceByDate[dateStrings[i]]?.[fuelType]) return priceByDate[dateStrings[i]][fuelType]
  }
  for (let i = dateStrings.indexOf(date) + 1; i < dateStrings.length; i++) {
    if (priceByDate[dateStrings[i]]?.[fuelType]) return priceByDate[dateStrings[i]][fuelType]
  }
  return 0
}

// Each consumption entry priced individually
for (const e of dayData.entries) {
  const qty = Number(e.quantity || 0)
  const price = getPriceForDate(ft, e.entryDate || dayData.date)
  const amt = qty * price
  // ... push { name, qty, amt } and accumulate totals
}
```

**aggregateByName** sums both `qty` and `amt` per customer:
```js
function aggregateByName(items) {
  const map = {}
  for (const item of items) {
    if (!map[item.name]) map[item.name] = { name: item.name, qty: 0, amt: 0 }
    map[item.name].qty += item.qty
    map[item.name].amt += (item.amt || 0)
  }
  return Object.values(map)
}
```

### Key Builder Concepts

**COB (Close-of-Business) tank readings:**
Tank stock uses the COB entry's readings directly — NOT chained like nozzle meters. The builder finds the COB entry for each date (or falls back to the last entry), reads `tankReadings` from it, and carries `prevCobTankReadings` forward for the next date's opening.

```js
const cobEntry = [...dateEntries].reverse().find(e => e.closeOfBusiness || e.close_of_business)
const tankEntry = cobEntry || dateEntries[dateEntries.length - 1] || null
```

**Nozzle→tank dispensed mapping:**
Built once from nozzle config, accumulated during the nozzle row loop:
```js
const nozzleTankMap = {}
for (const nc of nozzles) { if (nc.tank_id) nozzleTankMap[nc.id] = nc.tank_id }
// Inside nozzle loop:
const tid = nozzleTankMap[n.pumpId]
if (tid) dispensedByTankId[tid] = (dispensedByTankId[tid] || 0) + n.dispensed
```

**Consumption comparison:**
Compares daily sales nozzle reading consumption/pourBack (inline per-nozzle) against dedicated consumption entries. Flags mismatches per fuel type.

**OV/SH formula:**
```
OV/SH = (closing - opening) - supply + dispensed
```
Positive = overage (green), Negative = shortage (red).

---

## 4. Report Page Pattern (`app/dashboard/reports/*/page.js`)

### Structure

```jsx
'use client'
import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { initialSync } from '@/lib/initialSync'
import { buildSomeReport } from '@/lib/buildSomeReport'

export default function ReportPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ReportContent />
    </Suspense>
  )
}

function ReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  // ... state, queries, rendering
}
```

### Date Range & Generate Button Pattern

Reports use a **committed date range** — the user picks dates, then clicks Generate. The report renders immediately on page load with default dates (1st of current month → today).

```js
const today = new Date()
const pad = (n) => String(n).padStart(2, '0')
const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

// User-editable date inputs
const [startDate, setStartDate] = useState(monthStartStr)
const [endDate, setEndDate] = useState(todayStr)

// Committed range — only updates on Generate click (initialized to defaults for auto-render)
const [generated, setGenerated] = useState(true)
const [reportStart, setReportStart] = useState(monthStartStr)
const [reportEnd, setReportEnd] = useState(todayStr)

const handleGenerate = () => {
  if (!startDate || !endDate) return
  setReportStart(startDate)
  setReportEnd(endDate)
  setGenerated(true)
}

// useMemo uses reportStart/reportEnd (committed), NOT startDate/endDate (input)
const report = useMemo(() => {
  if (!generated || !reportStart || !reportEnd) return null
  // ... build report with reportStart, reportEnd
}, [generated, reportStart, reportEnd, ...otherDeps])
```

**Generate button in JSX:**
```jsx
<button
  onClick={handleGenerate}
  disabled={!startDate || !endDate || startDate > endDate}
  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
>
  Generate
</button>
```

**Empty/loading states:**
```jsx
{!generated ? (
  <div className="flex-1 flex items-center justify-center">
    <p className="text-gray-400 text-sm">Select a date range and click Generate.</p>
  </div>
) : !report ? (
  <div className="flex justify-center py-20">
    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
  </div>
) : (
  /* render report */
)}
```

### Data Flow (IMPORTANT)

1. **Config** loaded once via `useEffect` → `useState` (nozzles, tanks, banks)
2. **Entries** loaded reactively via `useLiveQuery` (auto-updates when IndexedDB changes)
3. **Report** derived via `useMemo` calling the builder — uses **committed** date range (reportStart/reportEnd)
4. **No useEffect+setState for derived data** — useMemo eliminates timing gaps

```js
// Config (one-time load)
const [nozzles, setNozzles] = useState([])
const [tanks, setTanks] = useState([])
const [banks, setBanks] = useState([])

// Reactive entries (auto-update)
const liveSales = useLiveQuery(() => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [], [orgId])
const liveReceipts = useLiveQuery(() => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [], [orgId])
const liveLodgements = useLiveQuery(() => orgId ? db.lodgements.where('orgId').equals(orgId).toArray() : [], [orgId])
const liveConsumption = useLiveQuery(() => orgId ? db.consumption.where('orgId').equals(orgId).toArray() : [], [orgId])
const liveCustomers = useLiveQuery(() => orgId ? db.customers.where('orgId').equals(orgId).toArray() : [], [orgId])

// Derived: customer name lookup
const customerMap = useMemo(() => {
  if (!liveCustomers) return {}
  return Object.fromEntries(liveCustomers.map(c => [c.id, c.name || 'Unknown']))
}, [liveCustomers])

// Derived: report (synchronous, no timing gaps)
const report = useMemo(() => {
  if (!generated || !reportStart || !reportEnd) return null
  if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts || !liveLodgements || !liveConsumption) return null
  return buildDailyReport({ sales: liveSales, receipts: liveReceipts, lodgements: liveLodgements, consumption: liveConsumption, nozzles, tanks, banks, startDate: reportStart, endDate: reportEnd })
}, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, banks, liveSales, liveReceipts, liveLodgements, liveConsumption])
```

### Hook Ordering Rule

ALL `useMemo` and `useEffect` hooks MUST be placed BEFORE any early returns (`if (loading) return ...`). React hooks must be called in the same order every render. Violating this causes Vercel build failures.

### Duplicate COB Detection

```js
const duplicateDates = useMemo(() => {
  if (!liveSales) return []
  const cobCountByDate = {}
  for (const e of liveSales) {
    if (!e.closeOfBusiness && !e.close_of_business) continue
    const d = e.entryDate || e.entry_date
    cobCountByDate[d] = (cobCountByDate[d] || 0) + 1
  }
  return Object.entries(cobCountByDate).filter(([, c]) => c > 1).map(([d]) => d)
}, [liveSales])
```

---

## 5. Helper Function Pattern (`lib/*Calculations.js`)

### Template

```js
const FUEL_ORDER = ['PMS', 'AGO', 'DPK']

function sortEntries(entries) {
  return [...entries].sort((a, b) =>
    (a.entryDate || '').localeCompare(b.entryDate || '') ||
    (a.createdAt || '').localeCompare(b.createdAt || '')
  )
}

function getDateRange(startDate, endDate) {
  const pad = (n) => String(n).padStart(2, '0')
  const dates = []
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function calculateDateRange*(allEntries, config, startDate, endDate) {
  const sorted = sortEntries(allEntries)
  const dateStrings = getDateRange(startDate, endDate)

  // O(n) grouping
  const entriesByDate = {}
  for (const e of sorted) {
    const d = e.entryDate || ''
    if (!entriesByDate[d]) entriesByDate[d] = []
    entriesByDate[d].push(e)
  }

  const dates = dateStrings.map(date => {
    const dayEntries = entriesByDate[date] || []
    // ... compute per-date results ...
    return { date, ..., hasEntry: dayEntries.length > 0, entryCount: dayEntries.length }
  })

  return { dates }
}

export { sortEntries, calculateDateRange* }
```

### Chaining vs Absolute Readings

- **Nozzle meters** chain: prev closing → next opening (across entries and days)
- **Tank stock** uses absolute COB readings — NOT chained (handled in builder, not helper)
- **Lodgements** chain running balances per bank
- **Receipts** and **consumption** are standalone per-date aggregations (no chaining)

---

## 6. Layout & Styling

### Page Container

```jsx
<div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
  {/* Header — shrink-0 */}
  {/* Scrollable content — flex-1 overflow-y-auto overflow-x-auto min-h-0 */}
  {/* Day tabs — shrink-0 */}
</div>
```

- Use `100dvh` (dynamic viewport height) — accounts for mobile browser chrome (address bar, etc.)
- `3.5rem` = header height (`h-14`)
- This makes the container fill exactly the device screen minus the header, so bottom tabs sit at the true bottom of the screen

### CSS Class Constants

```js
const hdr = 'bg-blue-600 text-white'
const subHdr = 'bg-blue-50 text-blue-900'
const bdr = 'border border-blue-200'
const cell = `${bdr} px-1 py-0.5`
const cellR = `${cell} text-right`
```

### Formatting

```js
function fmt(n) {    // integers with thousands separator
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtDec(n) { // 2 decimal places
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
```

### Responsive Grid

```jsx
<div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 pb-4 min-w-[700px]">
  {/* LEFT: nozzle data table */}
  {/* RIGHT: stock, consumption, lodgements, summary */}
</div>
```

### OV/SH Color

```js
const ovshColor = row.ovsh < 0 ? 'text-red-600' : row.ovsh > 0 ? 'text-green-600' : ''
```

---

## 7. Day Tab Navigation

### Mobile: touch-scrollable

```jsx
<div className="flex overflow-x-auto justify-center shrink-0 border-t border-blue-200 md:hidden">
  {report.dateReports.map(dr => (
    <button onClick={() => setViewDate(dr.date)}
      className={`... ${isActive ? 'bg-blue-600 text-white' : dr.hasEntry ? 'bg-white text-blue-900' : 'bg-gray-50 text-gray-400'}`}>
      {d.getDate()}
    </button>
  ))}
</div>
```

### Desktop: arrow-controlled window (TAB_COUNT = 31)

Auto-scroll when `viewDate` changes to keep it visible.

---

## 8. Sub-Components (Module-Level Only)

### EntryGroup

Renders all fuel groups for one entry. Shows "Entry N" header only when `entryCount > 1`.

### FuelGroup

- Item rows: label | opening | closing | dispensed | consumption | (blank) | (blank) | (blank)
- Subtotal row: (blank) | (blank) | (blank) | dispensed | consumed | actual | price | amount

**NEVER define components inside render functions** — causes input focus loss on every keystroke. Always define at module level.

---

## 9. Consumption Section Rendering

### Entries table (matches form columns minus date/notes)

Columns: Account | Fuel | Qty | Type (Consumption / Pour Back)

```jsx
{currentDayReport.consumption.entries.map((c, i) => (
  <tr key={i}>
    <td>{customerMap[c.customerId] || 'Unknown'}</td>
    <td>{c.fuelType}</td>
    <td>{fmt(c.quantity)}</td>
    <td>{c.isPourBack ? 'Pour Back' : 'Consumption'}</td>
  </tr>
))}
```

### Comparison notice box

Compact box comparing nozzle reading totals vs consumption entry totals. Green = match, red = mismatch.

```jsx
<div className={`text-xs px-3 py-2 border rounded ${hasMismatch ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
  {/* Per fuel type: "PMS consumption: 50L dispensed vs 45L entered (mismatch)" */}
</div>
```

---

## 10. Critical Rules (Bugs We've Fixed)

1. **useMemo for derived data, NOT useEffect+setState** — eliminates timing gaps where report shows stale data
2. **All hooks before early returns** — React hooks must be called in same order every render (Vercel build fails otherwise)
3. **COB-based tank stock, not chained** — tank readings come from the close-of-business entry directly
4. **Only one COB entry per date** — form blocks duplicate COB, report warns if duplicates exist
5. **Client-generated UUIDs preserved in POST routes** — prevents sync engine from creating duplicate entries
6. **No components defined inside render functions** — causes unmount/remount on every render → input focus loss
7. **API routes must SELECT all fields needed by calculations** — missing fields silently produce 0

---

## 11. IndexedDB Tables Used by Reports

| Table | Key Fields | Used By |
|---|---|---|
| `dailySales` | orgId, entryDate, nozzleReadings, tankReadings, prices, closeOfBusiness | Nozzle helper, builder (tanks, prices) |
| `productReceipts` | orgId, entryDate, tankId, actualVolume | Receipt helper |
| `lodgements` | orgId, salesDate, bankId, amount | Lodgement helper |
| `consumption` | orgId, entryDate, customerId, quantity, fuelType, isPourBack | Consumption helper |
| `nozzles` | orgId, fuel_type, pump_number, tank_id, initial_reading | Config |
| `tanks` | orgId, fuel_type, tank_number, opening_stock | Config |
| `banks` | orgId, bank_name, lodgement_type, opening_balance | Config |
| `customers` | orgId, name, phone | Customer name lookup |

---

## 12. Checklist for New Report Pages

1. [ ] Identify which helpers you need (reuse existing ones)
2. [ ] Create builder in `lib/build*Report.js` — pure function, imports helpers
3. [ ] Builder calls helpers, indexes by date, combines per-date
4. [ ] Create page in `app/dashboard/reports/*/page.js`
5. [ ] Wrap in `<Suspense>` for `useSearchParams`
6. [ ] Load config via `useEffect` + IndexedDB
7. [ ] Load entries via `useLiveQuery` (reactive)
8. [ ] Default dates: 1st of current month → today
9. [ ] Use `DateInput` component for all date inputs (NOT `<input type="date">`)
10. [ ] Add committed date range state (`generated`, `reportStart`, `reportEnd`) — initialized to defaults so report renders on load
11. [ ] Add Generate button next to date inputs
11. [ ] Derive report via `useMemo(builder)` using committed range — NOT useEffect+setState
12. [ ] ALL hooks BEFORE early returns
13. [ ] Use consistent CSS classes: `hdr`, `subHdr`, `bdr`, `cell`, `cellR`
14. [ ] Use `fmt()` / `fmtDec()` for number formatting
15. [ ] Include day tab navigation if per-date report (mobile + desktop)
16. [ ] Include edit dropdown linking to entry forms with `?edit=<id>`
17. [ ] Sub-components at module level only
18. [ ] If consumption amounts needed, use price-by-date lookup (never hardcode `lastPrice`)

## 13. DateInput Component

All date inputs use the custom `DateInput` component (`components/DateInput.js`) instead of `<input type="date">`.

### Usage

```jsx
import DateInput from '@/components/DateInput'

// value = YYYY-MM-DD string, onChange receives YYYY-MM-DD string (NOT an event object)
<DateInput
  value={formDate}
  onChange={setFormDate}
  className="w-full px-3 py-2.5 text-base bg-transparent focus:bg-blue-50"
/>
```

### Features
- **Display format**: DD/MM/YYYY (IMask enforced)
- **Storage format**: YYYY-MM-DD (same as native date input)
- **Keyboard shortcuts**: `+`/`-` (next/prev day), `t` (today), `y` (yesterday)
- **Smart parsing**: type just a day number (e.g. `5`), day/month (e.g. `5/3`), or full date
- **Calendar picker**: click calendar icon for visual date selection
- **Empty values**: gracefully handles empty/null — shows empty input, no error

### In Report Pages

Date range inputs use DateInput with the same committed date range pattern:

```jsx
<DateInput
  value={startDate}
  onChange={setStartDate}
  className="px-2 py-2 border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
<span className="text-sm text-gray-400">to</span>
<DateInput
  value={endDate}
  onChange={setEndDate}
  className="px-2 py-2 border border-gray-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
```

### In Entry Forms

- Date fields are **NOT required** — entries can be saved without a date
- Do NOT add `if (!formDate) { setError('Date is required'); return }` validation
- DateInput is a direct replacement: swap `onChange={(e) => setX(e.target.value)}` with `onChange={setX}`
- For forms using the `sf()` pattern (like product-receipt), use inline handler: `(v) => setForm(prev => ({ ...prev, fieldName: v }))`

### Empty Date Fallback in List Pages

When rendering entries in list pages, entries without dates fall back to the nearest adjacent entry's date:

```jsx
const pageEntries = allEntries.slice((page - 1) * limit, page * limit)
const entries = pageEntries.map((entry, i) => {
  if (entry.entryDate) return entry
  for (let j = i - 1; j >= 0; j--) { if (pageEntries[j].entryDate) return { ...entry, _displayDate: pageEntries[j].entryDate }; break }
  for (let j = i + 1; j < pageEntries.length; j++) { if (pageEntries[j].entryDate) return { ...entry, _displayDate: pageEntries[j].entryDate }; break }
  return entry
})

// In JSX:
{(entry.entryDate || entry._displayDate)
  ? format(new Date((entry.entryDate || entry._displayDate) + 'T00:00:00'), 'MMM d, yyyy')
  : 'No date'}
```

### Dependencies

DateInput requires: `imask`, `react-datepicker`, `date-fns`, `lucide-react` (Calendar icon)

---

## 14. Checklist for New Helper Functions

1. [ ] Create in `lib/*Calculations.js`
2. [ ] Include `sortEntries()` and `getDateRange()` (or import shared)
3. [ ] Main export: `calculateDateRange*(entries, config, startDate, endDate)`
4. [ ] Sort once, group by date in O(n), iterate date range
5. [ ] Return `{ dates: [{ date, ..., hasEntry, entryCount }] }`
6. [ ] Pure function — no IndexedDB, no side effects
7. [ ] Export all functions individually (no default export)
