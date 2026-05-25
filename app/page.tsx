'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { haversineKm, distLabel } from '@/lib/geo'
import Nav from '@/components/Nav'

type ActivityType = 'coffee' | 'game' | 'company'
const TYPES: { id: ActivityType; icon: string; label: string; color: string }[] = [
  { id: 'coffee',  icon: '☕', label: 'Coffee',          color: '#c8a83a' },
  { id: 'game',    icon: '🃏', label: 'Card game',       color: '#7070ff' },
  { id: 'company', icon: '🔇', label: 'Silent company',  color: '#4caf70' },
]

interface Activity {
  id: string; room_id: string; user_id: string; nickname: string
  type: ActivityType; note: string | null; lat: number; lng: number
  participant_count: number; created_at: string; dist?: number
}

function uid() {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('zc_uid')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('zc_uid', id) }
  return id
}

export default function Home() {
  const [name, setName]           = useState('')
  const [nameInput, setNameInput] = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [myLat, setMyLat] = useState<number | null>(null)
  const [myLng, setMyLng] = useState<number | null>(null)
  const [postType, setPostType]   = useState<ActivityType | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [posting, setPosting]     = useState(false)
  const [joining, setJoining]     = useState<string | null>(null)
  const [locError, setLocError]   = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const n = typeof window !== 'undefined' ? (localStorage.getItem('zc_name') || '') : ''
    if (n) setName(n)
    getLocation()
    loadActivities()
    const ch = supabase.channel('activities-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, loadActivities)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  function getLocation() {
    navigator.geolocation.getCurrentPosition(
      p => { setMyLat(p.coords.latitude); setMyLng(p.coords.longitude) },
      () => setLocError('Allow location to see nearby activities')
    )
  }

  async function loadActivities() {
    const { data } = await supabase.from('activities').select('*')
      .gte('created_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
    setActivities(data || [])
  }

  const nearby = activities
    .map(a => myLat !== null ? { ...a, dist: haversineKm(myLat, myLng!, a.lat, a.lng) } : a)
    .filter(a => !myLat || (a.dist ?? 0) < 5)
    .sort((a, b) => (a.dist ?? 99) - (b.dist ?? 99))

  async function startActivity() {
    if (!name) { nameRef.current?.focus(); return }
    if (!postType || myLat === null) return
    setPosting(true)
    const t = TYPES.find(t => t.id === postType)!
    const { data: room } = await supabase.from('rooms')
      .insert({ type: postType === 'game' ? 'game' : 'chat', created_by: uid(), name: `${name} — ${t.label}` })
      .select().single()
    if (!room) { setPosting(false); return }
    await supabase.from('activities').insert({
      room_id: room.id, user_id: uid(), nickname: name,
      type: postType, note: noteInput.trim() || null,
      lat: myLat, lng: myLng!, participant_count: 1,
    })
    setPosting(false); setPostType(null); setNoteInput('')
    window.location.href = `/room/${room.id}`
  }

  async function joinActivity(a: Activity) {
    if (!name) { nameRef.current?.focus(); return }
    setJoining(a.id)
    await supabase.from('activities').update({ participant_count: a.participant_count + 1 }).eq('id', a.id)
    window.location.href = `/room/${a.room_id}`
  }

  function saveName(e: React.FormEvent) {
    e.preventDefault()
    const n = nameInput.trim(); if (!n) return
    localStorage.setItem('zc_name', n); setName(n); setNameInput('')
  }

  const t = TYPES.find(t => t.id === postType)

  return (
    <>
      <div className="page" style={{ paddingTop: 20 }}>

        {/* Header / name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-.02em' }}>Zugcafé</div>
          {name
            ? <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('zc_name'); setName('') }}>{name}</button>
            : <form onSubmit={saveName} style={{ display: 'flex', gap: 8 }}>
                <input ref={nameRef} placeholder="Your name" value={nameInput}
                  onChange={e => setNameInput(e.target.value)} autoFocus
                  style={{ width: 140 }} />
                <button className="btn btn-primary btn-sm" type="submit">→</button>
              </form>
          }
        </div>

        {locError && (
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            📍 {locError}
            <button className="btn btn-ghost btn-sm" onClick={getLocation}>Allow</button>
          </div>
        )}

        {/* Post activity */}
        {!postType ? (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 10 }}>
              I want to
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TYPES.map(t => (
                <button key={t.id}
                  onClick={() => name ? setPostType(t.id) : nameRef.current?.focus()}
                  style={{
                    flex: 1, padding: '14px 8px', borderRadius: 14,
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer',
                  }}>
                  <span style={{ fontSize: 26 }}>{t.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 28, background: 'var(--bg2)', border: `1px solid ${t!.color}55`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{t!.icon}</span>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{t!.label}</div>
              <button style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => { setPostType(null); setNoteInput('') }}>✕</button>
            </div>
            <input placeholder="Note (optional) — 'at the window seat', 'beginners welcome'"
              value={noteInput} onChange={e => setNoteInput(e.target.value)} style={{ marginBottom: 12 }} />
            {myLat === null
              ? <button className="btn btn-primary" style={{ width: '100%', height: 48 }} onClick={getLocation}>
                  Allow location to post
                </button>
              : <button className="btn btn-primary" disabled={posting}
                  style={{ width: '100%', height: 48, fontSize: 15, background: t!.color, color: '#0d0d0d' }}
                  onClick={startActivity}>
                  {posting ? 'Posting…' : `I'm open — post it`}
                </button>
            }
          </div>
        )}

        {/* Live feed */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: 12 }}>
          {nearby.length > 0 ? `${nearby.length} happening nearby` : 'Nothing nearby yet'}
        </div>

        {nearby.length === 0 && (
          <div className="empty" style={{ paddingTop: 16 }}>
            <div className="empty-icon">🚆</div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Be the first</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>Post above — anyone nearby sees it and can join instantly. No invite, no waiting.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nearby.map(a => {
            const type = TYPES.find(t => t.id === a.type)!
            const isOwn = a.user_id === uid()
            return (
              <div key={a.id} style={{
                background: 'var(--bg2)', borderRadius: 14, padding: '14px 16px',
                borderLeft: `3px solid ${type.color}`, border: `1px solid var(--border)`,
                borderLeftColor: type.color,
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{type.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>
                    {a.nickname}
                    <span style={{ fontWeight: 400, color: 'var(--text2)', fontSize: 14 }}> · {type.label}</span>
                  </div>
                  {a.note && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.note}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'flex', gap: 8 }}>
                    {a.dist !== undefined && <span>📍 {distLabel(a.dist)}</span>}
                    <span>👥 {a.participant_count} {a.participant_count === 1 ? 'person' : 'people'}</span>
                  </div>
                </div>
                {isOwn
                  ? <button className="btn btn-ghost btn-sm" onClick={() => window.location.href = `/room/${a.room_id}`}>Open</button>
                  : <button className="btn btn-sm" disabled={joining === a.id}
                      onClick={() => joinActivity(a)}
                      style={{ background: type.color, color: '#0d0d0d', fontWeight: 800, flexShrink: 0, padding: '10px 16px', borderRadius: 10, fontSize: 14 }}>
                      {joining === a.id ? '…' : 'Join'}
                    </button>
                }
              </div>
            )
          })}
        </div>

      </div>
      <Nav active="home" />
    </>
  )
}
