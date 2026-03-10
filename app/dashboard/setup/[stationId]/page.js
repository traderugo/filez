'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Loader2, MapPin, Fuel, ChevronRight, ChevronLeft, Check,
  Plus, Trash2, ArrowRight, Landmark, CreditCard, Banknote,
  Droplets, Users
} from 'lucide-react'

const FUEL_TYPES = ['PMS', 'AGO', 'DPK']
const LODGEMENT_TYPES = [
  { value: 'pos', label: 'POS' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

export default function SetupWizardPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [stationName, setStationName] = useState('')
  const [loading, setLoading] = useState(true)

  // Step 1: Location + Group
  const [location, setLocation] = useState('')
  const [stationGroup, setStationGroup] = useState('')

  // Step 2: Nozzles
  const [nozzles, setNozzles] = useState([])

  // Step 3: Tanks
  const [tanks, setTanks] = useState([])

  // Step 4: Mappings (auto-built from nozzles + tanks)
  const [mappings, setMappings] = useState({}) // { "PMS-1": tank_number }

  // Step 5: Lodgements
  const [lodgements, setLodgements] = useState([])

  // Step 6: Lube Products
  const [lubeProducts, setLubeProducts] = useState([])

  // Step 7: Credit Customers
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/organizations')
      if (res.ok) {
        const data = await res.json()
        const station = (data.stations || []).find((s) => s.id === stationId)
        if (station) {
          if (station.onboarding_complete) {
            router.push(`/dashboard/stations/${stationId}`)
            return
          }
          setStationName(station.name)
          if (station.location) setLocation(station.location)
        }
      }
      setLoading(false)
    }
    load()
  }, [stationId, router])

  // Nozzle helpers
  const addNozzle = () => {
    setNozzles((prev) => {
      const fuelType = 'PMS'
      const count = prev.filter((n) => n.fuel_type === fuelType).length
      return [...prev, { fuel_type: fuelType, pump_number: count + 1, initial_reading: 0 }]
    })
  }
  const updateNozzle = (i, field, value) => {
    setNozzles((prev) => {
      const updated = prev.map((n, idx) => idx === i ? { ...n, [field]: value } : n)
      // Recalculate pump_number when fuel_type changes
      if (field === 'fuel_type') {
        const countBefore = updated.slice(0, i).filter((n) => n.fuel_type === value).length
        updated[i] = { ...updated[i], pump_number: countBefore + 1 }
        // Renumber all nozzles of the old and new fuel type
        const oldType = prev[i].fuel_type
        const typesToFix = new Set([oldType, value])
        typesToFix.forEach((ft) => {
          let num = 1
          for (let j = 0; j < updated.length; j++) {
            if (updated[j].fuel_type === ft) {
              updated[j] = { ...updated[j], pump_number: num++ }
            }
          }
        })
      }
      return updated
    })
  }
  const removeNozzle = (i) => {
    setNozzles((prev) => {
      const filtered = prev.filter((_, idx) => idx !== i)
      // Renumber per fuel type
      const counts = {}
      return filtered.map((n) => {
        counts[n.fuel_type] = (counts[n.fuel_type] || 0) + 1
        return { ...n, pump_number: counts[n.fuel_type] }
      })
    })
  }

  // Tank helpers
  const addTank = () => {
    setTanks((prev) => [...prev, { fuel_type: 'PMS', tank_number: prev.length + 1, capacity: 0, opening_stock: 0 }])
  }
  const updateTank = (i, field, value) => {
    setTanks((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }
  const removeTank = (i) => {
    setTanks((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Lodgement helpers
  const addLodgement = () => {
    setLodgements((prev) => [...prev, { lodgement_type: 'pos', bank_name: '', terminal_id: '', opening_balance: 0 }])
  }
  const updateLodgement = (i, field, value) => {
    setLodgements((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }
  const removeLodgement = (i) => {
    setLodgements((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Lube product helpers
  const addLubeProduct = () => {
    setLubeProducts((prev) => [...prev, { product_name: '', unit_price: 0, opening_stock: 0 }])
  }
  const updateLubeProduct = (i, field, value) => {
    setLubeProducts((prev) => prev.map((lp, idx) => idx === i ? { ...lp, [field]: value } : lp))
  }
  const removeLubeProduct = (i) => {
    setLubeProducts((prev) => prev.filter((_, idx) => idx !== i))
  }

  // Customer helpers
  const addCustomer = () => {
    setCustomers((prev) => [...prev, { name: '', phone: '', opening_balance: 0 }])
  }
  const updateCustomer = (i, field, value) => {
    setCustomers((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }
  const removeCustomer = (i) => {
    setCustomers((prev) => prev.filter((_, idx) => idx !== i))
  }

  const totalSteps = 7

  const canNext = () => {
    if (step === 1) return location.trim().length > 0
    if (step === 2) return nozzles.length > 0
    if (step === 3) return tanks.length > 0
    if (step === 4) {
      // Every nozzle must be mapped to a tank
      if (nozzles.length === 0 || tanks.length === 0) return false
      return nozzles.every((n) => {
        const key = `${n.fuel_type}-${n.pump_number}`
        return mappings[key] && mappings[key] > 0
      })
    }
    if (step === 5) return true
    return true
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')

    // Build mapping array from state
    const mappingArr = Object.entries(mappings).map(([key, tankNum]) => {
      const [fuelType, pumpNum] = key.split('-')
      return { fuel_type: fuelType, nozzle_pump_number: Number(pumpNum), tank_number: Number(tankNum) }
    }).filter((m) => m.tank_number > 0)

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: stationId,
        location,
        station_group: stationGroup.trim() || null,
        nozzles,
        tanks,
        mappings: mappingArr,
        lodgements,
        lube_products: lubeProducts,
        customers,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to save')
      setSaving(false)
      return
    }

    router.push(`/dashboard/stations/${stationId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-lg px-4 sm:px-8 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Set up {stationName || 'Station'}</h1>
      <p className="text-sm text-gray-500 mb-6">Step {step} of {totalSteps}</p>

      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Step 1: Location */}
      {step === 1 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" /> Station Location
          </h2>
          <input
            type="text"
            placeholder="e.g. 12 Lekki-Epe Expressway, Lagos"
            maxLength={200}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            autoFocus
          />
          <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
          <input
            type="text"
            placeholder="e.g. North Region, Zone A"
            maxLength={100}
            value={stationGroup}
            onChange={(e) => setStationGroup(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Used to group stations together. Cannot be changed later.</p>
        </div>
      )}

      {/* Step 2: Nozzles */}
      {step === 2 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-blue-600" /> Nozzles
          </h2>
          <p className="text-xs text-gray-500 mb-4">Add each nozzle with its fuel type and opening meter reading.</p>

          <div className="divide-y divide-gray-200 mb-4">
            {nozzles.map((n, i) => (
              <div key={i} className="flex items-center gap-2 py-3 first:pt-0">
                <select
                  value={n.fuel_type}
                  onChange={(e) => updateNozzle(i, 'fuel_type', e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Opening reading"
                  min={0}
                  value={n.initial_reading || ''}
                  onChange={(e) => updateNozzle(i, 'initial_reading', Number(e.target.value))}
                  className="flex-1 px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeNozzle(i)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addNozzle}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add nozzle
          </button>
        </div>
      )}

      {/* Step 3: Tanks */}
      {step === 3 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-blue-600" /> Underground Tanks
          </h2>
          <p className="text-xs text-gray-500 mb-4">Add each tank with its capacity and current stock level.</p>

          <div className="divide-y divide-gray-200 mb-4">
            {tanks.map((t, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap py-3 first:pt-0">
                <select
                  value={t.fuel_type}
                  onChange={(e) => updateTank(i, 'fuel_type', e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Capacity (L)"
                  min={0}
                  value={t.capacity || ''}
                  onChange={(e) => updateTank(i, 'capacity', Number(e.target.value))}
                  className="flex-1 min-w-[100px] px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Opening stock (L)"
                  min={0}
                  value={t.opening_stock || ''}
                  onChange={(e) => updateTank(i, 'opening_stock', Number(e.target.value))}
                  className="flex-1 min-w-[100px] px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeTank(i)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addTank}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add tank
          </button>
        </div>
      )}

      {/* Step 4: Tank to Nozzle Mapping */}
      {step === 4 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-blue-600" /> Tank to Nozzle Mapping
          </h2>
          <p className="text-xs text-gray-500 mb-4">Select which underground tank feeds each nozzle.</p>

          {nozzles.length === 0 || tanks.length === 0 ? (
            <p className="text-sm text-gray-500">Add nozzles and tanks first.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {nozzles.map((n, i) => {
                const key = `${n.fuel_type}-${n.pump_number || i + 1}`
                const sameFuelTanks = tanks.filter((t) => t.fuel_type === n.fuel_type)
                return (
                  <div key={i} className="flex items-center gap-3 py-3 first:pt-0">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{n.fuel_type} {n.pump_number}</span>
                      <span className="text-xs text-gray-500 ml-2">({n.fuel_type})</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <select
                      value={mappings[key] || ''}
                      onChange={(e) => setMappings((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                      className="px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select tank</option>
                      {sameFuelTanks.map((t, ti) => (
                        <option key={ti} value={t.tank_number}>
                          Tank {t.tank_number} ({t.fuel_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Lodgements */}
      {step === 5 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-blue-600" /> Lodgements
          </h2>
          <p className="text-xs text-gray-500 mb-4">Add POS terminals, bank deposit accounts, cash, etc. with their current balances.</p>

          <div className="divide-y divide-gray-200 mb-4">
            {lodgements.map((l, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap py-3 first:pt-0">
                <select
                  value={l.lodgement_type}
                  onChange={(e) => updateLodgement(i, 'lodgement_type', e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LODGEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Bank name"
                  maxLength={100}
                  value={l.bank_name}
                  onChange={(e) => updateLodgement(i, 'bank_name', e.target.value)}
                  className="flex-1 min-w-[100px] px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {l.lodgement_type === 'pos' && (
                  <input
                    type="text"
                    placeholder="Terminal ID"
                    maxLength={50}
                    value={l.terminal_id}
                    onChange={(e) => updateLodgement(i, 'terminal_id', e.target.value)}
                    className="flex-1 min-w-[100px] px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                <input
                  type="number"
                  placeholder="Opening balance"
                  min={0}
                  value={l.opening_balance || ''}
                  onChange={(e) => updateLodgement(i, 'opening_balance', Number(e.target.value))}
                  className="flex-1 min-w-[100px] px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeLodgement(i)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addLodgement}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add lodgement
          </button>
        </div>
      )}

      {/* Step 6: Lube Products */}
      {step === 6 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-600" /> Lube Products
          </h2>
          <p className="text-xs text-gray-500 mb-4">Add lubricant products with their current stock levels. Skip if not applicable.</p>

          <div className="divide-y divide-gray-200 mb-4">
            {lubeProducts.map((lp, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap py-3 first:pt-0">
                <input
                  type="text"
                  placeholder="Product name"
                  maxLength={200}
                  value={lp.product_name}
                  onChange={(e) => updateLubeProduct(i, 'product_name', e.target.value)}
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Unit price"
                  min={0}
                  step="0.01"
                  value={lp.unit_price || ''}
                  onChange={(e) => updateLubeProduct(i, 'unit_price', Number(e.target.value))}
                  className="w-24 px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Opening stock"
                  min={0}
                  value={lp.opening_stock || ''}
                  onChange={(e) => updateLubeProduct(i, 'opening_stock', Number(e.target.value))}
                  className="w-28 px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeLubeProduct(i)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addLubeProduct}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add product
          </button>
        </div>
      )}

      {/* Step 7: Credit Customers */}
      {step === 7 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Credit Customers
          </h2>
          <p className="text-xs text-gray-500 mb-4">Add customers who buy on credit with their outstanding balance. Skip if not applicable.</p>

          <div className="divide-y divide-gray-200 mb-4">
            {customers.map((c, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap py-3 first:pt-0">
                <input
                  type="text"
                  placeholder="Customer name"
                  maxLength={200}
                  value={c.name}
                  onChange={(e) => updateCustomer(i, 'name', e.target.value)}
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  maxLength={20}
                  value={c.phone}
                  onChange={(e) => updateCustomer(i, 'phone', e.target.value)}
                  className="w-32 px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Opening balance"
                  min={0}
                  step="0.01"
                  value={c.opening_balance || ''}
                  onChange={(e) => updateCustomer(i, 'opening_balance', Number(e.target.value))}
                  className="w-32 px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeCustomer(i)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addCustomer}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add customer
          </button>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
        {step > 1 ? (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex items-center gap-1 px-4 py-2 border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        ) : (
          <div />
        )}

        {step < totalSteps ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1 px-6 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Complete Setup
          </button>
        )}
      </div>
    </div>
  )
}
