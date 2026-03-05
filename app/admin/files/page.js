'use client'

import { useState, useEffect } from 'react'
import { Loader2, FileSpreadsheet, Search, ExternalLink, Trash2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'

export default function AdminFilesPage() {
  const [files, setFiles] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ user_id: '', file_name: '', share_link: '', description: '' })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    const [filesRes, usersRes] = await Promise.all([
      supabase.from('user_files').select('*, users(name, email)').order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, email').eq('role', 'user').order('name'),
    ])
    setFiles(filesRes.data || [])
    setUsers(usersRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.user_id || !form.file_name || !form.share_link) return
    setSaving(true)

    const res = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setForm({ user_id: '', file_name: '', share_link: '', description: '' })
      setShowForm(false)
      loadData()
    }
    setSaving(false)
  }

  const deleteFile = async (id) => {
    if (!confirm('Delete this file?')) return
    await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadData()
  }

  const filtered = files.filter((f) =>
    f.file_name.toLowerCase().includes(search.toLowerCase()) ||
    f.users?.name?.toLowerCase().includes(search.toLowerCase()) ||
    f.users?.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Files</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" /> Assign File
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border-t border-b border-gray-200 py-6 mb-6">
          <form onSubmit={handleAdd} className="space-y-3">
            <select
              required
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="File name"
              value={form.file_name}
              onChange={(e) => setForm({ ...form, file_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="url"
              required
              placeholder="OneDrive share link"
              value={form.share_link}
              onChange={(e) => setForm({ ...form, share_link: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search files or users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No files found.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((file) => (
            <div key={file.id} className="flex items-center gap-3 py-3 -mx-4 px-4">
              <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                <p className="text-xs text-gray-500">{file.users?.name} · {file.users?.email}</p>
              </div>
              <span className="text-xs text-gray-400 hidden sm:inline">{format(new Date(file.created_at), 'MMM d')}</span>
              <a href={file.share_link} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-gray-600">
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => deleteFile(file.id)} className="p-1.5 text-gray-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
