'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Send, Loader2, Activity, Trash2 } from 'lucide-react'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabaseClient'

export default function ChatPage() {
  const params = useParams()
  const stationId = params.stationId

  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [activeMentionIdx, setActiveMentionIdx] = useState(0)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const messages = useLiveQuery(
    () => stationId
      ? db.stationMessages.where('orgId').equals(stationId).sortBy('createdAt')
      : [],
    [stationId],
    []
  )

  // Derive unique member names from existing messages
  const members = useMemo(() => {
    if (!messages?.length) return []
    const seen = new Set()
    for (const m of messages) {
      if (m.userName) seen.add(m.userName)
    }
    return [...seen]
  }, [messages])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user))
  }, [])

  // Initial fetch of message history
  useEffect(() => {
    if (!stationId) return
    fetchMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  // Supabase Realtime subscription
  useEffect(() => {
    if (!supabase || !stationId) return

    const channel = supabase
      .channel(`chat:${stationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'station_messages',
        filter: `org_id=eq.${stationId}`,
      }, async (payload) => {
        await db.stationMessages.put(mapMessage(payload.new))
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'station_messages',
        filter: `org_id=eq.${stationId}`,
      }, async (payload) => {
        await db.stationMessages.put(mapMessage(payload.new))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [stationId])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function mapMessage(m) {
    return {
      id: m.id,
      orgId: m.org_id,
      userId: m.user_id,
      userName: m.user_name,
      type: m.type,
      content: m.content,
      actionType: m.action_type,
      deletedAt: m.deleted_at || null,
      createdAt: m.created_at,
    }
  }

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat?org_id=${stationId}`)
      if (res.ok) {
        const { messages: serverMessages } = await res.json()
        if (serverMessages?.length) {
          await db.stationMessages.bulkPut(serverMessages.map(mapMessage))
        }
      }
    } catch {
      // Silently fail — realtime will catch new messages
    }
  }

  const handleSend = async () => {
    const content = message.trim()
    if (!content || sending) return
    setMessage('')
    setShowMentions(false)
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/chat?org_id=${stationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const { message: m } = await res.json()
        await db.stationMessages.put(mapMessage(m))
      } else {
        setError('Failed to send. Try again.')
        setMessage(content)
      }
    } catch {
      setError('No connection. Message not sent.')
      setMessage(content)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleDelete = async (msg) => {
    const deletedAt = new Date().toISOString()
    // Optimistic update
    await db.stationMessages.update(msg.id, { content: null, deletedAt })
    try {
      const res = await fetch(`/api/chat?id=${msg.id}`, { method: 'DELETE' })
      if (!res.ok) {
        // Revert
        await db.stationMessages.update(msg.id, { content: msg.content, deletedAt: null })
      }
    } catch {
      await db.stationMessages.update(msg.id, { content: msg.content, deletedAt: null })
    }
  }

  const handleMessageChange = (e) => {
    const val = e.target.value
    setMessage(val)
    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@(\S*)$/)
    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      const filtered = members.filter(
        name => name !== user?.name && name.toLowerCase().includes(query)
      )
      setMentionSuggestions(filtered)
      setActiveMentionIdx(0)
      setShowMentions(filtered.length > 0)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (name) => {
    const cursor = inputRef.current?.selectionStart ?? message.length
    const textBefore = message.slice(0, cursor)
    const textAfter = message.slice(cursor)
    const atIndex = textBefore.lastIndexOf('@')
    setMessage(textBefore.slice(0, atIndex) + `@${name} ` + textAfter)
    setShowMentions(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleKeyDown = (e) => {
    if (showMentions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveMentionIdx(i => Math.min(i + 1, mentionSuggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveMentionIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionSuggestions[activeMentionIdx])
        return
      }
      if (e.key === 'Escape') {
        setShowMentions(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const fmtTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
  }

  const fmtDate = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  let lastDate = null

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 flex flex-col bg-white">

      {/* Top bar */}
      <div className="flex items-center px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">Station Chat</h1>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-white">
        {messages?.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <p className="text-sm text-gray-400">No messages yet.</p>
          </div>
        )}

        {messages?.map(msg => {
          const isMe = msg.userId === user?.id
          const msgDate = msg.createdAt ? fmtDate(msg.createdAt) : null
          const showDateSep = msgDate && msgDate !== lastDate
          if (showDateSep) lastDate = msgDate
          const isDeleted = !!msg.deletedAt

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDateSep && (
                <div className="flex justify-center my-3">
                  <span className="bg-blue-50 text-blue-500 text-xs px-3 py-0.5">{msgDate}</span>
                </div>
              )}

              {/* Activity log */}
              {msg.type === 'activity' ? (
                <div className="flex justify-center my-1">
                  <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs px-3 py-1.5 max-w-[90%]">
                    <Activity className="w-3 h-3 flex-shrink-0 text-blue-400" />
                    <span className="font-medium text-blue-800">{msg.userName}</span>
                    <span>{msg.content}</span>
                    <span className="text-blue-400 ml-1 shrink-0">· {fmtTime(msg.createdAt)}</span>
                  </div>
                </div>
              ) : (
                /* Chat message */
                <div className={`flex items-end gap-1 mb-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Delete button — own messages only, not already deleted */}
                  {isMe && !isDeleted && (
                    <button
                      onClick={() => handleDelete(msg)}
                      className="mb-5 p-1.5 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className={`flex flex-col max-w-[78%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && !isDeleted && (
                      <span className="text-xs text-gray-500 mb-1 px-1">{msg.userName}</span>
                    )}
                    <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                      isDeleted
                        ? 'bg-gray-100 text-gray-400 italic border border-gray-200'
                        : isMe
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-gray-900'
                    }`}>
                      {isDeleted
                        ? `Message deleted · ${fmtTime(msg.deletedAt)}`
                        : <MessageContent content={msg.content} currentUserName={user?.name} isMe={isMe} />
                      }
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 px-1">{fmtTime(msg.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-600 shrink-0">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-200 bg-white">
        {/* Mention suggestions */}
        {showMentions && (
          <div className="border-b border-gray-200 max-h-40 overflow-y-auto">
            {mentionSuggestions.map((name, i) => (
              <button
                key={name}
                onMouseDown={(e) => { e.preventDefault(); insertMention(name) }}
                className={`w-full text-left px-4 py-2 text-sm ${
                  i === activeMentionIdx ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                @{name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder="Message... use @ to mention"
            className="flex-1 px-4 py-2.5 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="w-10 h-10 bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageContent({ content, currentUserName, isMe }) {
  if (!content) return null
  const parts = content.split(/(@\S+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          const isYou = part.slice(1).toLowerCase() === currentUserName?.toLowerCase()
          return (
            <span
              key={i}
              className={`font-semibold ${
                isYou
                  ? 'bg-yellow-200 text-yellow-900 px-0.5 rounded'
                  : isMe ? 'text-blue-200' : 'text-blue-600'
              }`}
            >
              {part}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
