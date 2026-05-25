'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { haversineKm, distLabel } from '@/lib/geo'
import Nav from '@/components/Nav'

const EXPIRE_MS = 5 * 60 * 1000 // 5 minutes

type ActivityType = 'coffee' | 'game' | 'company'
const TYPES: { id: ActivityType; icon: string; label: string; color: string }[] = [
  { id: 'coffee',  icon: '☕', label: 'Coffee',       color: '#c8882a' },
  { id: 'game',    icon: '🃏', label: 'Card game',    color: '#8878e8' },
  { id: 'company', icon: '🌿', label: 'Just company', color: '#7eb87a' },
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

function secsLeft(created_at: string) {
  return Math.max(0, Math.round((new Date(created_at).getTime() + EXPIRE_MS - Date.now()) / 1000))
}

function fmtCountdown(secs: number) {
  if (secs <= 0) return 'expired'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `${s}s`
}

export default function Home() {
  const [name, setName]             = useState('')
  const [nameInput, setNameInput]   = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [myLat, setMyLat]           = useState<number | null>(null)
  const [myLng, setMyLng]           = useState<number | null>(null)
  const [postType, setPostType]     = useState<ActivityType | null>(null)
  const [noteInput, setNoteInput]   = useState('')
  const [posting, setPosting]       = useState(false)
  const [joining, setJoining]       = useState<string | null>(null)
  const [tick, setTick]             = useState(0)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const n = typeof window !== 'undefined' ? (localStorage.getItem('zc_name') || '') : ''
    if (n) setName(n)
    navigator.geolocation.getCurrentPosition(
      p => { setMyLat(p.coords.latitude); setMyLng(p.coords.longitude) },
      () => {}
    )
    loadActivities()
    const ch = supabase.channel('activities-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, loadActivities)
      .subscribe()
    // tick every second for countdown, reload feed every 30s
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000)
    const reloadInterval = setInterval(loadActivities, 30000)
    return () => { supabase.removeChannel(ch); clearInterval(tickInterval); clearInterval(reloadInterval) }
  }, [])

  async function loadActivities() {
    const { data } = await supabase.from('activities').select('*')
      .gte('created_at', new Date(Date.now() - EXPIRE_MS).toISOString())
      .order('created_at', { ascending: false })
    setActivities(data || [])
  }

  const nearby = activities
    .map(a => myLat !== null ? { ...a, dist: haversineKm(myLat, myLng!, a.lat, a.lng) } : a)
    .filter(a => (!myLat || (a.dist ?? 0) < 2) && secsLeft(a.created_at) > 0)
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

        <div className="top-bar">
          <div>
            <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: '-.03em' }}>Zugcafé</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 1 }}>Who&apos;s nearby right now</div>
          </div>
          {name
            ? <button className="btn btn-ghost btn-sm" style={{ borderRadius: 20 }}
                onClick={() => { localStorage.removeItem('zc_name'); setName('') }}>
                {name}
              </button>
            : <form onSubmit={saveName} style={{ display: 'flex', gap: 8 }}>
                <input ref={nameRef} placeholder="Your name" value={nameInput}
                  onChange={e => setNameInput(e.target.value)} autoFocus style={{ width: 130, borderRadius: 20 }} />
                <button className="btn btn-primary btn-sm" type="submit">→</button>
              </form>
          }
        </div>

        {/* Post */}
        {!postType ? (
          <div style={{ marginBottom: 28 }}>
            <div className="section-label">I want to</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {TYPES.map(t => (
                <button key={t.id} className="type-btn"
                  onClick={() => name ? setPostType(t.id) : nameRef.current?.focus()}>
                  <span className="type-btn-icon">{t.icon}</span>
                  <span className="type-btn-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="post-form" style={{ marginBottom: 28, borderColor: `${t!.color}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className={`activity-icon activity-icon-${postType}`}>{t!.icon}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{t!.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Visible for 5 min · anyone nearby can join</div>
              </div>
              <button style={{ marginLeft: 'auto', fontSize: 20, color: 'var(--text3)', lineHeight: 1 }}
                onClick={() => { setPostType(null); setNoteInput('') }}>✕</button>
            </div>
            <input placeholder="Note — 'window seat', 'wagon 3'"
              value={noteInput} onChange={e => setNoteInput(e.target.value)} style={{ marginBottom: 12 }} />
            {myLat === null
              ? <button className="btn btn-primary" style={{ width: '100%', height: 50 }}
                  onClick={() => navigator.geolocation.getCurrentPosition(
                    p => { setMyLat(p.coords.latitude); setMyLng(p.coords.longitude) }, () => {}
                  )}>Allow location to post</button>
              : <button className="btn btn-primary" disabled={posting}
                  style={{ width: '100%', height: 50, background: t!.color, fontSize: 15, borderRadius: 12 }}
                  onClick={startActivity}>
                  {posting ? 'Posting…' : `I'm open — post it`}
                </button>
            }
          </div>
        )}

        {/* Feed */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="section-label" style={{ margin: 0 }}>
            {nearby.length > 0 ? `${nearby.length} happening nearby` : 'Nothing nearby yet'}
          </div>
          {nearby.length > 0 && <div className="live-badge"><span className="live-dot" />Live</div>}
        </div>

        {nearby.length === 0 && (
          <div className="empty">
            <div className="empty-icon">🚆</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Be the first</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, maxWidth: 280, margin: '0 auto', color: 'var(--text2)' }}>
              Post above — visible for 5 minutes.<br />Anyone nearby can join instantly.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nearby.map(a => {
            const type = TYPES.find(t => t.id === a.type)!
            const isOwn = a.user_id === uid()
            const secs = secsLeft(a.created_at)
            const urgent = secs < 60
            return (
              <div key={a.id} className="activity-card" style={{ borderLeftColor: type.color, borderLeftWidth: 3 }}>
                <div className={`activity-icon activity-icon-${a.type}`}>{type.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="activity-name">
                    {a.nickname}
                    <span className="activity-type"> · {type.label}</span>
                  </div>
                  {a.note && <div className="activity-note">{a.note}</div>}
                  <div className="activity-meta">
                    {a.dist !== undefined && <span>📍 {distLabel(a.dist)}</span>}
                    <span>👥 {a.participant_count}</span>
                    <span style={{ color: urgent ? '#d96060' : 'var(--text3)', fontWeight: urgent ? 700 : 400 }}>
                      ⏱ {fmtCountdown(secs)}
                    </span>
                  </div>
                </div>
                {isOwn
                  ? <button className="btn btn-ghost btn-sm" style={{ borderRadius: 10, flexShrink: 0 }}
                      onClick={() => window.location.href = `/room/${a.room_id}`}>Open</button>
                  : <button className={`join-btn join-btn-${a.type}`} disabled={joining === a.id}
                      onClick={() => joinActivity(a)}>
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
