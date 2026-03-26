'use client'

import { Suspense, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import Link from 'next/link'

export default function DipCalculatorPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <DipCalculatorContent />
    </Suspense>
  )
}

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  if (!isFinite(v)) return ''
  return v.toLocaleString('en-NG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const EMPTY_ROW = { chartUllage: '', chartLH: '', depotUllage: '', depotLH: '', stationUllage: '', stationLH: '', highVol: '', lowVol: '', highUllage: '', lowUllage: '' }

function rowFromParams(searchParams, idx) {
  const n = idx + 1
  const g = (key) => searchParams.get(`${key}${n}`) || ''
  return {
    chartUllage: g('cU'), chartLH: g('cL'),
    depotUllage: g('dU'), depotLH: g('dL'),
    stationUllage: g('sU'), stationLH: g('sL'),
    highVol: g('hV'), lowVol: g('lV'),
    highUllage: g('hU'), lowUllage: g('lU'),
  }
}

function hasPrefilledParams(searchParams) {
  return searchParams.has('cU1') || searchParams.has('hV1')
}

function DipCalculatorContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const prefilled = hasPrefilledParams(searchParams)

  const [rows, setRows] = useState(() => {
    if (prefilled) {
      return [0, 1, 2].map(i => rowFromParams(searchParams, i))
    }
    return [{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]
  })

  const updateRow = (idx, field, value) => {
    if (prefilled) return
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const handleReset = () => {
    setRows([{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }])
  }

  const calc = useMemo(() => {
    return rows.map(r => {
      const cU = Number(r.chartUllage) || 0
      const cL = Number(r.chartLH) || 0
      const dU = Number(r.depotUllage) || 0
      const dL = Number(r.depotLH) || 0
      const sU = Number(r.stationUllage) || 0
      const sL = Number(r.stationLH) || 0
      const hV = Number(r.highVol) || 0
      const lV = Number(r.lowVol) || 0
      const hU = Number(r.highUllage) || 0
      const lU = Number(r.lowUllage) || 0

      const ullDenom = hU - lU
      const ullageMF = ullDenom !== 0 ? (hV - lV) / ullDenom : 0
      const lhMF = cL !== 0 ? hV / cL : 0

      // Ullage-based
      const dsUDiff = dU - sU
      const csUDiff = cU - sU
      const cdUDiff = cU - dU
      const dsUVol = dsUDiff * ullageMF
      const csUVol = csUDiff * ullageMF
      const cdUVol = cdUDiff * ullageMF

      // Liquid Height-based
      const dsLDiff = (dL - sL) * -1
      const csLDiff = (cL - sL) * -1
      const cdLDiff = (cL - dL) * -1
      const dsLVol = dsLDiff * lhMF
      const csLVol = csLDiff * lhMF
      const cdLVol = cdLDiff * lhMF

      return { ullageMF, lhMF, dsUDiff, dsUVol, csUDiff, csUVol, cdUDiff, cdUVol, dsLDiff, dsLVol, csLDiff, csLVol, cdLDiff, cdLVol }
    })
  }, [rows])

  const totals = useMemo(() => {
    const sum = (key) => calc.reduce((s, c) => s + c[key], 0)
    return {
      dsUDiff: sum('dsUDiff'), dsUVol: sum('dsUVol'),
      csUDiff: sum('csUDiff'), csUVol: sum('csUVol'),
      cdUDiff: sum('cdUDiff'), cdUVol: sum('cdUVol'),
      dsLDiff: sum('dsLDiff'), dsLVol: sum('dsLVol'),
      csLDiff: sum('csLDiff'), csLVol: sum('csLVol'),
      cdLDiff: sum('cdLDiff'), cdLVol: sum('cdLVol'),
    }
  }, [calc])

  const hdr = 'bg-blue-600 text-white'
  const bdr = 'border border-blue-200'
  const cell = `${bdr} px-2 py-1 text-xs whitespace-nowrap`
  const cellR = `${cell} text-right`
  const inputCls = 'w-full px-1.5 py-1 text-xs text-right bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400'
  const valCell = (v) => prefilled
    ? <span className="block px-1.5 py-1 text-xs text-right">{v || ''}</span>
    : null

  const hasAnyInput = rows.some(r => Object.values(r).some(v => v !== ''))

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[900px] mx-auto px-4 sm:px-6">
      <div className="shrink-0 py-4 flex items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900 mr-auto">Dip Calculator</h1>
        {hasAnyInput && !prefilled && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
        <Link
          href={`/dashboard/reports/product-received?org_id=${orgId}`}
          className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 pb-4 border border-gray-200">
        {/* ─── Input: Readings ─── */}
        <table className="w-full border-collapse min-w-0">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>DEPOT</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>STATION</th>
            </tr>
            <tr className="bg-blue-50">
              <th className={`${cell} text-center w-10`}>#</th>
              <th className={`${cell} text-center`}>Ullage</th>
              <th className={`${cell} text-center`}>Liquid Ht</th>
              <th className={`${cell} text-center`}>Ullage</th>
              <th className={`${cell} text-center`}>Liquid Ht</th>
              <th className={`${cell} text-center`}>Ullage</th>
              <th className={`${cell} text-center`}>Liquid Ht</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-gray-50`}>{i + 1}</td>
                <td className={bdr}>{prefilled ? valCell(r.chartUllage) : <input type="number" value={r.chartUllage} onChange={e => updateRow(i, 'chartUllage', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.chartLH) : <input type="number" value={r.chartLH} onChange={e => updateRow(i, 'chartLH', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.depotUllage) : <input type="number" value={r.depotUllage} onChange={e => updateRow(i, 'depotUllage', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.depotLH) : <input type="number" value={r.depotLH} onChange={e => updateRow(i, 'depotLH', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.stationUllage) : <input type="number" value={r.stationUllage} onChange={e => updateRow(i, 'stationUllage', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.stationLH) : <input type="number" value={r.stationLH} onChange={e => updateRow(i, 'stationLH', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ─── Input: Calibration ─── */}
        <table className="w-full border-collapse min-w-0 mt-4">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`}>Highest Vol</th>
              <th className={`${cell} ${hdr} text-center`}>Lowest Vol</th>
              <th className={`${cell} ${hdr} text-center`}>Highest Ullage</th>
              <th className={`${cell} ${hdr} text-center`}>Lowest Ullage</th>
              <th className={`${cell} ${hdr} text-center`}>Ullage M.F</th>
              <th className={`${cell} ${hdr} text-center`}>Liquid Ht M.F</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-gray-50 w-10`}>{i + 1}</td>
                <td className={bdr}>{prefilled ? valCell(r.highVol) : <input type="number" value={r.highVol} onChange={e => updateRow(i, 'highVol', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.lowVol) : <input type="number" value={r.lowVol} onChange={e => updateRow(i, 'lowVol', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.highUllage) : <input type="number" value={r.highUllage} onChange={e => updateRow(i, 'highUllage', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={bdr}>{prefilled ? valCell(r.lowUllage) : <input type="number" value={r.lowUllage} onChange={e => updateRow(i, 'lowUllage', e.target.value)} className={inputCls} placeholder="0" step="any" />}</td>
                <td className={`${cellR} bg-gray-50 font-medium`}>{fmt(calc[i].ullageMF)}</td>
                <td className={`${cellR} bg-gray-50 font-medium`}>{fmt(calc[i].lhMF)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ─── Results: Ullage-based ─── */}
        <table className="w-full border-collapse min-w-0 mt-4">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>DEPOT TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO DEPOT</th>
            </tr>
            <tr className="bg-blue-50">
              <th className={`${cell} text-center w-10`}>#</th>
              <th className={`${cell} text-center`}>Ullage Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Ullage Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Ullage Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
            </tr>
          </thead>
          <tbody>
            {calc.map((c, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-gray-50`}>{i + 1}</td>
                <td className={cellR}>{fmt(c.dsUDiff)}</td>
                <td className={cellR}>{fmt(c.dsUVol)}</td>
                <td className={cellR}>{fmt(c.csUDiff)}</td>
                <td className={cellR}>{fmt(c.csUVol)}</td>
                <td className={cellR}>{fmt(c.cdUDiff)}</td>
                <td className={cellR}>{fmt(c.cdUVol)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-blue-50">
              <td className={cell}>TOTAL</td>
              <td className={cellR}>{fmt(totals.dsUDiff)}</td>
              <td className={cellR}>{fmt(totals.dsUVol)}</td>
              <td className={cellR}>{fmt(totals.csUDiff)}</td>
              <td className={cellR}>{fmt(totals.csUVol)}</td>
              <td className={cellR}>{fmt(totals.cdUDiff)}</td>
              <td className={cellR}>{fmt(totals.cdUVol)}</td>
            </tr>
          </tbody>
        </table>

        {/* ─── Results: Liquid Height-based ─── */}
        <table className="w-full border-collapse min-w-0 mt-4">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>DEPOT TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO DEPOT</th>
            </tr>
            <tr className="bg-blue-50">
              <th className={`${cell} text-center w-10`}>#</th>
              <th className={`${cell} text-center`}>Liquid Ht Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Liquid Ht Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Liquid Ht Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
            </tr>
          </thead>
          <tbody>
            {calc.map((c, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-gray-50`}>{i + 1}</td>
                <td className={cellR}>{fmt(c.dsLDiff)}</td>
                <td className={cellR}>{fmt(c.dsLVol)}</td>
                <td className={cellR}>{fmt(c.csLDiff)}</td>
                <td className={cellR}>{fmt(c.csLVol)}</td>
                <td className={cellR}>{fmt(c.cdLDiff)}</td>
                <td className={cellR}>{fmt(c.cdLVol)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-blue-50">
              <td className={cell}>TOTAL</td>
              <td className={cellR}>{fmt(totals.dsLDiff)}</td>
              <td className={cellR}>{fmt(totals.dsLVol)}</td>
              <td className={cellR}>{fmt(totals.csLDiff)}</td>
              <td className={cellR}>{fmt(totals.csLVol)}</td>
              <td className={cellR}>{fmt(totals.cdLDiff)}</td>
              <td className={cellR}>{fmt(totals.cdLVol)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
