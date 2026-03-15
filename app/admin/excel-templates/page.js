'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Loader2, Upload, Trash2, Download, Pencil, X, Check, FileSpreadsheet,
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ExcelTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Upload state
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef()

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState(null)

  // Download state
  const [downloadingId, setDownloadingId] = useState(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/excel-templates')
    if (res.ok) {
      const data = await res.json()
      setTemplates(data.templates || [])
    } else {
      setError('Failed to load templates')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetUpload() {
    setFile(null)
    setName('')
    setDescription('')
    setUploadError('')
    setShowUpload(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) { setUploadError('Select an Excel file'); return }
    if (!name.trim()) { setUploadError('Template name is required'); return }

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      setUploadError('Only .xlsx and .xls files are allowed')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      const filePath = `templates/${Date.now()}_${file.name.replace(/\s+/g, '_')}`

      const { error: storageErr } = await supabase.storage
        .from('excel-templates')
        .upload(filePath, file, { contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      if (storageErr) {
        setUploadError(storageErr.message || 'Upload failed')
        setUploading(false)
        return
      }

      const res = await fetch('/api/admin/excel-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        // Clean up orphan file in storage
        await supabase.storage.from('excel-templates').remove([filePath])
        setUploadError(data.error || 'Failed to save template')
        setUploading(false)
        return
      }

      resetUpload()
      load()
    } catch {
      setUploadError('Unexpected error. Please try again.')
    }
    setUploading(false)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    const res = await fetch('/api/admin/excel-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    }
    setDeletingId(null)
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditDesc(t.description || '')
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editName.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin/excel-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: editName, description: editDesc }),
    })
    if (res.ok) {
      const data = await res.json()
      setTemplates((prev) => prev.map((t) => t.id === editingId ? data.template : t))
      setEditingId(null)
    }
    setSaving(false)
  }

  async function handleDownload(t) {
    setDownloadingId(t.id)
    const res = await fetch(`/api/admin/excel-templates/download?id=${t.id}`)
    if (res.ok) {
      const { url, file_name } = await res.json()
      const a = document.createElement('a')
      a.href = url
      a.download = file_name
      a.click()
    }
    setDownloadingId(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-gray-900">Excel Templates</h1>
        {!showUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700 rounded"
          >
            <Upload className="w-4 h-4" />
            Upload template
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Manage Excel report templates. Uploaded files are stored privately and available to admins only.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Upload form */}
      {showUpload && (
        <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900">Upload new template</p>
            <button onClick={resetUpload} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Template name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly Station Report"
                className="w-full px-3 py-2 border border-gray-300 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Excel file <span className="text-red-500">*</span></label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:border file:border-gray-300 file:rounded file:text-sm file:bg-white file:text-gray-700 hover:file:bg-gray-50"
              />
              {file && (
                <p className="text-xs text-gray-500 mt-1">{file.name} — {formatBytes(file.size)}</p>
              )}
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" onClick={resetUpload} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <FileSpreadsheet className="w-10 h-10 mb-2" />
          <p className="text-sm">No templates uploaded yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {templates.map((t) => (
            <div key={t.id} className="py-4">
              {editingId === t.id ? (
                <form onSubmit={handleEdit} className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-1.5 border border-gray-300 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t.file_name} · {formatBytes(t.file_size)} · {formatDate(t.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(t)}
                      disabled={downloadingId === t.id}
                      className="p-1.5 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                      title="Download"
                    >
                      {downloadingId === t.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(t)}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deletingId === t.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === t.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
