'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Loader2, Fuel, Plus, Trash2, ArrowRight, Landmark,
  CreditCard, Banknote, MapPin, Save, Droplets, Users
} from 'lucide-react'

const FUEL_TYPES = ['PMS', 'AGO', 'DPK']
const LODGEMENT_TYPES = [
  { value: 'pos', label: 'POS' },
  { value: 'bank_deposit', label: 'Bank Deposit' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

export default function StationSettingsPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [stationName, setStationName] = useState('')
  const [location, setLocation] = useState('')

  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [mappings, setMappings] = useState({})
  const [lodgements, setLodgements] = useState([])
  const [lubeProducts, setLubeProducts] = useState([])
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/stations/${stationId}/config`)
      if (!res.ok) {
        router.push('/dashboard')
        return
      }
      const data = await res.json()
      setStationName(data.station.name)
      setLocation(data.station.location || '')
      setNozzles(data.nozzles.map((n) => ({
        id: n.id,
        fuel_type: n.fuel_type,
        pump_number: n.pump_number,
        initial_reading: n.initial_reading || 0,
      })))
      setTanks(data.tanks.map((t) => ({
        id: t.id,
        fuel_type: t.fuel_type,
        tank_number: t.tank_number,
        capacity: t.capacity || 0,
        opening_stock: t.opening_stock || 0,
      })))
      // Build mappings from nozzle tank_id
      const mappingObj = {}
      for (const n of data.nozzles) {
        if (n.tank_id) {
          const tank = data.tanks.find((t) => t.id === n.tank_id)
          if (tank) {
            mappingObj[`${n.fuel_type}-${n.pump_number}`] = tank.tank_number
          }
        }
      }
      setMappings(mappingObj)
      setLodgements(data.lodgements.map((l) => ({
        id: l.id,
        lodgement_type: l.lodgement_type,
        bank_name: l.bank_name || '',
        terminal_id: l.terminal_id || '',
        opening_balance: l.opening_balance || 0,
      })))
      setLubeProducts((data.lube_products || []).map((lp) => ({
        id: lp.id,
        product_name: lp.product_name || '',
        unit_price: lp.unit_price || 0,
        opening_stock: lp.opening_stock || 0,
      })))
      setCustomers((data.customers || []).map((c) => ({
        id: c.id,
        name: c.name || '',
        phone: c.phone || '',
        opening_balance: c.opening_balance || 0,
      })))
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
      if (field === 'fuel_type') {
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
    setTanks((prev) => prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, tank_number: idx + 1 })))
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

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

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
        nozzles,
        tanks,
        mappings: mappingArr,
        lodgements,
        lube_products: lubeProducts,
        customers,
      }),
    })

    if (res.ok) {
      setSuccess('Settings saved')
      setTimeout(() => setSuccess(''), 3000)
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to save')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">{stationName} Settings</h1>

      {/* Location */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" /> Location
        </h2>
        <input
          type="text"
          placeholder="e.g. 12 Lekki-Epe Expressway, Lagos"
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </section>

      {/* Nozzles */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Fuel className="w-4 h-4 text-blue-600" /> Nozzles
        </h2>
        {nozzles.length > 0 && (
          <div className="divide-y divide-gray-200 mb-3">
            {nozzles.map((n, i) => (
              <div key={i} className="flex items-center gap-2 py-3 first:pt-0">
                <select
                  value={n.fuel_type}
                  onChange={(e) => updateNozzle(i, 'fuel_type', e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <span className="text-sm text-gray-500 w-6 text-center">{n.pump_number}</span>
                <input
                  type="number"
                  placeholder="Opening reading"
                  min={0}
                  value={n.initial_reading || ''}
                  onChange={(e) => updateNozzle(i, 'initial_reading', Number(e.target.value))}
                  className="flex-1 px-2.5 py-1.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeNozzle(i)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addNozzle} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add nozzle
        </button>
      </section>

      {/* Tanks */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Fuel className="w-4 h-4 text-blue-600" /> Underground Tanks
        </h2>
        {tanks.length > 0 && (
          <div className="divide-y divide-gray-200 mb-3">
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
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addTank} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add tank
        </button>
      </section>

      {/* Tank to Nozzle Mapping */}
      {nozzles.length > 0 && tanks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-blue-600" /> Tank to Nozzle Mapping
          </h2>
          <div className="divide-y divide-gray-200">
            {nozzles.map((n, i) => {
              const key = `${n.fuel_type}-${n.pump_number}`
              const sameFuelTanks = tanks.filter((t) => t.fuel_type === n.fuel_type)
              return (
                <div key={i} className="flex items-center gap-3 py-3 first:pt-0">
                  <span className="flex-1 text-sm font-medium text-gray-900">{n.fuel_type} {n.pump_number}</span>
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
        </section>
      )}

      {/* Lodgements */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-blue-600" /> Lodgements
        </h2>
        {lodgements.length > 0 && (
          <div className="divide-y divide-gray-200 mb-3">
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
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addLodgement} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add lodgement
        </button>
      </section>

      {/* Lube Products */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-600" /> Lube Products
        </h2>
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mb-3">
          Opening stock values are automatically adjusted when old entries (&gt;3 months) are consolidated to keep current balances accurate.
        </p>
        {lubeProducts.length > 0 && (
          <div className="divide-y divide-gray-200 mb-3">
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
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addLubeProduct} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add product
        </button>
      </section>

      {/* Credit Customers */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" /> Credit Customers
        </h2>
        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mb-3">
          Opening balances are automatically adjusted when old entries (&gt;3 months) are consolidated to keep current balances accurate.
        </p>
        {customers.length > 0 && (
          <div className="divide-y divide-gray-200 mb-3">
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
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addCustomer} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add customer
        </button>
      </section>

      {/* Save */}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {success && <p className="text-sm text-green-600 mb-4">{success}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save changes
      </button>
    </div>
  )
}
