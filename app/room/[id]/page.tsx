'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { use } from 'react'
import UnoGame from '@/components/UnoGame'
import Link from 'next/link'

interface Message {
  id: string
  user_id: string
  nickname: string
  content: string
  created_at: string
}

interface Room {
  id: string
  type: 'chat' | 'game'
  name: string | null
  created_by: string
}

function getUserId() {
  let id = localStorage.getItem('zc_uid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zc_uid', id) }
  return id
}

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [nickname, setNickname] = useState('')
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNickname(localStorage.getItem('zc_name') || 'Anonymous')
    loadRoom()
    loadMessages()
    const ch = supabase.channel(`room-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${id}`
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadRoom() {
    const { data } = await supabase.from('rooms').select('*').eq('id', id).single()
    setRoom(data)
  }

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('room_id', id).order('created_at')
    setMessages(data || [])
  }

  async function send() {
    const text = input.trim()
    if (!text) return
    setInput('')
    await supabase.from('messages').insert({
      room_id: id,
      user_id: getUserId(),
      nickname,
      content: text,
    })
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const uid = getUserId()

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)'
      }}>
        <Link href="/" style={{ fontSize: 20, color: 'var(--text2)' }}>←</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{room?.name || 'Room'}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {room?.type === 'game' ? '🃏 UNO' : '💬 Chat'}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={copyLink}>
          {copied ? '✓ Copied' : '🔗 Invite'}
        </button>
      </div>

      {room?.type === 'game' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <UnoGame roomId={id} userId={uid} nickname={nickname} />
        </div>
      ) : (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            {messages.length === 0 && (
              <div className="empty" style={{ paddingTop: 64 }}>
                <div className="empty-icon">💬</div>
                <div style={{ fontWeight: 700 }}>New conversation</div>
                <div style={{ fontSize: 13 }}>Share the link to invite someone</div>
              </div>
            )}
            <div className="messages">
              {messages.map(m => (
                <div key={m.id} className={`msg ${m.user_id === uid ? 'msg-mine' : 'msg-theirs'}`}>
                  {m.user_id !== uid && <div className="msg-sender">{m.nickname}</div>}
                  <div className="msg-bubble">{m.content}</div>
                </div>
              ))}
            </div>
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8,
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
            background: 'var(--bg)'
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Message..."
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={send} disabled={!input.trim()}>↑</button>
          </div>
        </>
      )}
    </div>
  )
}
