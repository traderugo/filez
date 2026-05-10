'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Send, Loader2, Trash2, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/formatDate'

export default function ChatPage() {
  const params = useParams()
  const stationId = params.stationId

  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [fetchStatus, setFetchStatus] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSuggestions, setMentionSuggestions] = useState([])
  const [activeMentionIdx, setActiveMentionIdx] = useState(0)
  const [showSplash, setShowSplash] = useState(true)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const messages = useLiveQuery(
    () => stationId
      ? db.stationMessages.where('orgId').equals(stationId).sortBy('createdAt')
      : [],
    [stationId],
    []
  )

  // Collapse consecutive activity messages by the same user with the same content
  // into a single summarized row, e.g. 5x "added a lodgement entry" → "entered 5 lodgement entries"
  const displayedMessages = useMemo(() => {
    if (!messages?.length) return []
    const result = []
    let i = 0
    while (i < messages.length) {
      const m = messages[i]
      if (m.type !== 'activity') {
        result.push(m)
        i++
        continue
      }
      let j = i + 1
      while (
        j < messages.length &&
        messages[j].type === 'activity' &&
        messages[j].userId === m.userId &&
        messages[j].content === m.content
      ) {
        j++
      }
      const count = j - i
      if (count === 1) {
        result.push(m)
      } else {
        const match = (m.content || '').match(/^(added|updated) a (.+) entry$/)
        let content = m.content
        if (match) {
          const verb = match[1] === 'added' ? 'entered' : 'updated'
          content = `${verb} ${count} ${match[2]} entries`
        } else {
          content = `${m.content} (×${count})`
        }
        result.push({
          ...m,
          id: `${m.id}-batch-${count}`,
          content,
          createdAt: messages[j - 1].createdAt,
        })
      }
      i = j
    }
    return result
  }, [messages])

  // Group runs of 3+ consecutive activity rows on the same calendar day into a
  // single collapsible block. Shorter runs render normally.
  const [expandedBlocks, setExpandedBlocks] = useState(() => new Set())
  const toggleBlock = (id) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderItems = useMemo(() => {
    if (!displayedMessages.length) return []
    const items = []
    let i = 0
    while (i < displayedMessages.length) {
      const m = displayedMessages[i]
      if (m.type !== 'activity') {
        items.push({ kind: 'msg', msg: m })
        i++
        continue
      }
      const dayKey = m.createdAt ? new Date(m.createdAt).toDateString() : ''
      let j = i + 1
      while (
        j < displayedMessages.length &&
        displayedMessages[j].type === 'activity' &&
        (displayedMessages[j].createdAt ? new Date(displayedMessages[j].createdAt).toDateString() : '') === dayKey
      ) {
        j++
      }
      const run = displayedMessages.slice(i, j)
      if (run.length >= 3) {
        items.push({ kind: 'activityBlock', id: `block-${run[0].id}`, activities: run })
      } else {
        for (const r of run) items.push({ kind: 'msg', msg: r })
      }
      i = j
    }
    return items
  }, [displayedMessages])

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
    const t = setTimeout(() => setShowSplash(false), 2000)
    return () => clearTimeout(t)
  }, [])

  // Fetch messages on mount only — user clicks Refresh for updates
  useEffect(() => {
    if (!stationId) return
    fetchMessages(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const pollingRef = useRef(false)

  const fetchMessages = async (showSpinner = true) => {
    if (pollingRef.current) return
    pollingRef.current = true
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch(`/api/chat?org_id=${stationId}`, { cache: 'no-store' })
      if (res.ok) {
        const { messages: serverMessages } = await res.json()
        if (serverMessages?.length) {
          await db.stationMessages.bulkPut(serverMessages.map(mapMessage))
        }
      }
    } catch {
      // Offline — IndexedDB data still shown via useLiveQuery
    }
    if (showSpinner) setRefreshing(false)
    pollingRef.current = false
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
      const res = await fetch(`/api/chat?id=${msg.id}&org_id=${stationId}`, { method: 'DELETE' })
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
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  // fmtDate imported from @/lib/formatDate

  let lastDate = null

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Please wait...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 flex flex-col bg-white max-w-2xl mx-auto">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">Station Chat</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMessages}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-white">
        {displayedMessages.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <p className="text-sm text-gray-400">No messages yet.</p>
          </div>
        )}

        {renderItems.map(item => {
          if (item.kind === 'activityBlock') {
            const isExpanded = expandedBlocks.has(item.id)
            const firstMsg = item.activities[0]
            const blockDate = firstMsg.createdAt ? fmtDate(firstMsg.createdAt) : null
            const showDateSep = blockDate && blockDate !== lastDate
            if (showDateSep) lastDate = blockDate
            return (
              <div key={item.id}>
                {showDateSep && (
                  <div className="flex justify-center my-3">
                    <span className="bg-blue-50 text-blue-500 text-xs px-3 py-0.5">{blockDate}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleBlock(item.id)}
                  className="w-full flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 my-1 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>{item.activities.length} activity logs</span>
                  <span className="text-gray-400">— click to {isExpanded ? 'collapse' : 'expand'}</span>
                </button>
                {isExpanded && item.activities.map(msg => (
                  <div key={msg.id} className="my-1">
                    <p className="text-sm text-gray-500 px-3 py-1">
                      {fmtTime(msg.createdAt)} · <span className="font-medium text-gray-600">{msg.userName}</span> {msg.content}
                    </p>
                  </div>
                ))}
              </div>
            )
          }

          const msg = item.msg
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
                <div className="my-1">
                  <p className="text-sm text-gray-500 px-3 py-1">
                    {fmtTime(msg.createdAt)} · <span className="font-medium text-gray-600">{msg.userName}</span> {msg.content}
                  </p>
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
                    <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                      isDeleted
                        ? 'bg-gray-100 text-gray-400 italic border border-gray-200'
                        : isMe
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-slate-100 text-gray-900'
                    }`}>
                      {!isMe && !isDeleted && (
                        <p className="font-semibold text-gray-700 mb-1">{msg.userName}</p>
                      )}
                      {isDeleted
                        ? `Message deleted · ${fmtTime(msg.deletedAt)}`
                        : <MessageContent content={msg.content} currentUserName={user?.name} isMe={isMe} />
                      }
                      <p className={`text-[10px] mt-1.5 ${isDeleted ? 'text-gray-400' : isMe ? 'text-blue-500' : 'text-gray-400'}`}>{fmtTime(msg.createdAt)}</p>
                    </div>
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
                  : 'text-blue-600'
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
