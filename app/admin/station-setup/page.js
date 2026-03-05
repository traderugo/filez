'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Trash2, Fuel, Container, Landmark, Droplets, Flame } from 'lucide-react'

const FUEL_TYPES = ['PMS', 'AGO', 'DPK']

function ConfigSection({ title, icon: Icon, items, onAdd, onDelete, renderItem, renderForm, emptyText }) {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="border-t border-gray-200 pt-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />} {title}
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {showForm && renderForm(() => { setShowForm(false) })}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">{renderItem(item)}</div>
              <button onClick={() => onDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StationSetupPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const res = await fetch('/api/station-config')
    if (res.ok) {
      setData(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const addItem = async (table, fields) => {
    const res = await fetch('/api/station-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, ...fields }),
    })
    if (res.ok) loadData()
    return res.ok
  }

  const deleteItem = async (table, id) => {
    if (!confirm('Delete this item?')) return
    await fetch('/api/station-config', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, id }),
    })
    loadData()
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  if (!data) {
    return <p className="text-sm text-gray-500 py-8">Failed to load station config. Make sure you have a station set up in Settings.</p>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Station Setup</h1>
      <p className="text-sm text-gray-500 mb-6">Configure your fuel station&apos;s pumps, tanks, banks, and products.</p>

      {/* Pumps */}
      <ConfigSection
        title="Pumps"
        icon={Fuel}
        items={data.pumps}
        onDelete={(id) => deleteItem('station_pumps', id)}
        emptyText="No pumps configured."
        renderItem={(p) => (
          <p className="text-sm text-gray-900">
            <span className="font-medium">{p.fuel_type}</span> Pump {p.pump_number}
            <span className="text-gray-500 ml-2">Opening: {Number(p.initial_reading).toLocaleString()}</span>
          </p>
        )}
        renderForm={(close) => <PumpForm onSubmit={async (f) => { if (await addItem('station_pumps', f)) close() }} onCancel={close} />}
      />

      {/* Tanks */}
      <ConfigSection
        title="Tanks"
        icon={Container}
        items={data.tanks}
        onDelete={(id) => deleteItem('station_tanks', id)}
        emptyText="No tanks configured."
        renderItem={(t) => (
          <p className="text-sm text-gray-900">
            <span className="font-medium">{t.fuel_type}</span> Tank {t.tank_number}
            <span className="text-gray-500 ml-2">Capacity: {Number(t.capacity).toLocaleString()}</span>
          </p>
        )}
        renderForm={(close) => <TankForm onSubmit={async (f) => { if (await addItem('station_tanks', f)) close() }} onCancel={close} />}
      />

      {/* Banks */}
      <ConfigSection
        title="Banks (POS)"
        icon={Landmark}
        items={data.banks}
        onDelete={(id) => deleteItem('station_banks', id)}
        emptyText="No banks configured."
        renderItem={(b) => <p className="text-sm text-gray-900">{b.bank_name}</p>}
        renderForm={(close) => <BankForm onSubmit={async (f) => { if (await addItem('station_banks', f)) close() }} onCancel={close} />}
      />

      {/* Lube Products */}
      <ConfigSection
        title="Lube Products"
        icon={Droplets}
        items={data.lubeProducts}
        onDelete={(id) => deleteItem('station_lube_products', id)}
        emptyText="No lube products configured."
        renderItem={(p) => (
          <p className="text-sm text-gray-900">
            {p.product_name}
            <span className="text-gray-500 ml-2">
              {Number(p.unit_price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
            </span>
          </p>
        )}
        renderForm={(close) => <LubeProductForm onSubmit={async (f) => { if (await addItem('station_lube_products', f)) close() }} onCancel={close} />}
      />

      {/* Consumption Categories */}
      <ConfigSection
        title="Consumption Categories"
        icon={Flame}
        items={data.consumptionCategories}
        onDelete={(id) => deleteItem('station_consumption_categories', id)}
        emptyText="No consumption categories configured."
        renderItem={(c) => (
          <p className="text-sm text-gray-900">
            <span className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded mr-2">{c.fuel_type}</span>
            {c.category_name}
          </p>
        )}
        renderForm={(close) => <ConsumptionCatForm onSubmit={async (f) => { if (await addItem('station_consumption_categories', f)) close() }} onCancel={close} />}
      />
    </div>
  )
}

function PumpForm({ onSubmit, onCancel }) {
  const [f, setF] = useState({ fuel_type: 'PMS', pump_number: '', initial_reading: '0' })
  const [saving, setSaving] = useState(false)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSubmit(f); setSaving(false) }} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
      <div className="flex gap-3">
        <select value={f.fuel_type} onChange={(e) => setF({ ...f, fuel_type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          {FUEL_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
        </select>
        <input type="number" required min="1" placeholder="Pump #" value={f.pump_number} onChange={(e) => setF({ ...f, pump_number: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input type="number" placeholder="Opening reading" value={f.initial_reading} onChange={(e) => setF({ ...f, initial_reading: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>
      <FormButtons saving={saving} onCancel={onCancel} />
    </form>
  )
}

function TankForm({ onSubmit, onCancel }) {
  const [f, setF] = useState({ fuel_type: 'PMS', tank_number: '', capacity: '' })
  const [saving, setSaving] = useState(false)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSubmit(f); setSaving(false) }} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
      <div className="flex gap-3">
        <select value={f.fuel_type} onChange={(e) => setF({ ...f, fuel_type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          {FUEL_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
        </select>
        <input type="number" required min="1" placeholder="Tank #" value={f.tank_number} onChange={(e) => setF({ ...f, tank_number: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input type="number" required min="0" placeholder="Capacity (litres)" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>
      <FormButtons saving={saving} onCancel={onCancel} />
    </form>
  )
}

function BankForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSubmit({ bank_name: name }); setSaving(false) }} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
      <input type="text" required maxLength={100} placeholder="Bank name (e.g. Stanbic 1)" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
      <FormButtons saving={saving} onCancel={onCancel} />
    </form>
  )
}

function LubeProductForm({ onSubmit, onCancel }) {
  const [f, setF] = useState({ product_name: '', unit_price: '' })
  const [saving, setSaving] = useState(false)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSubmit(f); setSaving(false) }} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
      <div className="flex gap-3">
        <input type="text" required maxLength={100} placeholder="Product name (e.g. Supreme 1L)" value={f.product_name} onChange={(e) => setF({ ...f, product_name: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
        <input type="number" required min="0" step="0.01" placeholder="Unit price" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>
      <FormButtons saving={saving} onCancel={onCancel} />
    </form>
  )
}

function ConsumptionCatForm({ onSubmit, onCancel }) {
  const [f, setF] = useState({ fuel_type: 'PMS', category_name: '' })
  const [saving, setSaving] = useState(false)
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setSaving(true); await onSubmit(f); setSaving(false) }} className="border border-gray-200 rounded-md p-4 mb-4 space-y-3">
      <div className="flex gap-3">
        <select value={f.fuel_type} onChange={(e) => setF({ ...f, fuel_type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          {FUEL_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
        </select>
        <input type="text" required maxLength={100} placeholder="Category (e.g. Station Manager)" value={f.category_name} onChange={(e) => setF({ ...f, category_name: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
      </div>
      <FormButtons saving={saving} onCancel={onCancel} />
    </form>
  )
}

function FormButtons({ saving, onCancel }) {
  return (
    <div className="flex gap-2">
      <button type="submit" disabled={saving} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Add
      </button>
      <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
    </div>
  )
}
