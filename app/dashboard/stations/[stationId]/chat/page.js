'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { Send, RefreshCw, Loader2, Activity } from 'lucide-react'
import { db } from '@/lib/db'

export default function ChatPage() {
  const params = useParams()
  const stationId = params.stationId

  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const messages = useLiveQuery(
    () => stationId
      ? db.stationMessages.where('orgId').equals(stationId).sortBy('createdAt')
      : [],
    [stationId],
    []
  )

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user))
  }, [])

  // Pull on first mount
  useEffect(() => {
    if (stationId) handlePull()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handlePull = async () => {
    if (pulling || !stationId) return
    setPulling(true)
    setError('')
    try {
      const res = await fetch(`/api/chat?org_id=${stationId}`)
      if (res.ok) {
        const { messages: serverMessages } = await res.json()
        if (serverMessages?.length) {
          await db.stationMessages.bulkPut(
            serverMessages.map(m => ({
              id: m.id,
              orgId: m.org_id,
              userId: m.user_id,
              userName: m.user_name,
              type: m.type,
              content: m.content,
              actionType: m.action_type,
              createdAt: m.created_at,
            }))
          )
        }
      }
    } catch {
      setError('Failed to pull messages. Check your connection.')
    }
    setPulling(false)
  }

  const handleSend = async () => {
    const content = message.trim()
    if (!content || sending) return
    setMessage('')
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
        await db.stationMessages.put({
          id: m.id,
          orgId: m.org_id,
          userId: m.user_id,
          userName: m.user_name,
          type: 'message',
          content: m.content,
          actionType: null,
          createdAt: m.created_at,
        })
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

  const fmtTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
  }

  const fmtDate = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Group messages by day for date separators
  let lastDate = null

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-2xl mx-auto">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-sm font-semibold text-gray-900">Station Chat</h1>
        <button
          onClick={handlePull}
          disabled={pulling}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {pulling
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          Pull recent messages
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50">
        {messages?.length === 0 && !pulling && (
          <div className="flex justify-center items-center h-full">
            <p className="text-sm text-gray-400">No messages yet. Pull to load or send the first message.</p>
          </div>
        )}

        {messages?.map(msg => {
          const isMe = msg.userId === user?.id
          const msgDate = msg.createdAt ? fmtDate(msg.createdAt) : null
          const showDateSep = msgDate && msgDate !== lastDate
          if (showDateSep) lastDate = msgDate

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDateSep && (
                <div className="flex justify-center my-3">
                  <span className="bg-gray-200 text-gray-500 text-xs px-3 py-0.5 rounded-full">{msgDate}</span>
                </div>
              )}

              {/* Activity log */}
              {msg.type === 'activity' ? (
                <div className="flex justify-center my-1">
                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-500 text-xs px-3 py-1.5 rounded-full max-w-[90%]">
                    <Activity className="w-3 h-3 flex-shrink-0 text-blue-400" />
                    <span className="font-medium text-gray-700">{msg.userName}</span>
                    <span>{msg.content}</span>
                    <span className="text-gray-400 ml-1 shrink-0">· {fmtTime(msg.createdAt)}</span>
                  </div>
                </div>
              ) : (
                /* Chat message */
                <div className={`flex flex-col mb-2 ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-xs text-gray-400 mb-1 px-1">{msg.userName}</span>
                  )}
                  <div className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 px-1">{fmtTime(msg.createdAt)}</span>
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

      {/* Input */}
      <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
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
