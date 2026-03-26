'use client'

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Plus, Trash2, Pencil, Download, FileImage, X, Camera, Search } from 'lucide-react'
import DateInput from '@/components/DateInput'
import AccessGate from '@/components/AccessGate'
import { fmtDate } from '@/lib/formatDate'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function ImprestPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
      <ImprestContent />
    </Suspense>
  )
}

function ImprestContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // Period state
  const [period, setPeriod] = useState(null)
  const [loadingPeriod, setLoadingPeriod] = useState(true)
  const [imprestAmount, setImprestAmount] = useState('')
  const [custodianName, setCustodianName] = useState('')
  const [formNumber, setFormNumber] = useState('')
  const [savingPeriod, setSavingPeriod] = useState(false)

  // Entries state
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formDate, setFormDate] = useState('')
  const [formBeneficiary, setFormBeneficiary] = useState('')
  const [formDetails, setFormDetails] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formAccountCode, setFormAccountCode] = useState('')
  const [formPcv, setFormPcv] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  // Beneficiary search
  const [customers, setCustomers] = useState([])
  const [beneficiaryQuery, setBeneficiaryQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef(null)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Load customers once
  useEffect(() => {
    if (!orgId) return
    fetch(`/api/entries/customers`)
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []))
      .catch(() => {})
  }, [orgId])

  // Load period when month/year changes
  const loadPeriod = useCallback(async () => {
    if (!orgId) { setLoadingPeriod(false); return }
    setLoadingPeriod(true)
    try {
      const res = await fetch(`/api/entries/imprest?month=${month}&year=${year}`)
      const data = await res.json()
      if (data.period) {
        setPeriod(data.period)
        setImprestAmount(String(data.period.imprest_amount || ''))
        setCustodianName(data.period.custodian_name || '')
        setFormNumber(data.period.form_number || '')
      } else {
        setPeriod(null)
        setImprestAmount('')
        setCustodianName('')
        setFormNumber('')
      }
    } catch {
      setPeriod(null)
    }
    setLoadingPeriod(false)
  }, [orgId, month, year])

  useEffect(() => { loadPeriod() }, [loadPeriod])

  // Load entries when period changes
  const loadEntries = useCallback(async () => {
    if (!period?.id) { setEntries([]); return }
    setLoadingEntries(true)
    try {
      const res = await fetch(`/api/entries/imprest/entries?period_id=${period.id}&limit=100`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch {
      setEntries([])
    }
    setLoadingEntries(false)
  }, [period?.id])

  useEffect(() => { loadEntries() }, [loadEntries])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filtered suggestions
  const filteredCustomers = useMemo(() => {
    if (!beneficiaryQuery.trim()) return customers.slice(0, 10)
    const q = beneficiaryQuery.toLowerCase()
    return customers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10)
  }, [beneficiaryQuery, customers])

  // Save/create period
  const handleSavePeriod = async () => {
    if (!imprestAmount) return
    setSavingPeriod(true)
    try {
      const res = await fetch('/api/entries/imprest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, imprest_amount: imprestAmount, custodian_name: custodianName, form_number: formNumber }),
      })
      const data = await res.json()
      if (data.period) {
        setPeriod(data.period)
      }
    } catch {}
    setSavingPeriod(false)
  }

  // Reset form
  const resetForm = () => {
    setEditingId(null)
    setFormDate('')
    setFormBeneficiary('')
    setBeneficiaryQuery('')
    setFormDetails('')
    setFormAmount('')
    setFormAccountCode('')
    setFormPcv('')
    setFormImageUrl('')
    setShowForm(false)
  }

  // Edit entry
  const startEdit = (entry) => {
    setEditingId(entry.id)
    setFormDate(entry.entry_date)
    setFormBeneficiary(entry.beneficiary)
    setBeneficiaryQuery(entry.beneficiary)
    setFormDetails(entry.transaction_details || '')
    setFormAmount(String(entry.amount || ''))
    setFormAccountCode(entry.account_code || '')
    setFormPcv(entry.pcv_number || '')
    setFormImageUrl(entry.receipt_image_url || '')
    setShowForm(true)
  }

  // Upload image
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/entries/imprest/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setFormImageUrl(data.url)
      else alert(data.error || 'Upload failed')
    } catch {
      alert('Upload failed')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Save entry
  const handleSaveEntry = async () => {
    if (!formDate || !formBeneficiary.trim() || !formAmount) return
    if (!period?.id) return
    setSaving(true)
    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/entries/imprest/entries/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_date: formDate,
            beneficiary: formBeneficiary,
            transaction_details: formDetails,
            amount: formAmount,
            account_code: formAccountCode,
            pcv_number: formPcv,
            receipt_image_url: formImageUrl,
          }),
        })
        if (res.ok) { resetForm(); await loadEntries() }
      } else {
        // Create
        const res = await fetch('/api/entries/imprest/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imprest_period_id: period.id,
            entry_date: formDate,
            beneficiary: formBeneficiary,
            transaction_details: formDetails,
            amount: formAmount,
            account_code: formAccountCode,
            pcv_number: formPcv,
            receipt_image_url: formImageUrl,
          }),
        })
        if (res.ok) { resetForm(); await loadEntries() }
      }
    } catch {}
    setSaving(false)
  }

  // Delete entry
  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    try {
      await fetch(`/api/entries/imprest/entries/${id}`, { method: 'DELETE' })
      await loadEntries()
    } catch {}
  }

  // Totals
  const totalSpent = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const imprestAmt = Number(period?.imprest_amount) || 0
  const balance = imprestAmt - totalSpent

  // Excel export
  const handleExcelExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const { exportImprestExcel } = await import('@/lib/exportImprestExcel')
      await exportImprestExcel({
        month, year, imprestAmount: imprestAmt, custodianName: period?.custodian_name || '',
        formNumber: period?.form_number || '', entries, totalSpent, balance,
      })
    } catch (err) {
      console.error('Excel export failed:', err)
      alert('Export failed')
    }
    setExporting(false)
  }

  // PDF export
  const handlePdfExport = async () => {
    if (exportingPdf) return
    const withImages = entries.filter(e => e.receipt_image_url)
    if (!withImages.length) { alert('No receipt images to export'); return }
    setExportingPdf(true)
    try {
      const { exportImprestReceiptsPdf } = await import('@/lib/exportImprestReceiptsPdf')
      await exportImprestReceiptsPdf({
        entries: withImages, month, year, custodianName: period?.custodian_name || '',
      })
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed')
    }
    setExportingPdf(false)
  }

  if (!orgId) {
    return <div className="text-center py-20 text-gray-400">No station selected</div>
  }

  return (
    <AccessGate orgId={orgId} pageKey="imprest">
      {({ isOwner }) => (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Imprest / Petty Cash</h1>

      {/* Month / Year selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2099} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24" />
      </div>

      {loadingPeriod ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* Period setup */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Period Settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Imprest Amount (₦)</label>
                <input type="number" value={imprestAmount} onChange={e => setImprestAmount(e.target.value)} placeholder="e.g. 130000" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Custodian Name</label>
                <input type="text" value={custodianName} onChange={e => setCustodianName(e.target.value)} placeholder="Petty cash custodian" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Form Number</label>
                <input type="text" value={formNumber} onChange={e => setFormNumber(e.target.value)} placeholder="Optional" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleSavePeriod} disabled={savingPeriod || !imprestAmount} className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
              {savingPeriod ? 'Saving...' : period ? 'Update Period' : 'Create Period'}
            </button>
          </div>

          {/* Summary cards */}
          {period && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gray-50 border rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Imprest</p>
                <p className="text-lg font-bold text-gray-900">₦{fmt(imprestAmt)}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500">Total Spent</p>
                <p className="text-lg font-bold text-orange-700">₦{fmt(totalSpent)}</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${balance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-xs text-gray-500">Balance</p>
                <p className={`text-lg font-bold ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>₦{fmt(balance)}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          {period && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Add Entry
              </button>
              {isOwner && (
              <button onClick={handleExcelExport} disabled={exporting || !entries.length} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40">
                <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Excel'}
              </button>
              )}
              {isOwner && (
              <button onClick={handlePdfExport} disabled={exportingPdf || !entries.length} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40">
                <FileImage className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Receipts PDF'}
              </button>
              )}
            </div>
          )}

          {/* Entry form */}
          {showForm && period && (
            <div className="bg-white border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">{editingId ? 'Edit Entry' : 'New Entry'}</h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="text-xs text-gray-500">Date</label>
                  <DateInput value={formDate} onChange={setFormDate} className="mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                {/* Beneficiary with fuzzy search */}
                <div className="relative" ref={suggestionsRef}>
                  <label className="text-xs text-gray-500">Beneficiary</label>
                  <div className="mt-1 flex items-center border border-gray-300 rounded-lg px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-gray-400 mr-2 flex-shrink-0" />
                    <input
                      type="text"
                      value={beneficiaryQuery}
                      onChange={e => { setBeneficiaryQuery(e.target.value); setFormBeneficiary(e.target.value); setShowSuggestions(true) }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Search accounts..."
                      className="w-full text-sm focus:outline-none"
                    />
                  </div>
                  {showSuggestions && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button key={c.id} type="button" onClick={() => { setFormBeneficiary(c.name); setBeneficiaryQuery(c.name); setShowSuggestions(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0">
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transaction details */}
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500">Transaction Details</label>
                  <input type="text" value={formDetails} onChange={e => setFormDetails(e.target.value)} placeholder="What was the expense for?" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs text-gray-500">Amount (₦)</label>
                  <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                {/* Account code */}
                <div>
                  <label className="text-xs text-gray-500">Account Code</label>
                  <input type="text" value={formAccountCode} onChange={e => setFormAccountCode(e.target.value)} placeholder="Optional" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                {/* PCV Number */}
                <div>
                  <label className="text-xs text-gray-500">PCV Number</label>
                  <input type="text" value={formPcv} onChange={e => setFormPcv(e.target.value)} placeholder="Optional" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>

                {/* Receipt image */}
                <div>
                  <label className="text-xs text-gray-500">Receipt Image</label>
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40">
                      <Camera className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                    {formImageUrl && (
                      <a href={formImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline truncate max-w-[120px]">View</a>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button onClick={handleSaveEntry} disabled={saving || !formDate || !formBeneficiary.trim() || !formAmount} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </button>
                <button onClick={resetForm} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {/* Entries table */}
          {period && (
            loadingEntries ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : entries.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No entries yet for {MONTHS[month - 1]} {year}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                      <th className="py-2 pr-2">S/N</th>
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Beneficiary</th>
                      <th className="py-2 pr-2">Details</th>
                      <th className="py-2 pr-2 text-right">Amount</th>
                      <th className="py-2 pr-2">PCV</th>
                      <th className="py-2 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                        <td className="py-2 pr-2">{e.beneficiary}</td>
                        <td className="py-2 pr-2 text-gray-600 max-w-[200px] truncate">{e.transaction_details || '—'}</td>
                        <td className="py-2 pr-2 text-right font-medium">₦{fmt(e.amount)}</td>
                        <td className="py-2 pr-2 text-gray-500">{e.pcv_number || '—'}</td>
                        <td className="py-2 flex items-center gap-1">
                          {e.receipt_image_url && (
                            <a href={e.receipt_image_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600"><FileImage className="w-4 h-4" /></a>
                          )}
                          <button onClick={() => startEdit(e)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(e.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-bold">
                      <td colSpan={4} className="py-2 text-right pr-2">Total</td>
                      <td className="py-2 text-right pr-2">₦{fmt(totalSpent)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          )}
        </>
      )}
    </div>
      )}
    </AccessGate>
  )
}
