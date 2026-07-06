'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { haversineKm, distLabel } from '@/lib/geo'
import Nav from '@/components/Nav'
import Link from 'next/link'

const RECENCY_MS = 24 * 60 * 60 * 1000 // 24 hours
const RADIUS_KM = 5

interface Room {
  id: string
  type: 'chat' | 'game'
  name: string | null
  created_by: string
  lat: number | null
  lng: number | null
  created_at: string
  dist?: number
}

function getUserId() {
  let id = localStorage.getItem('zc_uid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zc_uid', id) }
  return id
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [myLat, setMyLat] = useState<number | null>(null)
  const [myLng, setMyLng] = useState<number | null>(null)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      p => { setMyLat(p.coords.latitude); setMyLng(p.coords.longitude); load(p.coords.latitude, p.coords.longitude) },
      () => load(null, null)
    )
  }, [])

  async function load(lat: number | null, lng: number | null) {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .gte('created_at', new Date(Date.now() - RECENCY_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    const withDist = (data || [])
      .filter(r => r.lat !== null && r.lng !== null)
      .map(r => ({ ...r, dist: lat !== null ? haversineKm(lat, lng!, r.lat, r.lng) : undefined }))
      .filter(r => lat === null || (r.dist ?? 0) <= RADIUS_KM)
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))
      .slice(0, 50)

    setRooms(withDist)
    setLoading(false)
  }

  async function createRoom(type: 'chat' | 'game') {
    const uid = getUserId()
    const name = localStorage.getItem('zc_name') || 'Anonymous'
    const { data } = await supabase.from('rooms').insert({
      type, created_by: uid, name: `${name}'s ${type === 'game' ? 'game' : 'chat'}`,
      lat: myLat, lng: myLng,
    }).select().single()
    if (data) window.location.href = `/room/${data.id}`
  }

  return (
    <>
      <div className="page">
        <div className="page-title">Rooms</div>
        <div className="page-sub">Open game or chat rooms nearby · last 24h</div>

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
            <div style={{ fontWeight: 700 }}>No rooms nearby</div>
            <div style={{ fontSize: 13 }}>Rooms only show up for 24h, within {RADIUS_KM}km — start one above</div>
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
                    {r.dist !== undefined && ` · ${distLabel(r.dist)}`}
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
