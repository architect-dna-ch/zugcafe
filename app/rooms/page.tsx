'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import Link from 'next/link'

interface Room {
  id: string
  type: 'chat' | 'game'
  name: string | null
  created_by: string
  created_at: string
}

function getUserId() {
  let id = localStorage.getItem('zc_uid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zc_uid', id) }
  return id
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setRooms(data || [])
    setLoading(false)
  }

  async function createRoom(type: 'chat' | 'game') {
    const uid = getUserId()
    const name = localStorage.getItem('zc_name') || 'Anonymous'
    const { data } = await supabase.from('rooms').insert({
      type, created_by: uid, name: `${name}'s ${type === 'game' ? 'game' : 'chat'}`
    }).select().single()
    if (data) window.location.href = `/room/${data.id}`
  }

  return (
    <>
      <div className="page">
        <div className="page-title">Rooms</div>
        <div className="page-sub">Open game or chat rooms</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => createRoom('game')}>
            🃏 New UNO game
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => createRoom('chat')}>
            💬 New chat
          </button>
        </div>

        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : rooms.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎴</div>
            <div style={{ fontWeight: 700 }}>No rooms yet</div>
          </div>
        ) : (
          rooms.map(r => (
            <Link key={r.id} href={`/room/${r.id}`} style={{ display: 'block', marginBottom: 8 }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28 }}>{r.type === 'game' ? '🃏' : '💬'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name || r.id.slice(0, 8)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {r.type === 'game' ? 'UNO · up to 4 players' : 'Chat room'}
                    {' · '}{new Date(r.created_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ color: 'var(--text3)', fontSize: 18 }}>→</div>
              </div>
            </Link>
          ))
        )}
      </div>
      <Nav active="rooms" />
    </>
  )
}
