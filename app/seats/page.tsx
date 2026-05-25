'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { haversineKm, distLabel } from '@/lib/geo'
import Nav from '@/components/Nav'

interface Seat {
  id: string
  user_id: string
  nickname: string
  location_name: string
  lat: number
  lng: number
  scheduled_at: string
  note: string | null
  created_at: string
  dist?: number
}

function getUserId() {
  let id = localStorage.getItem('zc_uid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zc_uid', id) }
  return id
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = (d.getTime() - now.getTime()) / 60000
  if (diff < 0) return 'Now'
  if (diff < 60) return `in ${Math.round(diff)} min`
  if (diff < 1440) {
    return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('de-CH', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Seats() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [myLat, setMyLat] = useState<number | null>(null)
  const [myLng, setMyLng] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ location: '', when: '', note: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(p => {
      setMyLat(p.coords.latitude)
      setMyLng(p.coords.longitude)
    })
    fetchSeats()
    const ch = supabase.channel('seats-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'open_seats' }, fetchSeats)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function fetchSeats() {
    const { data } = await supabase
      .from('open_seats')
      .select('*')
      .gte('scheduled_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('scheduled_at')
    setSeats(data || [])
  }

  function withDist(s: Seat) {
    if (myLat === null) return s
    return { ...s, dist: haversineKm(myLat, myLng!, s.lat, s.lng) }
  }

  async function postSeat() {
    if (!form.location || !form.when) return
    setSubmitting(true)
    const uid = getUserId()
    const nickname = localStorage.getItem('zc_name') || 'Anonymous'
    if (myLat === null) {
      await new Promise<void>(res => navigator.geolocation.getCurrentPosition(p => {
        setMyLat(p.coords.latitude); setMyLng(p.coords.longitude); res()
      }, () => res()))
    }
    await supabase.from('open_seats').insert({
      user_id: uid, nickname,
      location_name: form.location,
      lat: myLat ?? 0, lng: myLng ?? 0,
      scheduled_at: new Date(form.when).toISOString(),
      note: form.note || null,
    })
    setForm({ location: '', when: '', note: '' })
    setShowForm(false)
    setSubmitting(false)
  }

  async function deleteSeat(id: string) {
    await supabase.from('open_seats').delete().eq('id', id)
  }

  const uid = typeof window !== 'undefined' ? getUserId() : ''
  const now = new Date()
  const minDate = now.toISOString().slice(0, 16)

  return (
    <>
      <div className="page">
        <div className="top-bar">
          <div>
            <div className="page-title">Open Seats</div>
            <div className="page-sub">Post where you&apos;ll be — no RSVP needed</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Post</button>
        </div>

        {showForm && (
          <div className="overlay">
            <div className="modal">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="modal-title" style={{ margin: 0 }}>Post an open seat</div>
                <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  placeholder="Where? (e.g. Café Marta, Bern HB)"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  min={minDate}
                  value={form.when}
                  onChange={e => setForm(f => ({ ...f, when: e.target.value }))}
                />
                <textarea
                  placeholder="Optional note (e.g. 'reading, headphones off, come say hi')"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={postSeat}
                  disabled={submitting || !form.location || !form.when}
                >
                  {submitting ? 'Posting...' : 'Post seat'}
                </button>
              </div>
            </div>
          </div>
        )}

        {seats.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">☕</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No open seats nearby</div>
            <div style={{ fontSize: 13 }}>Post yours — others will find you</div>
          </div>
        ) : (
          seats.map(withDist).map(s => (
            <div key={s.id} className="seat-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="seat-time">{fmtTime(s.scheduled_at)}</div>
                  <div className="seat-place">📍 {s.location_name}</div>
                </div>
                {s.user_id === uid && (
                  <button className="btn btn-danger btn-sm" onClick={() => deleteSeat(s.id)}>Remove</button>
                )}
              </div>
              {s.note && <div className="seat-note">{s.note}</div>}
              <div className="seat-meta">
                {s.nickname}
                {s.dist !== undefined && ` · ${distLabel(s.dist)}`}
              </div>
            </div>
          ))
        )}
      </div>
      <Nav active="seats" />
    </>
  )
}
